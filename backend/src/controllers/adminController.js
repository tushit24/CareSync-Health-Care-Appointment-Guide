const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Helper to generate slots for next 30 days based on working hours and leaves
async function generateDoctorSlots(doctorId, slotDurationMinutes) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { leaves: true, workingHours: true }
  });

  if (!doctor) return;

  const now = new Date();
  
  // Create a set of leave date strings (formatted as YYYY-MM-DD)
  const leaveDates = new Set(
    doctor.leaves.map(l => {
      // Ensure date is formatted correctly in local timezone yyyy-mm-dd
      const d = new Date(l.date);
      return d.toISOString().split('T')[0];
    })
  );

  // Map working hours by day of week for quick access
  const workingHoursMap = {};
  doctor.workingHours.forEach(wh => {
    if (!workingHoursMap[wh.dayOfWeek]) {
      workingHoursMap[wh.dayOfWeek] = [];
    }
    workingHoursMap[wh.dayOfWeek].push(wh);
  });

  const slotsToCreate = [];

  // Loop for the next 30 days starting from today
  for (let i = 0; i < 30; i++) {
    const currentDate = new Date();
    currentDate.setDate(now.getDate() + i);
    
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Skip leave days
    if (leaveDates.has(dateStr)) continue;

    const dayOfWeek = currentDate.getDay(); // 0 (Sunday) to 6 (Saturday)
    const hoursList = workingHoursMap[dayOfWeek];

    if (!hoursList || hoursList.length === 0) continue;

    // For each working hours block on this day
    for (const block of hoursList) {
      // Parse start and end times to minutes
      const [startHour, startMin] = block.startTime.split(':').map(Number);
      const [endHour, endMin] = block.endTime.split(':').map(Number);

      let currentMin = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      while (currentMin + slotDurationMinutes <= endMinutes) {
        const slotStartHour = Math.floor(currentMin / 60);
        const slotStartMin = currentMin % 60;
        
        const slotEndHour = Math.floor((currentMin + slotDurationMinutes) / 60);
        const slotEndMin = (currentMin + slotDurationMinutes) % 60;

        const startTimeStr = `${String(slotStartHour).padStart(2, '0')}:${String(slotStartMin).padStart(2, '0')}`;
        const endTimeStr = `${String(slotEndHour).padStart(2, '0')}:${String(slotEndMin).padStart(2, '0')}`;

        slotsToCreate.push({
          doctorId,
          date: new Date(dateStr), // YYYY-MM-DD date object
          startTime: startTimeStr,
          endTime: endTimeStr
        });

        currentMin += slotDurationMinutes;
      }
    }
  }

  // Transactionally check and create slots to prevent breaking UNIQUE constraint
  for (const slot of slotsToCreate) {
    try {
      // Use upsert to avoid unique constraint violations
      await prisma.slot.upsert({
        where: {
          doctorId_date_startTime: {
            doctorId: slot.doctorId,
            date: slot.date,
            startTime: slot.startTime
          }
        },
        update: {}, // If it exists, do not modify (retain HELD or BOOKED state)
        create: {
          doctorId: slot.doctorId,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: 'OPEN'
        }
      });
    } catch (err) {
      console.error(`Failed to upsert slot for ${slot.startTime} on ${slot.date.toISOString().split('T')[0]}:`, err);
    }
  }
}

// 1. Create Doctor profile and User account
const createDoctor = async (req, res) => {
  try {
    const { name, email, password, phone, specialisation, bio, slotDurationMinutes } = req.body;

    if (!name || !email || !password || !specialisation) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password, specialisation' });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          passwordHash,
          role: 'DOCTOR',
          phone
        }
      });

      const doctorProfile = await tx.doctorProfile.create({
        data: {
          userId: user.id,
          specialisation,
          bio,
          slotDurationMinutes: Number(slotDurationMinutes) || 30
        }
      });

      return { user, doctorProfile };
    });

    res.status(201).json({
      message: 'Doctor account and profile created successfully',
      doctor: {
        id: result.doctorProfile.id,
        userId: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        specialisation: result.doctorProfile.specialisation,
        bio: result.doctorProfile.bio,
        slotDurationMinutes: result.doctorProfile.slotDurationMinutes
      }
    });
  } catch (error) {
    console.error('Create doctor error:', error);
    res.status(500).json({ error: 'Failed to create doctor account' });
  }
};

// 2. List all doctors with detailed working hours and leaves
const listDoctors = async (req, res) => {
  try {
    const doctors = await prisma.doctorProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        workingHours: true,
        leaves: true
      }
    });

    // Format output
    const formatted = doctors.map(d => ({
      id: d.id,
      userId: d.user.id,
      name: d.user.name,
      email: d.user.email,
      phone: d.user.phone,
      specialisation: d.specialisation,
      bio: d.bio,
      slotDurationMinutes: d.slotDurationMinutes,
      workingHours: d.workingHours.map(w => ({
        id: w.id,
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime
      })),
      leaves: d.leaves.map(l => ({
        id: l.id,
        date: l.date.toISOString().split('T')[0],
        reason: l.reason
      }))
    }));

    res.status(200).json({ doctors: formatted });
  } catch (error) {
    console.error('List doctors error:', error);
    res.status(500).json({ error: 'Failed to retrieve doctor profiles' });
  }
};

