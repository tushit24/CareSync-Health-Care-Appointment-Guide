const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend communication
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Auth routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Admin routes
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

// Patient routes
const patientRoutes = require('./routes/patientRoutes');
app.use('/api/patient', patientRoutes);

// Doctor routes
const doctorRoutes = require('./routes/doctorRoutes');
app.use('/api/doctor', doctorRoutes);

// Start Background Jobs
const { startNotificationWorker }       = require('./jobs/notificationJob');
const { startHoldReleaseWorker }        = require('./jobs/holdReleaseJob');
const { startAppointmentReminderWorker } = require('./jobs/appointmentReminderJob');
const { startMedicationReminderWorker } = require('./jobs/medicationReminderJob');

startNotificationWorker();
startHoldReleaseWorker();
startAppointmentReminderWorker();
startMedicationReminderWorker();

// Health Check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root route
app.get('/', (req, res) => {
  res.send('Healthcare Appointment Backend API is running.');
});

// Start the server — store reference so we can close it gracefully on nodemon restart
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown: nodemon sends SIGUSR2 on restart, Node sends SIGTERM/SIGINT on kill.
// Closing the server before exiting ensures the port is released immediately,
// preventing EADDRINUSE when nodemon spins up the next instance.
const shutdown = (signal) => {
  console.log(`[Server] Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
  // Force-exit after 3s if server hasn't closed (outstanding connections)
  setTimeout(() => process.exit(0), 3000);
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT',  () => shutdown('SIGINT'));
// nodemon uses SIGUSR2 to signal restarts
process.once('SIGUSR2', () => {
  server.close(() => {
    process.kill(process.pid, 'SIGUSR2');
  });
  setTimeout(() => process.kill(process.pid, 'SIGUSR2'), 3000);
});
