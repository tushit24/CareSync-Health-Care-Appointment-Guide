/**
 * One-off script: run the notification worker body immediately
 * to flush all stuck PENDING rows without waiting for the 5-minute cron.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const {
  sendEmail,
  bookingConfirmationEmail,
  bookingConfirmationDoctorEmail,
  cancellationEmail,
  appointmentReminderEmail
} = require('./services/emailService');

const prisma = new PrismaClient();

function isReadyToRetry(log) {
  if (log.attempts === 0) return true;
  const waitMs = log.attempts * 5 * 60 * 1000;
  const readyAt = new Date(log.createdAt).getTime() + waitMs;
  return Date.now() >= readyAt;
}

async function processEmailLog(log) {
  const appt = log.appointment;
  if (!appt) throw new Error('Appointment relation missing');

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
}

(async () => {
  try {
    const pendingLogs = await prisma.notificationLog.findMany({
      where: { status: 'PENDING', attempts: { lt: 3 } },
      include: {
        appointment: {
          include: {
            patient: { select: { name: true, email: true } },
            doctor: {
              select: {
                specialisation: true,
                user: { select: { name: true, email: true } }
              }
            },
            slot: { select: { date: true, startTime: true, endTime: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${pendingLogs.length} pending logs.\n`);

    for (const log of pendingLogs) {
      if (!isReadyToRetry(log)) {
        console.log(`⏩ Skipping log ${log.id} (backoff not expired yet)`);
        continue;
      }

      const nextAttempts = log.attempts + 1;

      if (log.channel === 'CALENDAR') {
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: { status: 'SENT', attempts: nextAttempts, lastError: null }
        });
        console.log(`✓ CALENDAR stub for log ${log.id} — marked SENT`);
        continue;
      }

      try {
        console.log(`→ Processing ${log.type} EMAIL for log ${log.id} (attempt ${nextAttempts})...`);
        await processEmailLog(log);
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: { status: 'SENT', attempts: nextAttempts, lastError: null }
        });
        console.log(`✓ SENT log ${log.id}`);
      } catch (err) {
        const finalStatus = nextAttempts >= 3 ? 'FAILED' : 'PENDING';
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: { status: finalStatus, attempts: nextAttempts, lastError: err.message?.slice(0, 500) }
        });
        console.error(`✗ Error on log ${log.id}: ${err.message} → status set to ${finalStatus}`);
      }
    }

    // Final status report
    const remaining = await prisma.notificationLog.findMany({
      where: { status: 'PENDING', attempts: { lt: 3 } },
      select: { id: true }
    });
    console.log(`\nDone. Remaining PENDING rows: ${remaining.length}`);
  } catch (e) {
    console.error('Fatal error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
