/**
 * appointmentReminderJob.js
 * -------------------------
 * Runs every 15 minutes.
 * Finds CONFIRMED appointments in the 23h–25h window from now and
 * enqueues a REMINDER notification_log row if one doesn't already exist.
 * The notificationJob picks up and sends the actual email.
 */

const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const startAppointmentReminderWorker = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // now + 23h
      const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000); // now + 25h

      // Find all CONFIRMED appointments
      const appointments = await prisma.appointment.findMany({
        where: { status: 'CONFIRMED' },
        include: {
          slot: { select: { date: true, startTime: true } },
          notifications: { where: { type: 'REMINDER' }, select: { id: true } }
        }
      });

      let enqueued = 0;

      for (const appt of appointments) {
        // Skip if a REMINDER log already exists
        if (appt.notifications.length > 0) continue;

        // Reconstruct local appointment DateTime from slot date + startTime string
        const slotDate = new Date(appt.slot.date);
        const [sh, sm] = appt.slot.startTime.split(':').map(Number);
        const apptDateTime = new Date(
          slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate(), sh, sm
        );

        if (apptDateTime >= windowStart && apptDateTime <= windowEnd) {
          await prisma.notificationLog.create({
            data: {
              appointmentId: appt.id,
              type: 'REMINDER',
              channel: 'EMAIL',
              status: 'PENDING'
            }
          });
          enqueued++;
          console.log(`[Reminder Worker] Enqueued REMINDER for appointment ${appt.id} at ${appt.slot.startTime} on ${appt.slot.date.toISOString().split('T')[0]}`);
        }
      }

      if (enqueued > 0) {
        console.log(`[Reminder Worker] Enqueued ${enqueued} appointment reminder(s).`);
      }
    } catch (error) {
      console.error('[Reminder Worker] Error:', error.message);
    }
  });

  console.log('[Reminder Worker] Scheduled — runs every 15 minutes.');
};

module.exports = { startAppointmentReminderWorker };
