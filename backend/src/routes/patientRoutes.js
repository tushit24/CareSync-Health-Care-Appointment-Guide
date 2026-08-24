const express = require('express');
const {
  searchDoctors,
  holdSlot,
  confirmBooking,
  getAppointments,
  cancelAppointment,
  rescheduleAppointment
} = require('../controllers/patientController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth protection and patient role validation globally
router.use(authenticateToken);
router.use(requireRole('PATIENT'));

router.get('/doctors', searchDoctors);
router.get('/appointments', getAppointments);
router.post('/slots/:id/hold', holdSlot);
router.post('/slots/:id/confirm', confirmBooking);
router.post('/appointments/:id/cancel', cancelAppointment);
router.post('/appointments/:id/reschedule', rescheduleAppointment);

module.exports = router;
