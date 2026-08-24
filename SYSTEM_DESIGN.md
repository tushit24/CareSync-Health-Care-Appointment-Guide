# CareSync — System Architecture & Design Specification

This document details the core architectural mechanisms powering CareSync's concurrency control, conflict resolution, state management, and asynchronous delivery pipelines.

---

## 1. Double-Booking Prevention

CareSync enforces double-booking prevention across concurrent patient requests using database-level constraints, row-level locking, and two-phase atomic state transitions.

### Database Constraints
- **Slot Uniqueness**: The `Slot` schema enforces a composite unique constraint `@@unique([doctorId, date, startTime])`. This guarantees no two slots can exist for the same doctor at the same time.
- **Appointment Uniqueness**: The `Appointment` schema enforces `slotId String @unique`. PostgreSQL rejects any attempt to attach multiple appointments to a single slot.

### Transactional Locking (`FOR UPDATE`)
During slot holds (`holdSlot`) and booking confirmations (`confirmBooking`), Prisma executes raw SQL transactions using PostgreSQL's `SELECT ... FOR UPDATE`. When Patient A requests a slot hold:
1. PostgreSQL acquires an exclusive row-level lock on the target `Slot` record.
2. Concurrent requests for the same slot block until Patient A's transaction finishes.
3. The transaction verifies `status === 'OPEN'` before transitioning `Slot.status`. If another process modified the slot, the query returns zero rows and fails with `409 Slot already booked`.

---

## 2. Doctor Leave Conflict Handling

When an administrator marks a doctor as unavailable on a specific date (`POST /api/admin/doctors/:id/leave`), CareSync handles schedule conflicts atomically.

### Conflict Resolution Workflow
1. **Identification**: The system queries all `CONFIRMED` appointments associated with the doctor where `slot.date === leaveDate`.
2. **Atomic Cancellation**: Within a single database transaction (`prisma.$transaction`), the system:
   - Sets existing `Appointment.status = 'CANCELLED'`.
   - Sets corresponding `Slot.status = 'CANCELLED'`.
   - Deletes any unbooked `OPEN` or `HELD` slots on that date to prevent new bookings.
3. **Async Notification Queue**: For each cancelled appointment, the system inserts two `NotificationLog` entries (`channel: EMAIL` and `channel: CALENDAR`) with type `CANCELLATION`.
4. **Patient Impact**: Affected patients receive automated cancellation emails containing doctor and date details. The background notification worker invokes `deleteCalendarEvent()` using stored OAuth refresh tokens to remove events from patient and doctor Google Calendars.

---

## 3. Slot Hold Mechanism

CareSync uses a temporary reservation model to balance user experience against inventory availability.

### 5-Minute Hold Window Rationale
Allowing patients to hold a slot for 5 minutes prevents "slot sniping" while they write detailed symptoms and await LLM pre-visit urgency analysis (`Low`, `Medium`, `High`). 5 minutes provides adequate time without locking inventory if a user abandons their browser session.

### Expiry Enforcement & Lifecycle
- **Reservation**: `holdSlot()` sets `Slot.status = 'HELD'`, `Slot.heldBy = patientId`, and `Slot.heldUntil = now + 5 minutes`.
- **Validation**: `confirmBooking()` checks `heldBy === patientId` and `heldUntil >= new Date()`. If `heldUntil` has passed, the booking is rejected with `400 Slot hold expired`.
- **Automated Release**: A `node-cron` worker (`holdReleaseJob`) executes every 60 seconds (`* * * * *`). It runs an atomic `slot.updateMany()` query:
  ```javascript
  await prisma.slot.updateMany({
    where: { status: 'HELD', heldUntil: { lt: new Date() } },
    data: { status: 'OPEN', heldBy: null, heldUntil: null }
  });
  ```
  This immediately returns expired slots back to `OPEN` state for public discovery.

---

## 4. Notification Failure Handling

CareSync decouples external communication (Nodemailer SMTP and Google Calendar API) from user HTTP request cycles to prevent third-party API latency or downtime from blocking booking operations.

### Async Queue Architecture
Whenever an appointment is confirmed, rescheduled, or cancelled, `NotificationLog` rows are created with `status = 'PENDING'`, `attempts = 0`, and channel (`EMAIL` or `CALENDAR`).

### Worker Retry & Exponential Backoff
The `notificationJob` cron worker runs every 5 minutes (`*/5 * * * *`). For each `PENDING` log, it enforces backoff timing:
$$\text{Eligible if } \text{Date.now}() \ge \text{createdAt} + (\text{attempts} \times 5 \text{ minutes})$$

- **Attempt 1**: Executed immediately on the first cron tick.
- **Attempt 2**: Retried 5 minutes after creation.
- **Attempt 3**: Retried 10 minutes after creation.

### Error Tracking & Visibility
If an API call fails (e.g. invalid SMTP credentials, Google OAuth token expiry, network timeout), the catch block increments `attempts` and writes the error stack/message snippet to `lastError`. 

If `attempts >= 3`, `status` updates to `FAILED`. Failed notifications are never silently dropped; they are surfaced in the Admin Portal notification view (`GET /api/admin/notification-logs`) with full stack traces for manual inspection and retry.
