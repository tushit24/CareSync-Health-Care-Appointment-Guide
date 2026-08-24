# CareSync — Healthcare Appointment Booking & Management Platform

CareSync is an end-to-end healthcare management platform that connects patients, doctors, and administrators. It features real-time slot reservation, double-booking prevention, LLM-powered symptom triage & clinical summary generation, automated email notifications, background medication reminders, and two-way Google Calendar synchronization via OAuth 2.0.

> 🚀 **Live Demo:** [**https://care-sync-health-care-appointment-g.vercel.app/login**](https://care-sync-health-care-appointment-g.vercel.app/login)

---

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js, Prisma ORM, PostgreSQL (Neon Serverless Postgres).
- **Frontend**: React.js (Vite), Vanilla CSS with custom Glassmorphism UI tokens, Lucide React icons, `react-markdown` with `remark-gfm`.
- **AI & LLM**: Groq SDK using the `openai/gpt-oss-120b` model.
- **Authentication**: JWT (JSON Web Tokens) with `bcryptjs` password hashing and Google OAuth 2.0 (`googleapis`).
- **Scheduling & Async Workers**: `node-cron` background workers for hold releasing, appointment reminders, medication dosage reminders, and exponential-backoff notification delivery.
- **Email Delivery**: Nodemailer over Gmail SMTP.

---

## ⚙️ How to Run Locally

### Prerequisites
- Node.js (v18 or higher)
- pnpm or npm
- PostgreSQL database (or Neon PostgreSQL instance)

### 1. Repository Setup
```bash
git clone <repository-url>
cd healthcare_appointment_guide
```

### 2. Backend Setup & Database Migration
```bash
cd backend
pnpm install

# Copy environment template
cp .env.example .env
# Edit .env with your actual database credentials, Groq API key, Gmail SMTP, and Google OAuth credentials

# Apply database migrations
npx prisma migrate dev

# Seed the database with sample admin, doctors, patients, and open slots
node src/seed.js

# Start backend dev server (runs on port 5000)
pnpm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
pnpm install

# Start frontend dev server (runs on port 5173)
pnpm run dev
```

Visit `http://localhost:5173` in your browser.

### 4. Demo / Test Credentials

For grading convenience, the seed script creates:

**Admin**
- Email: admin@caresync.com
- Password: AdminPassword123!

You can also register your own patient/doctor accounts through the app's normal sign-up flow.

---

## ⚠️ Known Limitations

- The deployed backend runs on Render's free tier, which spins down after ~15 minutes of inactivity. A background uptime monitor pings it periodically to keep cron jobs (notification retries, hold-release, medication reminders) running reliably.

---

## 🔑 Environment Variables (`.env.example`)

Copy the content below to `backend/.env` and update the placeholder values.

```ini
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Connection (Neon PostgreSQL)
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
# DATABASE_URL uses Neon PgBouncer pooler for runtime query execution
DATABASE_URL="postgresql://neondb_owner:password@ep-sample-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=60"

# DIRECT_URL bypasses PgBouncer and is used exclusively by Prisma Migrate
DIRECT_URL="postgresql://neondb_owner:password@ep-sample.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=60"

# JWT Authentication Secret
# Generate a random 64-character hex string: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET="your-super-secure-jwt-secret-key"

# Groq LLM API Key
# 1. Sign up at https://console.groq.com/
# 2. Go to API Keys -> Create API Key
# 3. Paste your key below
GROQ_API_KEY="gsk_your_groq_api_key_here"

# Email Configuration (Nodemailer Gmail SMTP)
# 1. Enable 2-Step Verification on your Google Account (https://myaccount.google.com/security)
# 2. Search for "App passwords" in Google Account search bar
# 3. Create a new App Password named "CareSync"
# 4. Enter your Gmail address and 16-character generated app password below
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="your-16-char-app-password"

# Google OAuth 2.0 & Calendar Integration
# 1. Go to Google Cloud Console (https://console.cloud.google.com/)
# 2. Enable "Google Calendar API" under APIs & Services -> Library
# 3. Configure OAuth Consent Screen under APIs & Services -> OAuth Consent Screen:
#    - User Type: External
#    - Scope: https://www.googleapis.com/auth/calendar.events
#    - Test Users: Add your testing Gmail address(es)
# 4. Go to APIs & Services -> Credentials -> Create Credentials -> OAuth 2.0 Client ID:
#    - Application type: Web application
#    - Authorized redirect URIs: http://localhost:5000/api/auth/google/callback
# 5. Copy Client ID and Client Secret below
GOOGLE_CLIENT_ID="your-google-oauth-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:5000/api/auth/google/callback"

# Frontend Application URL (used for OAuth redirect target)
FRONTEND_URL="http://localhost:5173"
```

---

## 📡 API Endpoints

| Category | Method | Path | Purpose | Authentication |
|---|---|---|---|---|
| **Auth** | `POST` | `/api/auth/register` | Register a new Patient account | Public |
| **Auth** | `POST` | `/api/auth/login` | Authenticate user & issue JWT | Public |
| **Auth** | `GET` | `/api/auth/me` | Fetch authenticated user profile | Bearer Token |
| **Google OAuth** | `GET` | `/api/auth/google/connect` | Initiate OAuth consent flow | Public (`?token=JWT`) |
| **Google OAuth** | `GET` | `/api/auth/google/callback` | OAuth redirect callback handler | Public |
| **Google OAuth** | `POST` | `/api/auth/google/disconnect` | Clear stored refresh token | Bearer Token |
| **Google OAuth** | `GET` | `/api/auth/google/status` | Check if Calendar is connected | Bearer Token |
| **Patient** | `GET` | `/api/patient/doctors` | Search doctors & available slots | Bearer Token (PATIENT) |
| **Patient** | `GET` | `/api/patient/appointments` | List patient's appointments | Bearer Token (PATIENT) |
| **Patient** | `POST` | `/api/patient/slots/:id/hold` | Place 5-minute hold on open slot | Bearer Token (PATIENT) |
| **Patient** | `POST` | `/api/patient/slots/:id/confirm` | Confirm booking with symptoms | Bearer Token (PATIENT) |
| **Patient** | `POST` | `/api/patient/appointments/:id/cancel` | Cancel an appointment | Bearer Token (PATIENT) |
| **Patient** | `POST` | `/api/patient/appointments/:id/reschedule` | Reschedule appointment to new slot | Bearer Token (PATIENT) |
| **Doctor** | `GET` | `/api/doctor/appointments` | View doctor's schedule & history | Bearer Token (DOCTOR) |
| **Doctor** | `POST` | `/api/doctor/appointments/:id/cancel` | Doctor cancels appointment | Bearer Token (DOCTOR) |
| **Doctor** | `POST` | `/api/doctor/appointments/:id/complete` | Complete visit with notes & rx | Bearer Token (DOCTOR) |
| **Admin** | `GET` | `/api/admin/doctors` | List all doctors with schedules | Bearer Token (ADMIN) |
| **Admin** | `POST` | `/api/admin/doctors` | Create a new Doctor profile | Bearer Token (ADMIN) |
| **Admin** | `POST` | `/api/admin/doctors/:id/working-hours` | Set/update doctor working hours | Bearer Token (ADMIN) |
| **Admin** | `POST` | `/api/admin/doctors/:id/leave` | Mark doctor leave & cancel conflicts | Bearer Token (ADMIN) |
| **Admin** | `GET` | `/api/admin/notification-logs` | Monitor async delivery logs | Bearer Token (ADMIN) |

---

## 🗄 Database Schema (`prisma/schema.prisma`)

CareSync uses PostgreSQL managed via Prisma ORM.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id                 String         @id @default(uuid())
  name               String
  email              String         @unique
  passwordHash       String         @map("password_hash")
  role               Role
  phone              String?
  googleRefreshToken String?        @map("google_refresh_token")
  createdAt          DateTime       @default(now()) @map("created_at")
  appointments       Appointment[]
  doctorProfile      DoctorProfile?

  @@map("users")
}

