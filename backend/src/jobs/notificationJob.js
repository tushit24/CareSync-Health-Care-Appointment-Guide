/**
 * notificationJob.js
 * ------------------
 * Processes pending notification_log rows every 15 minutes.
 *
 * EMAIL channel: sends real emails via emailService.
 * CALENDAR channel: creates/deletes Google Calendar events via calendarService.
 *
 * Retry logic: exponential-ish backoff — attempt N waits N×5 min since creation.
 * After 3 failed attempts: marks row FAILED (never silently dropped).
 */

const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const {
  sendEmail,
  bookingConfirmationEmail,
  bookingConfirmationDoctorEmail,
  cancellationEmail,
  appointmentReminderEmail
} = require('../services/emailService');
const {
  createCalendarEvent,
  deleteCalendarEvent
} = require('../services/calendarService');

const prisma = new PrismaClient();

/**
 * Exponential-ish backoff: attempt N waits N×5 minutes since createdAt.
 * Attempt 0 (first try) → no wait.
 */
function isReadyToRetry(log) {
  if (log.attempts === 0) return true;
  const waitMs = log.attempts * 5 * 60 * 1000;
  return Date.now() >= new Date(log.createdAt).getTime() + waitMs;
}

// ─── EMAIL handlers ───────────────────────────────────────────────────────────

async function processEmailLog(log) {
  const appt = log.appointment;
  if (!appt) throw new Error('Appointment relation missing on notification log');

  const patientName    = appt.patient.name;
  const patientEmail   = appt.patient.email;
  const doctorName     = appt.doctor.user.name;
  const doctorEmail    = appt.doctor.user.email;
  const specialisation = appt.doctor.specialisation;
  const date           = appt.slot.date.toISOString().split('T')[0];
  const startTime      = appt.slot.startTime;
  const endTime        = appt.slot.endTime;
  const symptoms       = appt.symptomsText;

  if (log.type === 'BOOKING_CONFIRMATION') {
    const ptTpl = bookingConfirmationEmail({ patientName, doctorName, specialisation, date, startTime, endTime });
    await sendEmail({ to: patientEmail, ...ptTpl });
    const drTpl = bookingConfirmationDoctorEmail({ patientName, patientEmail, doctorName, date, startTime, endTime, symptoms });
    await sendEmail({ to: doctorEmail, ...drTpl });
    return;
  }

  if (log.type === 'CANCELLATION') {
    const ptTpl = cancellationEmail({ recipientName: patientName, patientName, doctorName, date, startTime, cancelledBy: 'CareSync System' });
    await sendEmail({ to: patientEmail, ...ptTpl });
    const drTpl = cancellationEmail({ recipientName: `Dr. ${doctorName}`, patientName, doctorName, date, startTime, cancelledBy: 'CareSync System' });
    await sendEmail({ to: doctorEmail, ...drTpl });
    return;
  }

  if (log.type === 'REMINDER') {
    const ptTpl = appointmentReminderEmail({ patientName, doctorName, specialisation, date, startTime });
    await sendEmail({ to: patientEmail, ...ptTpl });
    return;
  }

  console.warn(`[Notification Worker] Unhandled EMAIL type "${log.type}" for log ${log.id}`);
}

// ─── CALENDAR handlers ────────────────────────────────────────────────────────

