/**
 * medicationReminderJob.js
 * ------------------------
 * Runs every 10 minutes.
 * Finds MedicationReminder rows due now (scheduledAt <= now, status = PENDING)
 * and sends a medication reminder email to the patient, then marks SENT or FAILED.
 */

const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendEmail, medicationReminderEmail } = require('../services/emailService');

const prisma = new PrismaClient();

const startMedicationReminderWorker = () => {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const now = new Date();

      const dueReminders = await prisma.medicationReminder.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: now }
        },
        include: {
          prescription: {
            include: {
              appointment: {
                include: {
                  patient: { select: { name: true, email: true } }
                }
              }
            }
          }
        },
        orderBy: { scheduledAt: 'asc' },
        take: 50 // process in batches
      });

      if (dueReminders.length === 0) return;

      console.log(`[Med Reminder Worker] ${dueReminders.length} due medication reminder(s) to process.`);

      for (const reminder of dueReminders) {
        try {
          const rx = reminder.prescription;
          const appt = rx.appointment;
          const patient = appt.patient;

          const template = medicationReminderEmail({
            patientName: patient.name,
            medicineName: rx.medicineName,
            dosage: rx.dosage,
            frequencyPerDay: rx.frequencyPerDay,
            scheduledAt: reminder.scheduledAt
          });

          await sendEmail({ to: patient.email, ...template });

          await prisma.medicationReminder.update({
            where: { id: reminder.id },
            data: { status: 'SENT' }
          });

          console.log(`[Med Reminder Worker] ✓ Sent reminder ${reminder.id} (${rx.medicineName}) to ${patient.email}`);
        } catch (innerError) {
          console.error(`[Med Reminder Worker] ✗ Error on reminder ${reminder.id}:`, innerError.message);
          await prisma.medicationReminder.update({
            where: { id: reminder.id },
            data: { status: 'FAILED' }
          });
        }
      }
    } catch (error) {
      console.error('[Med Reminder Worker] Outer error:', error.message);
    }
  });

  console.log('[Med Reminder Worker] Scheduled — runs every 10 minutes.');
};

module.exports = { startMedicationReminderWorker };