model DoctorProfile {
  id                  String               @id @default(uuid())
  userId              String               @unique @map("user_id")
  specialisation      String
  bio                 String?
  slotDurationMinutes Int                  @default(30) @map("slot_duration_minutes")
  appointments        Appointment[]
  leaves              DoctorLeave[]
  user                User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  workingHours        DoctorWorkingHours[]
  slots               Slot[]

  @@index([specialisation])
  @@map("doctor_profiles")
}

model DoctorWorkingHours {
  id        String        @id @default(uuid())
  doctorId  String        @map("doctor_id")
  dayOfWeek Int           @map("day_of_week")
  startTime String        @map("start_time")
  endTime   String        @map("end_time")
  doctor    DoctorProfile @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@map("doctor_working_hours")
}

model DoctorLeave {
  id       String        @id @default(uuid())
  doctorId String        @map("doctor_id")
  date     DateTime      @db.Date
  reason   String?
  doctor   DoctorProfile @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@map("doctor_leave")
}

model Slot {
  id          String        @id @default(uuid())
  doctorId    String        @map("doctor_id")
  date        DateTime      @db.Date
  startTime   String        @map("start_time")
  endTime     String        @map("end_time")
  status      SlotStatus    @default(OPEN)
  heldBy      String?       @map("held_by")
  heldUntil   DateTime?     @map("held_until")
  appointment Appointment?
  doctor      DoctorProfile @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@unique([doctorId, date, startTime])
  @@index([status, heldUntil])
  @@map("slots")
}

