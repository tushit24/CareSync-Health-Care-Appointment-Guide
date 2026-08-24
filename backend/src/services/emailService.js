/**
 * emailService.js
 * ---------------
 * Nodemailer transporter using Gmail App Password (SMTP).
 * To swap to SendGrid: replace the createTransport config below with
 *   nodemailer.createTransport(sgTransport({ apiKey: process.env.SENDGRID_API_KEY }))
 * and keep all template functions / sendEmail signature identical.
 */

const nodemailer = require('nodemailer');

// ─── Transporter ─────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

/**
 * Send a single email.
 * @param {{ to: string, subject: string, html: string }} opts
 */
async function sendEmail({ to, subject, html }) {
  await transporter.sendMail({
    from: `"CareSync Health" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html
  });
}

// ─── Shared layout ────────────────────────────────────────────────────────────
function layout(title, bodyContent) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { margin:0; padding:0; background:#0f172a; font-family:'Segoe UI',Arial,sans-serif; color:#e2e8f0; }
    .container { max-width:600px; margin:0 auto; padding:32px 16px; }
    .card { background:#1e293b; border-radius:12px; padding:32px; border:1px solid #334155; }
    .logo { font-size:22px; font-weight:800; color:#818cf8; letter-spacing:-0.5px; margin-bottom:24px; }
    h1 { font-size:20px; font-weight:700; color:#f1f5f9; margin:0 0 8px; }
    .subtitle { color:#94a3b8; font-size:14px; margin:0 0 24px; }
    .info-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #334155; }
    .info-label { color:#64748b; font-size:13px; }
    .info-value { color:#e2e8f0; font-size:13px; font-weight:600; }
    .badge { display:inline-block; padding:4px 12px; border-radius:999px; font-size:12px; font-weight:700; }
    .badge-confirmed { background:#1e3a5f; color:#93c5fd; }
    .badge-cancelled { background:#450a0a; color:#fca5a5; }
    .badge-reminder { background:#1c3329; color:#86efac; }
    .pill { background:#312e81; color:#a5b4fc; border-radius:6px; padding:2px 8px; font-size:12px; }
    .footer { text-align:center; color:#475569; font-size:12px; margin-top:24px; }
    .divider { border:none; border-top:1px solid #334155; margin:20px 0; }
    .btn { display:inline-block; background:#6366f1; color:#fff !important; text-decoration:none;
           padding:12px 24px; border-radius:8px; font-weight:600; font-size:14px; margin-top:16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">⚕ CareSync</div>
    <div class="card">
      ${bodyContent}
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} CareSync Health Platform · This is an automated message, please do not reply.
    </div>
  </div>
</body>
</html>`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

/**
 * Booking confirmation for the patient.
 */
function bookingConfirmationEmail({ patientName, doctorName, specialisation, date, startTime, endTime }) {
  const body = `
    <h1>Appointment Confirmed ✓</h1>
    <p class="subtitle">Your appointment has been successfully booked.</p>
    <div class="info-row"><span class="info-label">Patient</span><span class="info-value">${patientName}</span></div>
    <div class="info-row"><span class="info-label">Doctor</span><span class="info-value">Dr. ${doctorName}</span></div>
    <div class="info-row"><span class="info-label">Specialisation</span><span class="info-value">${specialisation}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span class="info-value">${date}</span></div>
    <div class="info-row"><span class="info-label">Time</span><span class="info-value">${startTime} – ${endTime}</span></div>
    <hr class="divider"/>
    <p style="color:#94a3b8;font-size:13px;margin:0;">Please arrive 10 minutes early. You will receive a reminder 24 hours before your appointment.</p>
    <span class="badge badge-confirmed">CONFIRMED</span>`;
  return { subject: `Appointment Confirmed – Dr. ${doctorName} on ${date}`, html: layout('Appointment Confirmed', body) };
}

/**
 * Booking notification for the doctor.
 */
function bookingConfirmationDoctorEmail({ patientName, patientEmail, doctorName, date, startTime, endTime, symptoms }) {
  const symptomsHtml = symptoms
    ? `<div class="info-row"><span class="info-label">Symptoms</span><span class="info-value" style="max-width:300px;text-align:right;">${symptoms}</span></div>`
    : '';
  const body = `
    <h1>New Appointment Booked</h1>
    <p class="subtitle">A patient has booked a slot in your schedule.</p>
    <div class="info-row"><span class="info-label">Patient</span><span class="info-value">${patientName}</span></div>
    <div class="info-row"><span class="info-label">Email</span><span class="info-value">${patientEmail}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span class="info-value">${date}</span></div>
    <div class="info-row"><span class="info-label">Time</span><span class="info-value">${startTime} – ${endTime}</span></div>
    ${symptomsHtml}`;
  return { subject: `New Patient Booking – ${patientName} on ${date}`, html: layout('New Booking', body) };
}

/**
 * Cancellation email — works for both patient and doctor recipient.
 */
function cancellationEmail({ recipientName, patientName, doctorName, date, startTime, cancelledBy }) {
  const body = `
    <h1>Appointment Cancelled</h1>
    <p class="subtitle">Hi ${recipientName}, an appointment has been cancelled.</p>
    <div class="info-row"><span class="info-label">Patient</span><span class="info-value">${patientName}</span></div>
    <div class="info-row"><span class="info-label">Doctor</span><span class="info-value">Dr. ${doctorName}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span class="info-value">${date}</span></div>
    <div class="info-row"><span class="info-label">Time</span><span class="info-value">${startTime}</span></div>
    <div class="info-row"><span class="info-label">Cancelled by</span><span class="info-value">${cancelledBy}</span></div>
    <hr class="divider"/>
    <p style="color:#94a3b8;font-size:13px;margin:0;">If you are the patient, you may rebook a new slot at your convenience.</p>
    <span class="badge badge-cancelled">CANCELLED</span>`;
  return { subject: `Appointment Cancelled – Dr. ${doctorName} on ${date}`, html: layout('Appointment Cancelled', body) };
}

/**
 * 24-hour reminder for patient.
 */
function appointmentReminderEmail({ patientName, doctorName, specialisation, date, startTime }) {
  const body = `
    <h1>Reminder: Appointment Tomorrow</h1>
    <p class="subtitle">Hi ${patientName}, your appointment is coming up in approximately 24 hours.</p>
    <div class="info-row"><span class="info-label">Doctor</span><span class="info-value">Dr. ${doctorName}</span></div>
    <div class="info-row"><span class="info-label">Specialisation</span><span class="info-value">${specialisation}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span class="info-value">${date}</span></div>
    <div class="info-row"><span class="info-label">Time</span><span class="info-value">${startTime}</span></div>
    <hr class="divider"/>
    <p style="color:#94a3b8;font-size:13px;margin:0;">Please ensure you have noted your symptoms and any questions for the doctor.</p>
    <span class="badge badge-reminder">REMINDER</span>`;
  return { subject: `Reminder: Appointment with Dr. ${doctorName} Tomorrow at ${startTime}`, html: layout('Appointment Reminder', body) };
}

/**
 * Medication dose reminder for patient.
 */
function medicationReminderEmail({ patientName, medicineName, dosage, frequencyPerDay, scheduledAt }) {
  const timeStr = new Date(scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const body = `
    <h1>Medication Reminder 💊</h1>
    <p class="subtitle">Hi ${patientName}, it's time for your medication.</p>
    <div class="info-row"><span class="info-label">Medicine</span><span class="info-value">${medicineName}</span></div>
    <div class="info-row"><span class="info-label">Dosage</span><span class="info-value">${dosage}</span></div>
    <div class="info-row"><span class="info-label">Frequency</span><span class="info-value">${frequencyPerDay}× per day</span></div>
    <div class="info-row"><span class="info-label">Scheduled</span><span class="info-value">${timeStr}</span></div>
    <hr class="divider"/>
    <p style="color:#94a3b8;font-size:13px;margin:0;">Take your medication as prescribed. Contact your doctor if you experience any side effects.</p>
    <span class="badge badge-reminder">MED REMINDER</span>`;
  return { subject: `Medication Reminder: ${medicineName} – ${timeStr}`, html: layout('Medication Reminder', body) };
}

module.exports = {
  sendEmail,
  bookingConfirmationEmail,
  bookingConfirmationDoctorEmail,
  cancellationEmail,
  appointmentReminderEmail,
  medicationReminderEmail
};