async function processCalendarLog(log) {
  const appt = log.appointment;
  if (!appt) {
    console.warn(`[Notification Worker] No appointment for CALENDAR log ${log.id} — skipping`);
    return; // Nothing to do, mark as SENT below
  }

  const patientRefreshToken = appt.patient.googleRefreshToken;
  const doctorRefreshToken  = appt.doctor.user.googleRefreshToken;

  const slotDate    = appt.slot.date;
  const startTime   = appt.slot.startTime;
  const endTime     = appt.slot.endTime;
  const patientName = appt.patient.name;
  const doctorName  = appt.doctor.user.name;
  const specialisation = appt.doctor.specialisation;
  const symptoms    = appt.symptomsText || 'N/A';

  if (log.type === 'BOOKING_CONFIRMATION') {
    let patientEventId = null;
    let doctorEventId  = null;

    if (patientRefreshToken) {
      patientEventId = await createCalendarEvent(patientRefreshToken, {
        summary: `Appointment with Dr. ${doctorName} (${specialisation})`,
        description: `CareSync appointment\nSymptoms: ${symptoms}`,
        slotDate, startTime, endTime,
        attendeeEmail: appt.patient.email
      });
      console.log(`[Notification Worker] Created patient calendar event ${patientEventId}`);
    }

    if (doctorRefreshToken) {
      doctorEventId = await createCalendarEvent(doctorRefreshToken, {
        summary: `Appointment with ${patientName}`,
        description: `CareSync appointment\nPatient: ${appt.patient.email}\nSymptoms: ${symptoms}`,
        slotDate, startTime, endTime,
        attendeeEmail: appt.doctor.user.email
      });
      console.log(`[Notification Worker] Created doctor calendar event ${doctorEventId}`);
    }

    // Store event IDs on the appointment (may be null if calendar not connected)
    if (patientEventId || doctorEventId) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          patientCalendarEventId: patientEventId,
          doctorCalendarEventId:  doctorEventId
        }
      });
    }
    return;
  }

  if (log.type === 'CANCELLATION') {
    const patientEventId = appt.patientCalendarEventId;
    const doctorEventId  = appt.doctorCalendarEventId;

    if (patientRefreshToken && patientEventId) {
      await deleteCalendarEvent(patientRefreshToken, patientEventId);
      console.log(`[Notification Worker] Deleted patient calendar event ${patientEventId}`);
    }

    if (doctorRefreshToken && doctorEventId) {
      await deleteCalendarEvent(doctorRefreshToken, doctorEventId);
      console.log(`[Notification Worker] Deleted doctor calendar event ${doctorEventId}`);
    }

    // Clear stored event IDs
    if (patientEventId || doctorEventId) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { patientCalendarEventId: null, doctorCalendarEventId: null }
      });
    }
    return;
  }

  console.warn(`[Notification Worker] Unhandled CALENDAR type "${log.type}" for log ${log.id}`);
}

// ─── Main cron ────────────────────────────────────────────────────────────────

const startNotificationWorker = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const pendingLogs = await prisma.notificationLog.findMany({
        where: {
          status: 'PENDING',
          attempts: { lt: 3 }
        },
        include: {
          appointment: {
            include: {
              patient: {
                select: { name: true, email: true, googleRefreshToken: true }
              },
              doctor: {
                select: {
                  specialisation: true,
                  user: { select: { name: true, email: true, googleRefreshToken: true } }
                }
              },
              slot: { select: { date: true, startTime: true, endTime: true } }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (pendingLogs.length === 0) return;
      console.log(`[Notification Worker] ${pendingLogs.length} pending row(s) to process.`);

      for (const log of pendingLogs) {
        if (!isReadyToRetry(log)) continue;

        const nextAttempts = log.attempts + 1;

        try {
          if (log.channel === 'EMAIL') {
            console.log(`[Notification Worker] → ${log.type} EMAIL (attempt ${nextAttempts}) log=${log.id}`);
            await processEmailLog(log);
          } else if (log.channel === 'CALENDAR') {
            console.log(`[Notification Worker] → ${log.type} CALENDAR (attempt ${nextAttempts}) log=${log.id}`);
            await processCalendarLog(log);
          } else {
            console.warn(`[Notification Worker] Unknown channel "${log.channel}" for log ${log.id}`);
          }

          await prisma.notificationLog.update({
            where: { id: log.id },
            data: { status: 'SENT', attempts: nextAttempts, lastError: null }
          });
          console.log(`[Notification Worker] ✓ Sent log ${log.id}`);

        } catch (innerError) {
          const finalStatus = nextAttempts >= 3 ? 'FAILED' : 'PENDING';
          console.error(`[Notification Worker] ✗ Error on log ${log.id} (attempt ${nextAttempts}):`, innerError.message);
          await prisma.notificationLog.update({
            where: { id: log.id },
            data: {
              status: finalStatus,
              attempts: nextAttempts,
              lastError: innerError.message?.slice(0, 500) || 'Unknown error'
            }
          });
        }
      }
    } catch (error) {
      console.error('[Notification Worker] Outer DB error:', error.message);
    }
  });

  console.log('[Notification Worker] Scheduled — runs every 15 minutes.');
};

module.exports = { startNotificationWorker };