// 3. Set Working Hours and Generate slots
const setWorkingHours = async (req, res) => {
  try {
    const { id } = req.params; // doctorProfile id
    const { workingHours } = req.body; // Array: [{ dayOfWeek, startTime, endTime }]

    if (!workingHours || !Array.isArray(workingHours)) {
      return res.status(400).json({ error: 'Invalid payload: workingHours array is required' });
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id }
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    // Save working hours inside transaction
    await prisma.$transaction(async (tx) => {
      // Clear current working hours
      await tx.doctorWorkingHours.deleteMany({
        where: { doctorId: id }
      });

      // Insert new working hours
      if (workingHours.length > 0) {
        await tx.doctorWorkingHours.createMany({
          data: workingHours.map(wh => ({
            doctorId: id,
            dayOfWeek: Number(wh.dayOfWeek),
            startTime: wh.startTime,
            endTime: wh.endTime
          }))
        });
      }
    });

    // Trigger slot generation for the next 30 days
    await generateDoctorSlots(id, doctor.slotDurationMinutes);

    res.status(200).json({ message: 'Working hours saved and slots generated successfully' });
  } catch (error) {
    console.error('Set working hours error:', error);
    res.status(500).json({ error: 'Failed to save working hours and generate slots' });
  }
};

// 4. Mark Doctor Leave and cancel conflicting slots / appointments
const markLeave = async (req, res) => {
  try {
    const { id } = req.params; // doctorProfile id
    const { date, reason } = req.body; // date = "YYYY-MM-DD"

    if (!date) {
      return res.status(400).json({ error: 'Leave date is required' });
    }

    const leaveDate = new Date(date);
    const dateStr = leaveDate.toISOString().split('T')[0];

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id }
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    // Check if leave already exists
    const existingLeave = await prisma.doctorLeave.findFirst({
      where: {
        doctorId: id,
        date: leaveDate
      }
    });

    if (existingLeave) {
      return res.status(400).json({ error: 'Leave day already marked for this date' });
    }

    // Transaction to mark leave and handle cancellations
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Leave Record
      const leave = await tx.doctorLeave.create({
        data: {
          doctorId: id,
          date: leaveDate,
          reason
        }
      });

      // 2. Fetch all slots on this date for the doctor
      const slots = await tx.slot.findMany({
        where: {
          doctorId: id,
          date: leaveDate
        },
        include: {
          appointment: true
        }
      });

      let cancelledBookingsCount = 0;

      // 3. Process each slot
      for (const slot of slots) {
        if (slot.status === 'BOOKED' && slot.appointment) {
          // Cancel Appointment
          await tx.appointment.update({
            where: { id: slot.appointment.id },
            data: { status: 'CANCELLED' }
          });

          // Log Notification logs for CANCELLATION (both Email and Calendar)
          // Email Notification log
          await tx.notificationLog.create({
            data: {
              appointmentId: slot.appointment.id,
              type: 'CANCELLATION',
              channel: 'EMAIL',
              status: 'PENDING'
            }
          });

          // Calendar Notification log
          await tx.notificationLog.create({
            data: {
              appointmentId: slot.appointment.id,
              type: 'CANCELLATION',
              channel: 'CALENDAR',
              status: 'PENDING'
            }
          });

          cancelledBookingsCount++;
        }

        // Update Slot status to CANCELLED (or delete it, but CANCELLED is safer)
        await tx.slot.update({
          where: { id: slot.id },
          data: { status: 'CANCELLED' }
        });
      }

      return { leave, cancelledBookingsCount };
    });

    res.status(201).json({
      message: 'Doctor leave marked successfully',
      leave: result.leave,
      cancelledAppointments: result.cancelledBookingsCount
    });
  } catch (error) {
    console.error('Mark leave error:', error);
    res.status(500).json({ error: 'Failed to record leave day' });
  }
};

// 5. Get notification logs for admin visibility
const getNotificationLogs = async (req, res) => {
  try {
    const logs = await prisma.notificationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        appointment: {
          include: {
            patient: { select: { name: true, email: true } },
            doctor: {
              include: {
                user: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    const formatted = logs.map(l => ({
      id: l.id,
      type: l.type,
      channel: l.channel,
      status: l.status,
      attempts: l.attempts,
      lastError: l.lastError,
      createdAt: l.createdAt,
      patientName: l.appointment?.patient?.name || null,
      patientEmail: l.appointment?.patient?.email || null,
      doctorName: l.appointment?.doctor?.user?.name || null
    }));

    res.status(200).json({ logs: formatted });
  } catch (error) {
    console.error('Get notification logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve notification logs' });
  }
};

module.exports = {
  createDoctor,
  listDoctors,
  setWorkingHours,
  markLeave,
  getNotificationLogs
};
