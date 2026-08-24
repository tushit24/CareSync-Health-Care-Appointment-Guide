const express = require('express');
const { getDoctorAppointments, cancelDoctorAppointment, completeAppointment } = require('../controllers/doctorController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth protection and doctor role requirement globally
router.use(authenticateToken);
router.use(requireRole('DOCTOR'));

router.get('/appointments', getDoctorAppointments);
router.post('/appointments/:id/cancel', cancelDoctorAppointment);
router.post('/appointments/:id/complete', completeAppointment);

module.exports = router;
