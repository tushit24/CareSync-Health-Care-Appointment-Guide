const { PrismaClient } = require('@prisma/client');
const Groq = require('groq-sdk');
const { deleteCalendarEvent } = require('../services/calendarService');

const prisma = new PrismaClient();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


// Helper to analyze symptoms using Groq API
async function analyzeSymptoms(symptomsText) {
  if (!symptomsText || !symptomsText.trim()) {
    return {
      urgencyLevel: null,
      preVisitSummaryJson: { aiError: true, message: 'No symptoms provided' }
    };
  }

  try {
    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'user',
          content: `Analyse these symptoms and return a JSON object containing: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptomsText}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    // Standardise urgency output (Low / Medium / High)
    let urgency = parsed.urgency || parsed.urgency_level || 'Low';
    // Clean urgency string
    urgency = urgency.charAt(0).toUpperCase() + urgency.slice(1).toLowerCase();
    if (!['Low', 'Medium', 'High'].includes(urgency)) {
      urgency = 'Medium';
    }

    return {
      urgencyLevel: urgency,
      preVisitSummaryJson: {
        urgency,
        chief_complaint: parsed.chief_complaint || parsed.chiefComplaint || 'Chief complaint analysis completed.',
        questions: parsed.questions || parsed.suggested_questions || []
      }
    };
  } catch (error) {
    console.error('Groq symptom analysis error:', error);
    return {
      urgencyLevel: null,
      preVisitSummaryJson: { aiError: true }
    };
  }
}

// 1. Search doctors by specialisation and list available (OPEN or expired HELD) slots
// Only slots with a date/startTime combination in the future are returned.
const searchDoctors = async (req, res) => {
  try {
    const { specialisation } = req.query;
    const now = new Date();

    // today as YYYY-MM-DD in local time — used for the DB date boundary
    const todayStr = now.toLocaleDateString('en-CA'); // 'YYYY-MM-DD' in local tz
    // Current local time as HH:MM — used to trim stale slots on today
    const nowTimeStr = now.toTimeString().slice(0, 5); // 'HH:MM'

    const doctors = await prisma.doctorProfile.findMany({
      where: specialisation ? {
        specialisation: {
          contains: specialisation,
          mode: 'insensitive'
        }
      } : {},
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        slots: {
          where: {
            // Only fetch slots from today onwards (eliminates all past days via DB index)
            date: { gte: new Date(todayStr) },
            OR: [
              { status: 'OPEN' },
              {
                status: 'HELD',
                heldUntil: { lt: now }
              }
            ]
          },
          orderBy: [
            { date: 'asc' },
            { startTime: 'asc' }
          ]
        }
      }
    });

    // Post-filter: for slots whose date equals today, drop any whose startTime has passed.
    // startTime is stored as 'HH:MM' — string comparison works correctly for time ordering.
    const formatted = doctors.map(d => ({
      id: d.id,
      name: d.user.name,
      email: d.user.email,
      phone: d.user.phone,
      specialisation: d.specialisation,
      bio: d.bio,
      slotDurationMinutes: d.slotDurationMinutes,
      slots: d.slots
        .filter(s => {
          const slotDateStr = s.date.toISOString().split('T')[0];
          // If the slot is on a future date, always include it.
          if (slotDateStr > todayStr) return true;
          // If the slot is today, only include it if startTime is still in the future.
          return s.startTime > nowTimeStr;
        })
        .map(s => ({
          id: s.id,
          date: s.date.toISOString().split('T')[0],
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status
        }))
    }));

    res.status(200).json({ doctors: formatted });
  } catch (error) {
    console.error('Search doctors error:', error);
    res.status(500).json({ error: 'Failed to search doctors' });
  }
};

// 2. Select slot (Hold slot) - enforces 5 minute hold with row-level transaction locks
const holdSlot = async (req, res) => {
  const slotId = req.params.id;
  const patientId = req.user.userId;

  try {
    const resultSlot = await prisma.$transaction(async (tx) => {
      // Execute SELECT ... FOR UPDATE raw query to prevent race conditions on parallel read/writes
      const rawSlots = await tx.$queryRaw`
        SELECT id, status, "held_by" as "heldBy", "held_until" as "heldUntil"
        FROM slots
        WHERE id = ${slotId}
        FOR UPDATE
      `;

      if (!rawSlots || rawSlots.length === 0) {
        throw new Error('SLOT_NOT_FOUND');
      }

      const dbSlot = rawSlots[0];
      const now = new Date();

      // Check if slot is open, or if it is held but the hold has expired
      const isSlotAvailable = 
        dbSlot.status === 'OPEN' || 
        (dbSlot.status === 'HELD' && dbSlot.heldUntil && new Date(dbSlot.heldUntil) < now);

      if (!isSlotAvailable) {
        throw new Error('SLOT_ALREADY_TAKEN');
      }

      // Calculate hold expiry (now + 5 minutes)
      const heldUntil = new Date(Date.now() + 5 * 60 * 1000);

      // Perform update inside transaction
      const updated = await tx.slot.update({
        where: { id: slotId },
        data: {
          status: 'HELD',
          heldBy: patientId,
          heldUntil: heldUntil
        }
      });

      return updated;
    });

    res.status(200).json({
      message: 'Slot hold active for 5 minutes',
      slot: {
        id: resultSlot.id,
        date: resultSlot.date.toISOString().split('T')[0],
        startTime: resultSlot.startTime,
        endTime: resultSlot.endTime,
        heldUntil: resultSlot.heldUntil
      }
    });

  } catch (error) {
    console.error('Hold slot error:', error.message);
    if (error.message === 'SLOT_NOT_FOUND') {
      return res.status(404).json({ error: 'Slot not found' });
    }
    if (error.message === 'SLOT_ALREADY_TAKEN') {
      return res.status(409).json({ error: 'This slot is already booked or held by another patient. Please select another slot.' });
    }
    res.status(500).json({ error: 'Failed to hold slot due to a server error' });
  }
};

// 3. Confirm booking - verifies hold is active, creates Appointment, and sets slot status to BOOKED
const confirmBooking = async (req, res) => {
  const slotId = req.params.id;
  const patientId = req.user.userId;
  const { symptomsText } = req.body;

  try {
    // Perform Groq LLM network call OUTSIDE/BEFORE database transaction to avoid holding DB lock for too long
    const aiAnalysis = await analyzeSymptoms(symptomsText);

    const appointment = await prisma.$transaction(async (tx) => {
      // Row lock using SELECT ... FOR UPDATE
      const rawSlots = await tx.$queryRaw`
        SELECT id, status, "doctor_id" as "doctorId", "held_by" as "heldBy", "held_until" as "heldUntil"
        FROM slots
        WHERE id = ${slotId}
        FOR UPDATE
      `;

      if (!rawSlots || rawSlots.length === 0) {
        throw new Error('SLOT_NOT_FOUND');
      }

      const dbSlot = rawSlots[0];
      const now = new Date();

      // Validate hold state: must be HELD by this patient AND not expired
      const isHoldValid =
        dbSlot.status === 'HELD' &&
        dbSlot.heldBy === patientId &&
        dbSlot.heldUntil &&
        new Date(dbSlot.heldUntil) > now;

      if (!isHoldValid) {
        throw new Error('SLOT_HOLD_EXPIRED_OR_INVALID');
      }

      // Create Appointment row
      const appt = await tx.appointment.create({
        data: {
          slotId,
          patientId,
          doctorId: dbSlot.doctorId,
          status: 'CONFIRMED',
          symptomsText: symptomsText || null,
          urgencyLevel: aiAnalysis.urgencyLevel,
          preVisitSummaryJson: aiAnalysis.preVisitSummaryJson
        }
      });

      // Update Slot status to BOOKED
      await tx.slot.update({
        where: { id: slotId },
        data: {
          status: 'BOOKED'
        }
      });

      // Enqueue confirmations to Notification Logs (stubbed for worker pickup)
      await tx.notificationLog.create({
        data: {
          appointmentId: appt.id,
          type: 'BOOKING_CONFIRMATION',
          channel: 'EMAIL',
          status: 'PENDING'
        }
      });

      await tx.notificationLog.create({
        data: {
          appointmentId: appt.id,
          type: 'BOOKING_CONFIRMATION',
          channel: 'CALENDAR',
          status: 'PENDING'
        }
      });

      return appt;
    });

    res.status(201).json({
      message: 'Booking confirmed successfully',
      appointment
    });

  } catch (error) {
    console.error('Confirm booking error:', error.message);
    if (error.message === 'SLOT_NOT_FOUND') {
      return res.status(404).json({ error: 'Slot not found' });
    }
    if (error.message === 'SLOT_HOLD_EXPIRED_OR_INVALID') {
      return res.status(409).json({ error: 'This slot hold has expired or is invalid. Please pick another slot.' });
    }
    res.status(500).json({ error: 'Failed to confirm booking due to a server error' });
  }
};

// Retrieve all confirmed or completed appointments for the logged-in patient
const getAppointments = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const now = new Date();

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId,
        status: { in: ['CONFIRMED', 'COMPLETED', 'CANCELLED'] }
      },
      include: {
        slot: true,
        doctor: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        prescriptions: {
          include: {
            reminders: {
              where: {
                status: 'PENDING',
                scheduledAt: { gte: now }
              },
              orderBy: { scheduledAt: 'asc' },
              take: 5   // next 5 upcoming doses per prescription
            }
          }
        }
      },
      orderBy: [
        { slot: { date: 'asc' } },
        { slot: { startTime: 'asc' } }
      ]
    });

    const formatted = appointments.map(appt => ({
      id: appt.id,
      doctorId: appt.doctorId,
      doctorName: appt.doctor.user.name,
      specialisation: appt.doctor.specialisation,
      date: appt.slot.date.toISOString().split('T')[0],
      startTime: appt.slot.startTime,
      endTime: appt.slot.endTime,
      status: appt.status,
      symptomsText: appt.symptomsText,
      preVisitSummaryJson: appt.preVisitSummaryJson,
      urgencyLevel: appt.urgencyLevel,
      doctorNotes: appt.doctorNotes,
      prescriptionJson: appt.prescriptionJson,
      postVisitSummaryText: appt.postVisitSummaryText,
      // Real Prescription rows with upcoming reminder times
      prescriptions: appt.prescriptions.map(p => ({
        id: p.id,
        medicineName: p.medicineName,
        dosage: p.dosage,
        frequencyPerDay: p.frequencyPerDay,
        durationDays: p.durationDays,
        upcomingReminders: p.reminders.map(r => r.scheduledAt.toISOString())
      }))
    }));

    res.status(200).json({ appointments: formatted });
  } catch (error) {
    console.error('Get patient appointments error:', error);
    res.status(500).json({ error: 'Failed to retrieve appointments' });
  }
};

// Cancel a confirmed future appointment
const cancelAppointment = async (req, res) => {
  const appointmentId = req.params.id;
  const patientId = req.user.userId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { slot: true }
      });

      if (!appt) {
        throw new Error('APPOINTMENT_NOT_FOUND');
      }

      if (appt.patientId !== patientId) {
        throw new Error('UNAUTHORIZED');
      }

      if (appt.status !== 'CONFIRMED') {
        throw new Error('CANNOT_CANCEL_STATUS');
      }

      // Check if it's in the future
      const now = new Date();
      const slotDate = new Date(appt.slot.date);
      const [shour, smin] = appt.slot.startTime.split(':').map(Number);
      const slotDateTime = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate(), shour, smin);
      
      if (slotDateTime < now) {
        throw new Error('CANNOT_CANCEL_PAST_APPOINTMENT');
      }

      // 1. Update appointment status to CANCELLED
      const updatedAppt = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CANCELLED' }
      });

      // 2. Set slot status back to OPEN
      await tx.slot.update({
        where: { id: appt.slotId },
        data: {
          status: 'OPEN',
          heldBy: null,
          heldUntil: null
        }
      });

      // 3. Log notification logs (EMAIL and CALENDAR) for cancellation
      await tx.notificationLog.create({
        data: {
          appointmentId: appt.id,
          type: 'CANCELLATION',
          channel: 'EMAIL',
          status: 'PENDING'
        }
      });

      await tx.notificationLog.create({
        data: {
          appointmentId: appt.id,
          type: 'CANCELLATION',
          channel: 'CALENDAR',
          status: 'PENDING'
        }
      });

      return updatedAppt;
    });

    res.status(200).json({ message: 'Appointment cancelled successfully', appointment: result });
  } catch (error) {
    console.error('Cancel appointment error:', error.message);
    if (error.message === 'APPOINTMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    if (error.message === 'UNAUTHORIZED') {
      return res.status(403).json({ error: 'Unauthorized to cancel this appointment' });
    }
    if (error.message === 'CANNOT_CANCEL_STATUS' || error.message === 'CANNOT_CANCEL_PAST_APPOINTMENT') {
      return res.status(400).json({ error: 'Only future confirmed appointments can be cancelled' });
    }
    res.status(500).json({ error: 'Failed to cancel appointment due to server error' });
  }
};

// Reschedule a confirmed future appointment to a new open slot
const rescheduleAppointment = async (req, res) => {
  const appointmentId = req.params.id;
  const patientId = req.user.userId;
  const { newSlotId } = req.body;

  if (!newSlotId) {
    return res.status(400).json({ error: 'newSlotId is required' });
  }

  try {
    // 1. Pre-flight: verify appointment exists, is owned by patient, is future + CONFIRMED
    const existingAppt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { slot: true }
    });

    if (!existingAppt) return res.status(404).json({ error: 'Appointment not found' });
    if (existingAppt.patientId !== patientId) return res.status(403).json({ error: 'Unauthorized' });
    if (existingAppt.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Only confirmed appointments can be rescheduled' });
    }

    const now = new Date();
    const slotDate = new Date(existingAppt.slot.date);
    const [sh, sm] = existingAppt.slot.startTime.split(':').map(Number);
    const slotDateTime = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate(), sh, sm);
    if (slotDateTime < now) {
      return res.status(400).json({ error: 'Cannot reschedule a past appointment' });
    }

    // 2. Save old event IDs BEFORE clearing them (needed for calendar cleanup)
    const oldPatientEventId = existingAppt.patientCalendarEventId;
    const oldDoctorEventId  = existingAppt.doctorCalendarEventId;
    const oldSlotId         = existingAppt.slotId;

    // 3. DB transaction: acquire lock on new slot, swap slots atomically
    const updatedAppt = await prisma.$transaction(async (tx) => {
      // Lock new slot with SELECT FOR UPDATE
      const rawNewSlots = await tx.$queryRaw`
        SELECT id, status FROM slots WHERE id = ${newSlotId} FOR UPDATE
      `;

      if (!rawNewSlots || rawNewSlots.length === 0) throw new Error('NEW_SLOT_NOT_FOUND');
      if (rawNewSlots[0].status !== 'OPEN') throw new Error('NEW_SLOT_NOT_AVAILABLE');

      // Book new slot
      await tx.slot.update({ where: { id: newSlotId }, data: { status: 'BOOKED' } });

      // Free old slot
      await tx.slot.update({
        where: { id: oldSlotId },
        data: { status: 'OPEN', heldBy: null, heldUntil: null }
      });

      // Update appointment to new slot, clear old event IDs
      const appt = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          slotId: newSlotId,
          patientCalendarEventId: null,
          doctorCalendarEventId:  null
        }
      });

      // Enqueue CALENDAR notification for the new slot (worker will create fresh events)
      await tx.notificationLog.create({
        data: {
          appointmentId,
          type: 'BOOKING_CONFIRMATION',
          channel: 'CALENDAR',
          status: 'PENDING'
        }
      });

      return appt;
    });

    // 4. Delete old calendar events AFTER the DB transaction succeeds.
    //    Do this directly (not via notification_log) to avoid orphaning the old events.
    //    Failures are logged to console but don't block the reschedule response.
    const [patientUser, doctorProfile] = await Promise.all([
      prisma.user.findUnique({ where: { id: patientId }, select: { googleRefreshToken: true } }),
      prisma.doctorProfile.findUnique({
        where: { id: existingAppt.doctorId },
        include: { user: { select: { googleRefreshToken: true } } }
      })
    ]);

    if (patientUser?.googleRefreshToken && oldPatientEventId) {
      try {
        await deleteCalendarEvent(patientUser.googleRefreshToken, oldPatientEventId);
        console.log(`[Reschedule] Deleted old patient calendar event ${oldPatientEventId}`);
      } catch (e) {
        console.error('[Reschedule] Failed to delete patient calendar event:', e.message);
      }
    }

    if (doctorProfile?.user?.googleRefreshToken && oldDoctorEventId) {
      try {
        await deleteCalendarEvent(doctorProfile.user.googleRefreshToken, oldDoctorEventId);
        console.log(`[Reschedule] Deleted old doctor calendar event ${oldDoctorEventId}`);
      } catch (e) {
        console.error('[Reschedule] Failed to delete doctor calendar event:', e.message);
      }
    }

    res.status(200).json({ message: 'Appointment rescheduled successfully', appointment: updatedAppt });

  } catch (error) {
    console.error('Reschedule appointment error:', error.message);
    if (error.message === 'NEW_SLOT_NOT_FOUND') {
      return res.status(404).json({ error: 'New slot not found' });
    }
    if (error.message === 'NEW_SLOT_NOT_AVAILABLE') {
      return res.status(409).json({ error: 'This slot is no longer available. Please pick another.' });
    }
    res.status(500).json({ error: 'Failed to reschedule appointment' });
  }
};

module.exports = {
  searchDoctors,
  holdSlot,
  confirmBooking,
  getAppointments,
  cancelAppointment,
  rescheduleAppointment
};