model Appointment {
  id                     String            @id @default(uuid())
  slotId                 String            @unique @map("slot_id")
  patientId              String            @map("patient_id")
  doctorId               String            @map("doctor_id")
  status                 AppointmentStatus @default(CONFIRMED)
  symptomsText           String?           @map("symptoms_text")
  preVisitSummaryJson    Json?             @map("pre_visit_summary_json")
  urgencyLevel           String?           @map("urgency_level")
  doctorNotes            String?           @map("doctor_notes")
  prescriptionJson       Json?             @map("prescription_json")
  postVisitSummaryText   String?           @map("post_visit_summary_text")
  patientCalendarEventId String?           @map("patient_calendar_event_id")
  doctorCalendarEventId  String?           @map("doctor_calendar_event_id")
  createdAt              DateTime          @default(now()) @map("created_at")
  doctor                 DoctorProfile     @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  patient                User              @relation(fields: [patientId], references: [id], onDelete: Cascade)
  slot                   Slot              @relation(fields: [slotId], references: [id], onDelete: Cascade)
  notifications          NotificationLog[]
  prescriptions          Prescription[]

  @@map("appointments")
}

model Prescription {
  id              String               @id @default(uuid())
  appointmentId   String               @map("appointment_id")
  medicineName    String               @map("medicine_name")
  dosage          String
  frequencyPerDay Int                  @map("frequency_per_day")
  durationDays    Int                  @map("duration_days")
  reminders       MedicationReminder[]
  appointment     Appointment          @relation(fields: [appointmentId], references: [id], onDelete: Cascade)

  @@map("prescriptions")
}

model MedicationReminder {
  id             String         @id @default(uuid())
  prescriptionId String         @map("prescription_id")
  scheduledAt    DateTime       @map("scheduled_at")
  status         ReminderStatus @default(PENDING)
  prescription   Prescription   @relation(fields: [prescriptionId], references: [id], onDelete: Cascade)

  @@index([status, scheduledAt])
  @@map("medication_reminders")
}

model NotificationLog {
  id            String              @id @default(uuid())
  appointmentId String?             @map("appointment_id")
  type          NotificationType
  channel       NotificationChannel
  status        NotificationStatus  @default(PENDING)
  attempts      Int                 @default(0)
  lastError     String?             @map("last_error")
  createdAt     DateTime            @default(now()) @map("created_at")
  appointment   Appointment?        @relation(fields: [appointmentId], references: [id])

  @@map("notification_log")
}

enum Role {
  PATIENT
  DOCTOR
  ADMIN
}

enum SlotStatus {
  OPEN
  HELD
  BOOKED
  CANCELLED
}

enum AppointmentStatus {
  CONFIRMED
  COMPLETED
  CANCELLED
}

enum ReminderStatus {
  PENDING
  SENT
  FAILED
}

enum NotificationType {
  BOOKING_CONFIRMATION
  REMINDER
  CANCELLATION
  MED_REMINDER
}

enum NotificationChannel {
  EMAIL
  CALENDAR
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
}
```

### Schema Architecture Overview
1. **User & Roles**: Central authentication table with dynamic role assignment (`PATIENT`, `DOCTOR`, `ADMIN`). `DoctorProfile` extends `User` for doctor-specific attributes.
2. **Slots & Schedules**: `DoctorWorkingHours` defines recurring availability. `Slot` records individual time slots created dynamically with composite uniqueness `@@unique([doctorId, date, startTime])`.
3. **Holds & Appointments**: `Slot` transitions between `OPEN`, `HELD`, `BOOKED`, and `CANCELLED`. `Appointment` maintains a strict `@@unique` 1:1 relation with `Slot`.
4. **LLM & Clinical Records**: `Appointment` stores symptom inputs, Groq LLM pre-visit JSON summaries, urgency levels, raw doctor notes, and markdown post-visit summaries.
5. **Prescriptions & Reminders**: `Prescription` defines prescribed medications; `MedicationReminder` maps individual dosage times spread across waking hours.
6. **Notification Delivery Pipeline**: `NotificationLog` decouples email and Google Calendar synchronization into async, retriable queue items.

---

## 🤖 Exact LLM Prompts Used Verbatim

### 1. Pre-Visit Symptom Triage & Analysis Prompt
**File**: `backend/src/controllers/patientController.js`  
**Model**: `openai/gpt-oss-120b` (via Groq API)

```text
Analyse these symptoms and return a JSON object containing: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: <symptoms>
```

### 2. Post-Visit Clinical Summary Prompt
**File**: `backend/src/controllers/doctorController.js`  
**Model**: `openai/gpt-oss-120b` (via Groq API)

```text
Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <doctorNotes>
```
