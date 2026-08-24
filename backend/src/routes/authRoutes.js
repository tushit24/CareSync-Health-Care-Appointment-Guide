const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const {
  connectGoogle,
  googleCallback,
  disconnectGoogle,
  getCalendarStatus
} = require('../controllers/googleOAuthController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);

// Google Calendar OAuth
router.get('/google/connect',    connectGoogle);           // public — token in query param
router.get('/google/callback',   googleCallback);          // public — Google redirects here
router.post('/google/disconnect', authenticateToken, disconnectGoogle);
router.get('/google/status',     authenticateToken, getCalendarStatus);

module.exports = router;
