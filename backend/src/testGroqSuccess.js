const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000';

async function runTest() {
  console.log('=== STARTING GROQ HAPPY PATH TEST ===');

  // 1. Get doctor
  const doctor = await prisma.doctorProfile.findFirst({
    include: { user: true }
  });

  // 2. Login patient
  const patientEmail = 'patient_concurrency@test.com';
  const patientPassword = 'TestPassword123!';
  let token = '';

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: patientEmail, password: patientPassword })
  });

  const loginData = await loginRes.json();
  token = loginData.token;

  // 3. Create test slot
  const slotDate = new Date();
  slotDate.setDate(slotDate.getDate() + 4);
  const startTime = `15:${String(Math.floor(Math.random() * 50) + 10)}`;
  
  const slot = await prisma.slot.create({
    data: {
      doctorId: doctor.id,
      date: slotDate,
      startTime,
      endTime: '16:00',
      status: 'OPEN'
    }
  });

  // 4. Hold
  await fetch(`${BASE_URL}/api/patient/slots/${slot.id}/hold`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  // 5. Confirm with symptoms
  console.log('Confirming booking with valid Groq key...');
  const confirmRes = await fetch(`${BASE_URL}/api/patient/slots/${slot.id}/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ symptomsText: 'High fever, sore throat, and trouble swallowing for 3 days.' })
  });

  const confirmData = await confirmRes.json();
  console.log('Confirm response status:', confirmRes.status);
  console.log('AI Pre-Visit Summary JSON:', JSON.stringify(confirmData.appointment.preVisitSummaryJson, null, 2));
  console.log('Urgency Level:', confirmData.appointment.urgencyLevel);

  // 6. Verify in database
  const appt = await prisma.appointment.findFirst({
    where: { slotId: slot.id }
  });

  if (appt.urgencyLevel && appt.preVisitSummaryJson && !appt.preVisitSummaryJson.aiError) {
    console.log('✅ TEST PASSED: Happy path symptom analysis completed successfully.');
  } else {
    console.log('❌ TEST FAILED: Pre-visit summary not generated correctly.');
  }

  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
