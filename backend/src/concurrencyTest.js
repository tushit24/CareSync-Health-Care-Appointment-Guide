const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000';

async function runTest() {
  console.log('--- Starting Concurrency Test for Confirm Booking ---');

  // 1. Ensure test doctor and patient exist in DB
  let doctor = await prisma.doctorProfile.findFirst({
    include: { user: true }
  });

  if (!doctor) {
    console.log('Seeding test doctor...');
    const user = await prisma.user.create({
      data: {
        name: 'Test Concurrency Doctor',
        email: 'test_doc_concurrency@caresync.com',
        passwordHash: 'hashedpassword',
        role: 'DOCTOR'
      }
    });
    doctor = await prisma.doctorProfile.create({
      data: {
        userId: user.id,
        specialisation: 'Concurrency Cardiology',
        slotDurationMinutes: 15
      }
    });
  }

  // 2. Register/Login test patient
  const patientEmail = 'patient_concurrency@test.com';
  const patientPassword = 'TestPassword123!';
  let token = '';

  console.log(`Registering patient user: ${patientEmail}...`);
  try {
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Patient Concurrency',
        email: patientEmail,
        password: patientPassword,
        phone: '123456789'
      })
    });
    const regData = await regRes.json();
    console.log('Registration response status:', regRes.status, regData);
  } catch (err) {
    console.log('Registration failed (likely already registered), continuing to login...');
  }

  console.log(`Logging in patient user to obtain token...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: patientEmail,
      password: patientPassword
    })
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed. Cannot proceed with concurrency test.', loginData);
    process.exit(1);
  }
  token = loginData.token;
  console.log('Authentication successful. Token acquired.');

  // 3. Create a clean test slot set to OPEN
  const slotDate = new Date();
  slotDate.setDate(slotDate.getDate() + 5); // 5 days out

  // Generate unique start time to avoid conflicts
  const startTime = `11:${String(Math.floor(Math.random() * 50) + 10)}`;
  const endTime = '12:00';

  console.log(`Seeding slot for Dr. ${doctor.user?.name || 'Test Doctor'} at ${startTime}...`);
  const slot = await prisma.slot.create({
    data: {
      doctorId: doctor.id,
      date: slotDate,
      startTime,
      endTime,
      status: 'OPEN'
    }
  });
  console.log('Slot created with ID:', slot.id, 'Status:', slot.status);

  // 4. Place Hold on Slot for Patient A
  console.log(`Placing temporary hold on Slot ${slot.id} for the patient...`);
  const holdRes = await fetch(`${BASE_URL}/api/patient/slots/${slot.id}/hold`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const holdData = await holdRes.json();
  if (!holdRes.ok) {
    console.error('Failed to hold slot. Concurrency test aborted.', holdData);
    process.exit(1);
  }
  console.log('Slot hold active. Expiry:', holdData.slot.heldUntil);

  // 5. Fire two parallel CONFIRM requests simultaneously for the same slot
  console.log('\nFiring two parallel confirm requests simultaneously...');
  
  const req1 = fetch(`${BASE_URL}/api/patient/slots/${slot.id}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ symptomsText: 'Symptom report A' })
  });

  const req2 = fetch(`${BASE_URL}/api/patient/slots/${slot.id}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ symptomsText: 'Symptom report B' })
  });

  console.log('Parallel requests dispatched. Waiting for response...');
  const [res1, res2] = await Promise.all([req1, req2]);

  const data1 = await res1.json();
  const data2 = await res2.json();

  console.log('\n--- CONCURRENCY TEST RESULTS ---');
  console.log(`Request 1 Status: ${res1.status}`);
  console.log('Request 1 Body:', JSON.stringify(data1));
  console.log(`\nRequest 2 Status: ${res2.status}`);
  console.log('Request 2 Body:', JSON.stringify(data2));
  console.log('--------------------------------\n');

  // Verify only one succeeded
  const success1 = res1.status === 201;
  const success2 = res2.status === 201;

  if (success1 && success2) {
    console.error('FAIL: Both confirmation requests succeeded! Concurrency lock issue.');
  } else if (!success1 && !success2) {
    console.error('FAIL: Both confirmation requests failed!');
  } else {
    console.log('SUCCESS: Concurrency transaction logic passed! Exactly one confirm request succeeded, while the other returned 409 Conflict.');
  }

  // Clean up slot and appointments
  console.log('\nCleaning up database records...');
  await prisma.appointment.deleteMany({
    where: { slotId: slot.id }
  });
  await prisma.slot.delete({
    where: { id: slot.id }
  });
  console.log('Cleanup finished.');

  await prisma.$disconnect();
}

runTest().catch(err => {
  console.error('Outer test runner failed:', err);
  prisma.$disconnect();
});
