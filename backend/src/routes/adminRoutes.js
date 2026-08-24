const express = require('express');
const {
  createDoctor,
  listDoctors,
  setWorkingHours,
  markLeave,
  getNotificationLogs
} = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth protection and admin role requirement globally to these routes
router.use(authenticateToken);
router.use(requireRole('ADMIN'));

router.post('/doctors', createDoctor);
router.get('/doctors', listDoctors);
router.post('/doctors/:id/working-hours', setWorkingHours);
router.post('/doctors/:id/leave', markLeave);
router.get('/notification-logs', getNotificationLogs);

module.exports = router;
