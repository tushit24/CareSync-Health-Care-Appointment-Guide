const { PrismaClient } = require('@prisma/client');
const Groq = require('groq-sdk');

const prisma = new PrismaClient();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Generate MedicationReminder data objects for a prescription.
 * Doses are spaced evenly across a waking window (08:00–22:00 local time).
 * Day 1 = tomorrow, to avoid scheduling reminders in the past.
 *
 * @param {string} prescriptionId
 * @param {number} frequencyPerDay  e.g. 3
 * @param {number} durationDays     e.g. 7
 * @returns {{ prescriptionId: string, scheduledAt: Date }[]}
 */
function generateMedicationReminders(prescriptionId, frequencyPerDay, durationDays) {
  const WINDOW_START_HOUR = 8;   // 08:00
  const WINDOW_END_HOUR   = 22;  // 22:00
  const windowMinutes = (WINDOW_END_HOUR - WINDOW_START_HOUR) * 60; // 840 min

  const reminders = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= durationDays; day++) {
    const date = new Date(today);
    date.setDate(today.getDate() + day); // start tomorrow

    for (let dose = 0; dose < frequencyPerDay; dose++) {
      // Space doses evenly; if freq=1 put it at start of window
      const offsetMinutes = frequencyPerDay === 1
        ? 0
        : Math.round((dose / (frequencyPerDay - 1)) * windowMinutes);

      const totalMinutes = WINDOW_START_HOUR * 60 + offsetMinutes;
      const scheduledAt = new Date(date);
      scheduledAt.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);

      reminders.push({ prescriptionId, scheduledAt });
    }
  }

  return reminders;
}

// Helper to summarize clinical notes using Groq API
async function summarizeClinicalNotes(doctorNotes) {
  if (!doctorNotes || !doctorNotes.trim()) {
    return 'No clinical notes provided.';
  }

  try {
    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'user',
          content: `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${doctorNotes}`
        }
      ]
    });

    return response.choices[0].message.content || 'Notes summary completed.';
  } catch (error) {
    console.error('Groq clinical notes summarization error:', error);
    return 'AI summary unavailable, please review clinical notes manually.';
  }
}

// Get all confirmed or completed appointments for the logged-in doctor
const getDoctorAppointments = async (req, res) => {
  try {
    const doctorUserId = req.user.userId;

    // Find the doctor profile associated with the user
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: doctorUserId }
    });

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctorProfile.id,
        status: { in: ['CONFIRMED', 'COMPLETED', 'CANCELLED'] }
      },
      include: {
        slot: true,
        patient: {
          select: {
            name: true,
            email: true,
            phone: true
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
      patientName: appt.patient.name,
      patientEmail: appt.patient.email,
      patientPhone: appt.patient.phone,
      date: appt.slot.date.toISOString().split('T')[0],
      startTime: appt.slot.startTime,
      endTime: appt.slot.endTime,
      status: appt.status,
      symptomsText: appt.symptomsText,
      preVisitSummaryJson: appt.preVisitSummaryJson,
      urgencyLevel: appt.urgencyLevel,
      doctorNotes: appt.doctorNotes,
      prescriptionJson: appt.prescriptionJson,
      postVisitSummaryText: appt.postVisitSummaryText
    }));

    res.status(200).json({ appointments: formatted });
  } catch (error) {
    console.error('Get doctor appointments error:', error);
    res.status(500).json({ error: 'Failed to retrieve doctor appointments' });
  }
};

// Cancel a confirmed future appointment by doctor
const cancelDoctorAppointment = async (req, res) => {
  const appointmentId = req.params.id;
  const doctorUserId = req.user.userId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const doctorProfile = await tx.doctorProfile.findUnique({
        where: { userId: doctorUserId }
      });

      if (!doctorProfile) {
        throw new Error('DOCTOR_PROFILE_NOT_FOUND');
      }

      const appt = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { slot: true }
      });

      if (!appt) {
        throw new Error('APPOINTMENT_NOT_FOUND');
      }

      if (appt.doctorId !== doctorProfile.id) {
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
    console.error('Doctor cancel appointment error:', error.message);
    if (error.message === 'DOCTOR_PROFILE_NOT_FOUND' || error.message === 'UNAUTHORIZED') {
      return res.status(403).json({ error: 'Unauthorized to cancel this appointment' });
    }
    if (error.message === 'APPOINTMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    if (error.message === 'CANNOT_CANCEL_STATUS' || error.message === 'CANNOT_CANCEL_PAST_APPOINTMENT') {
      return res.status(400).json({ error: 'Only future confirmed appointments can be cancelled' });
    }
    res.status(500).json({ error: 'Failed to cancel appointment due to server error' });
  }
};

// Complete an appointment - writes notes, calls Groq AI summarizer, saves prescriptions
const completeAppointment = async (req, res) => {
  const appointmentId = req.params.id;
  const doctorUserId = req.user.userId;
  const { doctorNotes, prescription } = req.body; // prescription = array: [{ medicineName, dosage, frequencyPerDay, durationDays }]

  try {
    // 1. Fetch doctor profile
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: doctorUserId }
    });

    if (!doctorProfile) {
      return res.status(403).json({ error: 'Doctor profile not found' });
    }

    // 2. Pre-verify appointment status before triggering Groq network calls
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId }
    });

    if (!appt) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appt.doctorId !== doctorProfile.id) {
      return res.status(403).json({ error: 'Unauthorized: this appointment belongs to another doctor' });
    }

    if (appt.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Only confirmed appointments can be completed' });
    }

    // 3. Call Groq completions API to generate patient-friendly summary BEFORE db transaction
    const summaryText = await summarizeClinicalNotes(doctorNotes);

    // 4. Update status and save data inside database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Re-verify appointment status under transaction row lock
      const lockedAppt = await tx.appointment.findUnique({
        where: { id: appointmentId }
      });

      if (lockedAppt.status !== 'CONFIRMED') {
        throw new Error('APPOINTMENT_NOT_CONFIRMED');
      }

      // Update Appointment model
      const updatedAppt = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'COMPLETED',
          doctorNotes,
          prescriptionJson: prescription || null,
          postVisitSummaryText: summaryText
        }
      });

      // Insert separate Prescription relation rows + generate MedicationReminder schedule
      if (prescription && Array.isArray(prescription)) {
        for (const item of prescription) {
          const rxRow = await tx.prescription.create({
            data: {
              appointmentId,
              medicineName: item.medicineName,
              dosage: item.dosage,
              frequencyPerDay: Number(item.frequencyPerDay) || 1,
              durationDays: Number(item.durationDays) || 5
            }
          });

          // Generate MedicationReminder rows spaced evenly across 08:00–22:00
          // Day 1 = tomorrow (to avoid scheduling in the past)
          const reminders = generateMedicationReminders(
            rxRow.id,
            Number(item.frequencyPerDay) || 1,
            Number(item.durationDays) || 5
          );
          if (reminders.length > 0) {
            await tx.medicationReminder.createMany({ data: reminders });
          }
        }
      }

      return updatedAppt;
    });

    res.status(200).json({
      message: 'Appointment completed successfully',
      appointment: result
    });

  } catch (error) {
    console.error('Complete appointment error:', error);
    if (error.message === 'APPOINTMENT_NOT_CONFIRMED') {
      return res.status(400).json({ error: 'Only confirmed appointments can be completed' });
    }
    res.status(500).json({ error: 'Failed to complete appointment due to server error' });
  }
};

module.exports = {
  getDoctorAppointments,
  cancelDoctorAppointment,
  completeAppointment
};
