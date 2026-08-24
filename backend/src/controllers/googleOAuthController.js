/**
 * googleOAuthController.js
 * ------------------------
 * Handles the Google OAuth 2.0 flow for calendar integration.
 *
 * Flow:
 *   1. User clicks "Connect Google Calendar" → browser navigates to
 *      GET /api/auth/google/connect?token=<jwt>
 *   2. Backend decodes JWT, generates auth URL with state=userId, redirects to Google
 *   3. Google redirects back to GET /api/auth/google/callback?code=...&state=userId
 *   4. Backend exchanges code, stores refresh token, redirects to frontend dashboard
 *   5. Frontend reads ?calendarConnected=true and shows success message
 */

const jwt       = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { getAuthUrl, exchangeCodeForTokens } = require('../services/calendarService');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

/**
 * GET /api/auth/google/connect?token=<jwt>
 * Initiates the Google OAuth consent flow.
 * Token is passed as query param because browser navigation can't set Authorization headers.
 */
const connectGoogle = (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).send('Missing token parameter.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(403).send('Invalid or expired token.');
    }

    const authUrl = getAuthUrl(decoded.userId);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[Google OAuth] Connect error:', error);
    res.status(500).send('Failed to initiate Google OAuth flow.');
  }
};

/**
 * GET /api/auth/google/callback?code=...&state=<userId>
 * Google redirects here after the user grants/denies consent.
 * Exchanges the code for tokens and stores the refresh token on the User row.
 */
const googleCallback = async (req, res) => {
  const { code, state: userId, error: oauthError } = req.query;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (oauthError) {
    console.warn('[Google OAuth] User denied consent:', oauthError);
    return res.redirect(`${frontendUrl}?calendarError=denied`);
  }

  if (!code || !userId) {
    return res.redirect(`${frontendUrl}?calendarError=missing_params`);
  }

  try {
    const { refreshToken } = await exchangeCodeForTokens(code);

    // Store refresh token on user
    const user = await prisma.user.update({
      where: { id: userId },
      data: { googleRefreshToken: refreshToken },
      select: { role: true }
    });

    // Re-queue CALENDAR events for all future CONFIRMED appointments that
    // don't have a calendar event yet (booked before this user connected calendar).
    // The notification worker will create the events on the next cron cycle.
    try {
      const now = new Date();

      // Appointments where this user is the patient
      const patientAppointments = await prisma.appointment.findMany({
        where: {
          patientId: userId,
          status: 'CONFIRMED',
          patientCalendarEventId: null,
          slot: { date: { gte: now } }
        },
        select: { id: true }
      });

      // Appointments where this user is the doctor (via doctorProfile)
      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId },
        select: { id: true }
      });
      const doctorAppointments = doctorProfile ? await prisma.appointment.findMany({
        where: {
          doctorId: doctorProfile.id,
          status: 'CONFIRMED',
          doctorCalendarEventId: null,
          slot: { date: { gte: now } }
        },
        select: { id: true }
      }) : [];

      // Collect unique appointment IDs (avoid duplicates if user is both patient+doctor somehow)
      const apptIds = [...new Set([
        ...patientAppointments.map(a => a.id),
        ...doctorAppointments.map(a => a.id)
      ])];

      if (apptIds.length > 0) {
        await prisma.notificationLog.createMany({
          data: apptIds.map(appointmentId => ({
            appointmentId,
            type: 'BOOKING_CONFIRMATION',
            channel: 'CALENDAR',
            status: 'PENDING'
          })),
          skipDuplicates: true
        });
        console.log(`[Google OAuth] Re-queued CALENDAR events for ${apptIds.length} existing appointment(s) after calendar connect for user ${userId}`);
      }
    } catch (requeueErr) {
      // Non-fatal: log but don't block the redirect
      console.error('[Google OAuth] Failed to re-queue existing calendar events:', requeueErr.message);
    }

    // Redirect to the appropriate dashboard
    const dashboardPath = user.role === 'PATIENT' ? '/patient'
                        : user.role === 'DOCTOR'  ? '/doctor'
                        : '/admin';

    res.redirect(`${frontendUrl}${dashboardPath}?calendarConnected=true`);
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    res.redirect(`${frontendUrl}?calendarError=token_exchange_failed`);
  }
};

/**
 * POST /api/auth/google/disconnect
 * Clears the stored refresh token — user's calendar will no longer be synced.
 * Protected route (authenticateToken middleware applied in routes).
 */
const disconnectGoogle = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { googleRefreshToken: null }
    });
    res.status(200).json({ message: 'Google Calendar disconnected successfully.' });
  } catch (error) {
    console.error('[Google OAuth] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Google Calendar.' });
  }
};

/**
 * GET /api/auth/google/status
 * Returns whether the current user has a Google refresh token stored.
 * Protected route.
 */
const getCalendarStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { googleRefreshToken: true }
    });
    res.status(200).json({ connected: !!user?.googleRefreshToken });
  } catch (error) {
    console.error('[Google OAuth] Status check error:', error);
    res.status(500).json({ error: 'Failed to check calendar status.' });
  }
};

module.exports = { connectGoogle, googleCallback, disconnectGoogle, getCalendarStatus };
