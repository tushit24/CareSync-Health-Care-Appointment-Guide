const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000';

async function runTest() {
  console.log('=== STARTING GROQ FAILURE PATH TEST ===');

  // 1. Get a test doctor
  const doctor = await prisma.doctorProfile.findFirst({
    include: { user: true }
  });

  if (!doctor) {
    console.error('No doctors found. Run seed script first.');
    process.exit(1);
  }

  // 2. Login/Get token for patient
  const patientEmail = 'patient_concurrency@test.com';
  const patientPassword = 'TestPassword123!';
  let token = '';

  console.log('Logging in patient...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: patientEmail, password: patientPassword })
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed:', loginData);
    process.exit(1);
  }
  token = loginData.token;

  // 3. Create a clean test slot
  const slotDate = new Date();
  slotDate.setDate(slotDate.getDate() + 3);
  const startTime = `14:${String(Math.floor(Math.random() * 50) + 10)}`;
  
  const slot = await prisma.slot.create({
    data: {
      doctorId: doctor.id,
      date: slotDate,
      startTime,
      endTime: '15:00',
      status: 'OPEN'
    }
  });
  console.log('Seeded slot ID:', slot.id);

  // 4. Hold slot
  const holdRes = await fetch(`${BASE_URL}/api/patient/slots/${slot.id}/hold`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Hold status:', holdRes.status);

  // 5. Confirm slot booking with symptoms
  console.log('Confirming booking (this should fail Groq call and trigger fallback)...');
  const confirmRes = await fetch(`${BASE_URL}/api/patient/slots/${slot.id}/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ symptomsText: 'Severe migraine headache for 2 days.' })
  });

  const confirmData = await confirmRes.json();
  console.log('Confirm response status:', confirmRes.status);
  console.log('Confirm response payload:', JSON.stringify(confirmData, null, 2));

  // 6. Verify fallback values in database
  const appt = await prisma.appointment.findFirst({
    where: { slotId: slot.id }
  });

  console.log('=== VERIFYING APPOINTMENT RECORD IN DATABASE ===');
  console.log('Appointment ID:', appt.id);
  console.log('Urgency Level (expected null):', appt.urgencyLevel);
  console.log('Pre-Visit Summary JSON (expected aiError: true):', appt.preVisitSummaryJson);

  if (appt.urgencyLevel === null && appt.preVisitSummaryJson && appt.preVisitSummaryJson.aiError === true) {
    console.log('✅ TEST PASSED: Fallback path correctly handles Groq failures.');
  } else {
    console.log('❌ TEST FAILED: Fallback path did not write expected error metadata.');
  }

  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
