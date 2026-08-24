/**
 * calendarService.js
 * ------------------
 * Google Calendar API integration via googleapis.
 * All functions throw on failure — callers wrap in try/catch and log to notification_log.
 *
 * To add a user's calendar access:
 *   1. Generate auth URL via getAuthUrl(userId)
 *   2. User consents → Google redirects to callback with code
 *   3. Exchange code with exchangeCodeForTokens(code) → store refreshToken on User row
 *   4. Use createCalendarEvent / deleteCalendarEvent / updateCalendarEvent
 */

const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

/**
 * Returns a fresh OAuth2 client with credentials from env.
 */
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Generate the Google consent page URL.
 * @param {string} userId — embedded in state to identify the user on callback
 */
function getAuthUrl(userId) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',   // ensure we get a refresh token
    prompt: 'consent',        // force consent screen so refresh token is always returned
    scope: SCOPES,
    state: userId
  });
}

/**
 * Exchange an authorization code for tokens.
 * @param {string} code
 * @returns {{ refreshToken: string, accessToken: string }}
 */
async function exchangeCodeForTokens(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned — user may have already granted access. Re-authorize with prompt=consent.');
  }
  return { refreshToken: tokens.refresh_token, accessToken: tokens.access_token };
}

/**
 * Build an authenticated calendar client using a stored refresh token.
 * @param {string} refreshToken
 */
function getCalendarClient(refreshToken) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Construct an IST timezone-aware ISO datetime string from a slot date + time string.
 * Slot date is stored as UTC midnight (Date @db.Date in Prisma).
 * E.g. date=2026-08-25T00:00:00Z, time="09:00" → "2026-08-25T09:00:00+05:30"
 *
 * @param {Date} slotDate
 * @param {string} timeStr "HH:MM"
 */
function buildISTDateTime(slotDate, timeStr) {
  const y = slotDate.getUTCFullYear();
  const m = String(slotDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(slotDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}T${timeStr}:00+05:30`;
}

/**
 * Create a Google Calendar event.
 * @param {string} refreshToken
 * @param {{
 *   summary: string,
 *   description: string,
 *   slotDate: Date,
 *   startTime: string,  "HH:MM"
 *   endTime: string,    "HH:MM"
 *   attendeeEmail?: string
 * }} opts
 * @returns {string} eventId
 */
async function createCalendarEvent(refreshToken, { summary, description, slotDate, startTime, endTime, attendeeEmail }) {
  const calendar = getCalendarClient(refreshToken);

  const startDateTime = buildISTDateTime(slotDate, startTime);
  const endDateTime   = buildISTDateTime(slotDate, endTime);

  const eventBody = {
    summary,
    description,
    start: { dateTime: startDateTime, timeZone: 'Asia/Kolkata' },
    end:   { dateTime: endDateTime,   timeZone: 'Asia/Kolkata' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email',  minutes: 24 * 60 },
        { method: 'popup',  minutes: 30 }
      ]
    }
  };

  if (attendeeEmail) {
    eventBody.attendees = [{ email: attendeeEmail }];
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: eventBody
  });

  return response.data.id;
}

/**
 * Delete a Google Calendar event. Swallows 404 (already deleted).
 * @param {string} refreshToken
 * @param {string} eventId
 */
async function deleteCalendarEvent(refreshToken, eventId) {
  const calendar = getCalendarClient(refreshToken);
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (err) {
    // 404 = already deleted or never existed — treat as success
    if (err.code === 404 || err.status === 404) return;
    throw err;
  }
}

/**
 * Update an existing Google Calendar event's summary and times.
 * @param {string} refreshToken
 * @param {string} eventId
 * @param {{
 *   summary?: string,
 *   slotDate: Date,
 *   startTime: string,
 *   endTime: string
 * }} opts
 */
async function updateCalendarEvent(refreshToken, eventId, { summary, slotDate, startTime, endTime }) {
  const calendar = getCalendarClient(refreshToken);
  const startDateTime = buildISTDateTime(slotDate, startTime);
  const endDateTime   = buildISTDateTime(slotDate, endTime);

  await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    resource: {
      ...(summary && { summary }),
      start: { dateTime: startDateTime, timeZone: 'Asia/Kolkata' },
      end:   { dateTime: endDateTime,   timeZone: 'Asia/Kolkata' }
    }
  });
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent
};
