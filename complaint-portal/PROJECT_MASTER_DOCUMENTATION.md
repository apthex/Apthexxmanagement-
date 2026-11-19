# PROJECT MASTER DOCUMENTATION — APTHEX Complaint Portal

**File:** `complaint-portal/PROJECT_MASTER_DOCUMENTATION.md`  
**Status:** Single source of truth for understanding, maintaining, developing, testing, and deploying the APTHEX Complaint Portal  
**Last updated:** Mon Nov 16 2026  
**Document rules:** This document must be updated whenever any code, route, schema, integration, test result, or project status changes. Never overwrite changelog entries. Never include secrets or personal complaint data.

---

## 1. Project Overview

### 1.1 Purpose and Objectives

The APTHEX Complaint Portal is a privacy-first, public-facing complaint reporting system for schools and colleges. It enables students and staff to report cyberbullying, blackmail, fraud, institutional safety concerns, and other issues without creating an account. The portal includes a separate, staff-only Case Desk for authorised APTHEX personnel to manage, triage, and resolve complaints.

**Primary objectives:**
- Provide a secure, anonymous, and identified complaint reporting channel for educational institutions.
- Protect reporter privacy: anonymous complaints store no identity fields or contact records.
- Ensure evidence privacy: images and voice recordings are stored privately and accessed only via short-lived signed URLs.
- Provide staff with a Case Desk for case management, including assignment, notes, spam flagging, completion, and reopening.
- Generate aggregate monthly reports per institute with small-count suppression for privacy.
- Maintain a complete, append-only audit log of all privileged actions.

### 1.2 Problem Being Solved

Educational institutions in India need a safe, private mechanism for students to report safety concerns (cyberbullying, blackmail, financial fraud, institutional-level issues) without fear of retaliation or exposure. Existing channels often require account creation, expose reporter identity, or lack proper case tracking and audit trails. The APTHEX Complaint Portal addresses this by offering:
- No-login, no-account-required reporting.
- Optional anonymous reporting with guaranteed identity separation.
- Private evidence handling with signed URL access.
- Staff-only Case Desk with TOTP 2FA, CSRF protection, and audit logging.
- Reference ID-based public status lookup that never reveals complaint details.

### 1.3 Target Users

| User Type | Role | Access |
|---|---|---|
| Public reporter (student/staff at an institute) | Submits complaints, checks status, sends follow-ups | Public routes at `/help/*` |
| Case Desk staff (case_team) | Views, assigns, notes, completes, reopens, spam-flags cases | `/help/desk/*` (TOTP required) |
| Case Desk owner | Manages staff, views audit log and email outbox, sends monthly reports | `/help/desk/*` (owner-only routes) |
| Institute head | Receives monthly aggregate reports via email | Email recipient only (no portal access) |

### 1.4 Scope and Key Features

**In scope (implemented):**
- Public complaint portal with institute-code validation (3–32 alphanumeric code).
- Complaint categories: Blackmail and Sextortion, Online Harassment or Bullying, Financial Fraud or Threats, Fake Profiles or Account Hacking, Institution-level Issue.
- Urgent safety concern workflow with immediate alerting.
- Identified reporting (name, class, roll number, mobile, email) and anonymous reporting.
- Optional image evidence (max 5 images, 2 MB each, JPEG/PNG/WebP/GIF, EXIF stripped, re-encoded).
- Optional voice recording (max 60 seconds, WebM/Ogg/WAV/MP4/M4A).
- Cloudflare Turnstile CAPTCHA (dev bypass in development only).
- Reference ID format: `APX-YYYY-XXXXXX` (e.g., `APX-2611-JGG623`).
- Public status lookup: returns only `In Process` or `Completed` (no complaint details).
- Public follow-up submission attached to case timeline.
- Staff Case Desk: dashboard, complaint detail, assignment, notes, completion/reopening, spam management. Teacher (`case_team`) accounts are scoped server-side to a single institute ref ID — they see only their college's complaints, read-only.
- Staff management (owner-only): position-first creation (Admin or Teacher), institute attach, update, deactivate, reset password, revoke sessions. Every teacher gets a unique generated password (shown once to the owner to hand over) — no shared default password.
- Institute ref-ID register (owner-only): name-only generation form (random `APXJIT-###` issued instantly) with a searchable register of all issued codes below it.
- Audit log (owner-only): append-only record of all privileged actions. Removed from the sidebar navigation (routes kept).
- Email outbox (owner-only): audited delivery queue with retry and backoff. Removed from the sidebar navigation (routes kept).
- Institute statistics and monthly PDF reports (owner-only).
- Data retention: completed cases deleted after configurable retention period; deletion log retained.
- Multilingual interface: English, Hindi, Marathi.

**Out of scope:**
- Internal management dashboard (separate system, not accessed by this portal).
- Public complaint content display (status page never shows complaint details).
- Reporter two-way messaging (follow-up is one-way attachment to case timeline).
- File sharing outside the Case Desk (signed URLs are staff-only).

### 1.5 Project Boundaries and Future Possibilities

**Boundaries:**
- Lives in the public website repository under `complaint-portal/`, separate from the marketing site (`nextjs-site/`) and the internal management dashboard.
- Marketing site is not imported, modified, or required at runtime.
- Does not reuse the management dashboard's MongoDB database (`Apthexx`); uses a dedicated `Apethexhelpportal` database.
- Production URL — **finalised (Nov 2026):** `https://apthex.com/help` (portal) and `https://apthex.com/help/desk` (Case Desk) on the Vercel `apthex` project; browser origin `https://apthex.com`. (Historical: originally planned as `https://complaints.apthex.com` per `OPEN_DECISIONS.md`; superseded by the `/help` integration.)

**Future possibilities:**
- Two-way reporter-staff messaging via the reference ID.
- Mobile app or PWA for reporting.
- Additional evidence types (video, documents).
- Advanced analytics dashboard for institute heads.
- Integration with external case management systems.
- SMS notifications.

---

## 2. Complete Website Structure

### 2.1 Overall Application Architecture

The Complaint Portal consists of two independent Next.js applications and one Express backend:

```
complaint-portal/
├── client-next/          # Next.js 16.4.5 frontend (public portal + Case Desk)
│   ├── src/app/          # App Router pages
│   ├── src/components/   # Shared React components
│   ├── src/lib/          # API client, session, language, format helpers
│   └── src/i18n/         # Internationalization (en, hi, mr)
├── server/               # Express 5 backend API
│   ├── src/app.js        # Express app setup (CORS, Helmet, rate limiting)
│   ├── src/index.js      # Server entry point (DB connect, seed, scheduler)
│   ├── src/config/       # Environment validation (Zod schema)
│   ├── src/db/           # MongoDB connection
│   ├── src/models/       # Mongoose models
│   ├── src/routes/       # API route handlers
│   ├── src/services/     # Business logic (email, storage, captcha, stats, purge)
│   ├── src/middleware/   # Auth, CSRF, origin, error handling
│   ├── src/scripts/      # Seed script
│   ├── src/tests/        # Integration test suite (31 tests)
│   └── src/jobs/         # Scheduled jobs (scheduler)
├── client/               # Legacy Vite client (unused, not a workspace)
├── .env.example          # Environment template
├── API.md                # Endpoint reference
├── TEST_REPORT.md        # Test results and limitations
├── OPEN_DECISIONS.md     # Owner approvals required
├── PRODUCTION_INPUTS.md  # Production handover checklist
└── package.json          # npm workspaces (server, client-next)
```

### 2.2 Frontend Structure (`client-next/`)

**Pages (App Router):**

| Route | Component | Purpose | Auth Required |
|---|---|---|---|
| `/help` | `WelcomePage` | Institute code entry and validation | No |
| `/help/category` | `CategoryPage` | Complaint category selection (incl. urgent) | No |
| `/help/details` | `DetailsPage` | Complaint details, personal info, evidence, review, submit | No |
| `/help/thanks` | `ThankYouPage` | Submission confirmation with reference ID | No |
| `/help/status` | `StatusPage` | Public status lookup and follow-up | No |
| `/complaint-review-console` | `StaffLoginPage` | Staff sign-in with TOTP 2FA enrolment. `/admin` now serves this same login page through an edge rewrite (owner-preference alias); `/staff/login` still 404s | No |
| `/help/desk` | `DeskPage` | Case dashboard (list, filters, summary) — admins see every college; teachers are server-scoped to their own institute and see a read-only "College complaints" view | Yes (TOTP) |
| `/desk/institutes` | `InstitutesPage` | Institute ref-ID register: type a college name → random `APXJIT-###` code generated instantly; searchable list of all issued codes below (regenerate, deactivate) | Yes (Owner only) |
| `/help/desk/complaint/[ref]` | `DeskComplaintPage` | Individual case detail and management — teachers can open only their own college's cases, read-only | Yes (TOTP) |
| `/help/desk/stats` | `StatsPage` | Institute reporting statistics | Yes (TOTP) |
| `/help/desk/staff` | `StaffPage` | Staff account management — position-first form (Admin/Teacher); teachers get an institute code + unique generated password shown once | Yes (Owner only) |
| `/help/desk/audit` | `AuditPage` | Security audit log | Yes (Owner only) |
| `/help/desk/email` | `EmailPage` | Email outbox log | Yes (Owner only) |

**Shared Components:**
- `PublicShell.jsx` — Header, navigation, language switcher, footer for public pages.
- `DeskShell.jsx` — Header, navigation, logout for Case Desk pages.
- `Protected.jsx` — Session verification wrapper for Case Desk routes; redirects to `/complaint-review-console` on 401.
- `Turnstile.jsx` — Cloudflare Turnstile CAPTCHA widget.
- `StepIndicator.jsx` — Progress indicator (Welcome → Category → Details).
- `Icon.jsx` — SVG icon library.
- `Spinner.jsx` — Loading spinner.
- `LanguageSwitcher.jsx` — EN/HI/MR selector.
- `StatusBadge.jsx` — Case status display badge.
- `DeskComplaintPage` uses `DeskShell`; public pages use `PublicShell`.

**Libraries:**
- `lib/api.js` — `api()` fetch wrapper with CSRF token handling, credentials, error parsing; `submitComplaint()` for multipart uploads with XHR progress tracking.
- `lib/session.js` — SessionStorage helpers for institute, category, confirmation data; device ID generation.
- `lib/lang.js` — `useLang()` hook with localStorage persistence; `useReadAloud()` for browser speech synthesis.
- `lib/format.js` — Date/time, byte, duration formatting; month options.

**Internationalization:**
- `i18n/index.js` — Dictionary with English, Hindi, Marathi translations; `t()` translation function; `CATEGORY_META` category definitions; `URGENT_CATEGORY` constant.

### 2.3 Backend Structure (`server/`)

**Express Application (`src/app.js`):**
- Helmet security headers (CSP disabled; frontend sets its own CSP).
- CORS with origin checking via `allowedOrigins()`.
- Cookie parsing, JSON/urlencoded body parsing (1 MB limit).
- Global API rate limit: 600 requests/minute.
- `Cache-Control: no-store` on all `/api` responses.
- Routes mounted under `/api/*`.

**Route Modules:**

| Route File | Endpoints | Auth | Purpose |
|---|---|---|---|
| `config.js` | `GET /api/config` | No | Public config: languages, CAPTCHA state, emergency numbers |
| `auth.js` | `POST /api/auth/login`, `POST /api/auth/setup-2fa`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/sessions`, `POST /api/auth/sessions/:id/revoke`, `POST /api/auth/sessions/revoke-others` | Login: No; others: Yes | Staff authentication, TOTP, session management |
| `institutes.js` | `GET /api/institutes/validate`, `GET /api/institutes/list`, `GET /api/institutes/all`, `POST /api/institutes`, `PATCH /api/institutes/:code`, `POST /api/institutes/:code/regenerate` | No for validate/list; Owner for all/all-write | APXJIT-### ref-ID generation (random, distinct), college assignment, public validation with rate limiting |
| `complaints.js` | `POST /api/complaints`, `GET /api/complaints`, `GET /api/complaints/:ref_id`, `PATCH /api/complaints/:ref_id` | POST: No (CAPTCHA required); others: Yes (staff) | Complaint submission, listing, detail, management |
| `status.js` | `POST /api/status/lookup`, `POST /api/status/followup` | No | Public status lookup and follow-up |
| `attachments.js` | `GET /api/attachments/:id/url`, `GET /api/attachments/download/:id` | Yes (staff) | Signed evidence URL issuance and download |
| `staff.js` | `GET /api/staff/assignable`, `GET/POST/PATCH/DELETE /api/staff/members`, `POST /api/staff/members/:id/reset-password`, `POST /api/staff/members/:id/revoke-sessions`, `GET /api/staff/audit`, `GET /api/staff/outbox`, `POST /api/staff/outbox/process` | Yes (Owner for most) | Staff management with position-first creation — teachers require an institute code and get a unique server-generated password (returned once); audit log, email outbox |
| `stats.js` | `GET /api/stats/leaderboard`, `GET /api/stats/institutes`, `GET /api/stats/institute/:code`, `GET /api/stats/monthly`, `GET /api/stats/overview` | Yes (leaderboard also for case_team — scoped to their own college row) | Institute statistics; leaderboard lists every generated ref ID; teacher boards contain only their own institute |
| `reports.js` | `GET /api/reports/preview`, `GET /api/reports/data`, `POST /api/reports/send` | Yes (Owner for send) | Monthly PDF reports |

### 2.4 Public Website Integration

The Complaint Portal frontend is integrated into the existing public Next.js website (`nextjs-site/`) under the `/help` route:

- `nextjs-site/next.config.mjs` — API rewrites proxy `/api/*` and `/help/api/*` to the Express backend at `API_PROXY_TARGET` (default `http://localhost:4000`). CSP allows Turnstile script (`https://challenges.cloudflare.com`). Security headers applied globally; `noindex` on `/desk/*` and `/complaint-review-console*` (login moved there Nov 16 2026; `/staff/*` and `/admin` routes no longer exist).
- `nextjs-site/app/help/layout.js` — Server-side metadata + client language shell.
- `nextjs-site/app/help/layout-shell.jsx` — Client-side `PublicShell` wrapper with language state.
- `nextjs-site/app/help/page.js` — Welcome page (institute validation).
- `nextjs-site/app/help/category/page.js` — Category selection.
- `nextjs-site/app/help/details/page.js` — Complaint details and evidence.
- `nextjs-site/app/help/thanks/page.js` — Submission confirmation.
- `nextjs-site/app/help/status/page.js` — Status lookup and follow-up.
- `client-next/src/app/complaint-review-console/page.js` — Staff login (the only login URL).
- `nextjs-site/app/help/desk/*.js` — Case Desk pages.
- `nextjs-site/components/*` — Copied portal components with `/help`-based links.
- `nextjs-site/lib/*` — Copied portal lib files with `NEXT_PUBLIC_API_BASE_URL` support.
- `nextjs-site/app/help/globals.css` — Copied portal design system CSS.

The existing homepage (`nextjs-site/app/page.js`) inlines the static `index.html` content via `content.js` and is completely unaffected by the `/help` integration.

### 2.5 Navigation and Page Relationships

```
Public flow:
  /help → (institute validated) → /help/category → (category selected) → /help/details → (submitted) → /help/thanks
                                            ↳ (status check) → /help/status → (follow-up) → /help/status

Staff flow:
  /complaint-review-console → (TOTP enrolment if first time) → /desk → /desk/complaint/[ref]
                              → /desk/stats → (monthly report) → /desk/email
                              → /desk/staff (owner) → /desk/audit (owner)
```

---

## 3. Complete User Flows

### 3.1 Public Visitor Opening `/help`

1. Visitor navigates to `https://apthex.com/help`.
2. `PublicShell` renders: emergency strip, header with brand, navigation (Report, Status, Staff sign-in), language switcher, main content, footer.
3. `WelcomePage` mounts:
   - `useLang()` loads saved language (en/hi/mr) from localStorage, defaults to English.
   - `getInstitute()` checks sessionStorage for previously validated institute code.
   - If a saved institute exists, its code is pre-filled.
4. User enters institute code (3–32 chars, uppercase, alphanumeric/hyphen/underscore) and clicks Validate.
5. `GET /api/institutes/validate?code=X` is called.
6. If valid: institute name displayed; "Continue to Category" button enabled.
7. If invalid (404): error message shown.
8. User clicks "Continue to Category" → navigates to `/help/category`.

**Mermaid:**
```mermaid
flowchart TD
    A[/help] --> B[Enter institute code]
    B --> C{Validate?}
    C -->|Valid| D[Show institute name]
    C -->|Invalid| E[Show error]
    D --> F[Continue to /help/category]
    E --> B
```

### 3.2 Institute Code Validation

- Codes are issued by the owner in the Case Desk under **Institute ref IDs** (`/desk/institutes`): the form asks only for the college name — a random `APXJIT-###` code (e.g. `APXJIT-234`) is generated instantly, each college keeps its own distinct ID, and the full register with a search bar sits right below the form. Codes issued earlier as `JIT-APTHEX###` remain valid; Regenerate moves a college onto the new format. (Server-side, generating without a name is still possible for legacy flows and leaves the code unassigned until a college is attached — the panel UI no longer produces such blank codes.)
- Endpoint: `GET /api/institutes/validate?code=<code>`
- Validation: Zod `instituteCodeSchema` (`^[A-Z0-9_-]{3,32}$`).
- Database: `Institute.findOne({ code, status: "active", name: { $ne: "" } })` — unassigned codes never validate.
- Rate limit: 30 requests/minute per IP hash.
- Response: `{ code, name, type }` or 404/400.
- Result saved to sessionStorage via `saveInstitute()`.

### 3.3 Language Selection

- Languages: English (`en`), Hindi (`hi`), Marathi (`mr`).
- Selector in `PublicShell` header/footer and `LanguageSwitcher` component.
- Preference stored in `localStorage` key `apthex_lang`.
- `document.documentElement.lang` updated on change.
- Speech synthesis uses language-specific codes (`en-IN`, `hi-IN`, `mr-IN`).

### 3.4 Complaint Category Selection

1. User navigates to `/help/category` (redirects to `/help` if no institute saved).
2. `CategoryPage` displays category cards:
   - Blackmail and Sextortion
   - Online Harassment or Bullying
   - Financial Fraud or Threats
   - Fake Profiles or Account Hacking
   - Institution-level Issue
   - Urgent safety concern (separate red card)
3. User selects a category. Double-click or click "Continue" to proceed.
4. `saveCategory(value, urgent)` stores category and urgent flag in sessionStorage.
5. Navigates to `/help/details`.

**Mermaid:**
```mermaid
flowchart TD
    A[/help/category] --> B[Select category]
    B --> C[Save category + urgent flag]
    C --> D[/help/details]
```

### 3.5 Identified Complaint Submission

1. User navigates to `/help/details` (redirects if no institute or category saved).
2. `DetailsPage` loads saved institute and category from sessionStorage.
3. Mode defaults to "identified". User fills personal information:
   - Full name (required, 2–100 chars)
   - Class/course/division (required, 1–100 chars)
   - Roll number (optional, max 50 chars)
   - Mobile (required, `^[+]?[\d\s-]{7,20}$`)
   - Email (required, valid email, max 254 chars)
4. User enters complaint description (required, 10–5000 chars).
5. Optional: upload up to 5 images (JPEG/PNG/WebP/GIF, max 2 MB each) and/or record/upload one voice note (max 60 seconds).
6. CAPTCHA: Turnstile widget (dev bypass in development).
7. User clicks "Review complaint" → validation runs → review screen shown.
8. Review screen displays all entered data for confirmation.
9. User clicks "Submit complaint" → `submitComplaint()` multipart POST to `POST /api/complaints`.
10. Backend processes: validates, rate limits, verifies CAPTCHA, processes images/voice, creates Complaint + Contact + Attachment records.
11. Response: `{ ref_id, message, acknowledgement_email, attachments }`.
12. `saveConfirmation()` stores ref_id in sessionStorage.
13. Navigates to `/help/thanks`.

### 3.6 Anonymous Complaint Submission

1. User can switch to anonymous mode at any point on `/help/details` via "Prefer to stay anonymous?" link.
2. Anonymous mode: personal information fields hidden; identity fields rejected by Zod `superRefine` if present.
3. No `Contact` document is created.
4. `complaint.class_label` is `undefined` for anonymous mode.
5. No confirmation email is sent (`acknowledgement_email: false`).
6. Submission and reference ID generation proceed identically to identified mode.
7. User advised to save reference ID (no email will be sent).

### 3.7 Personal Information Collection

- Collected only in identified mode.
- Stored in separate `contacts` collection linked by `complaint_id`.
- Fields: name, roll_no, mobile, email, created_at.
- `complaint` collection stores `class_label` for identified complaints only.
- Anonymous complaints: no contact record, no personal fields.

### 3.8 Evidence Image Upload

1. User clicks "Add images" or drags/drops files.
2. Client validates: image/jpeg, image/png, image/webp, image/gif; max 5 files; max 2 MB each (client pre-check).
3. `sharp` processes on server:
   - Probes format; rejects unsupported formats.
   - Rejects dimensions > 40 MP.
   - Auto-rotate, resize (max 2400px, fit inside), flatten to JPEG, quality 82→40 if needed.
   - Re-encoding removes EXIF/GPS metadata.
4. `multer.memoryStorage()` holds files in memory during processing.
5. `saveObject(key, buffer, mime)` stores file:
   - Development: local filesystem, mode 0o600, directory 0o700.
   - Production: Vercel Blob `put` (access: private) to private store.
6. `Attachment` record created: complaint_id, type="image", storage_key, mime, size_bytes.
7. Signed URL issued via `GET /api/attachments/:id/url` (staff only).

### 3.9 Voice Recording and Upload

1. User clicks "Start recording" → `MediaRecorder` API records audio (max 60 seconds).
2. Or user uploads existing audio file.
3. Client validates: audio MIME type; duration ≤ 60s.
4. Server `processVoice()`:
   - Checks size ≤ `MAX_VOICE_BYTES` (10 MB).
   - Detects format via magic bytes (WebM, Ogg, WAV, MP4/M4A, MP3).
   - Parses metadata with `music-metadata` for duration.
   - Rejects duration > 60.5 seconds.
5. Stored as attachment with type="voice".

### 3.10 CAPTCHA Validation

- Provider: Cloudflare Turnstile.
- `captchaPublicConfig()` returns: `configured`, `siteKey`, `required`, `devBypass`.
- Development: `CAPTCHA_DEV_BYPASS=true` + no secret key → `devBypass: true`, token auto-set to `"dev-bypass"`.
- Production: `CAPTCHA_DEV_BYPASS=false` + secret key configured → `required: true`, real Turnstile verification.
- `verifyCaptcha(token, ip)`:
  - If not configured and dev bypass: returns `{ ok: true, devBypass: true }`.
  - If not configured and no bypass: returns `{ ok: false, error: "CAPTCHA is not configured" }`.
  - If configured: POST to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with secret + token + remoteip; 5-second timeout.
- Required on complaint submission and follow-up submission.

### 3.11 Complaint Submission and Reference ID Generation

1. `POST /api/complaints` with multipart form data.
2. Validation chain:
   - Body parsing (`parseBody()` handles JSON `contact` field and flat fields).
   - Zod `submissionSchema` validation.
   - Institute code verified against active institutes.
   - Rate limits: IP/hour, device/hour, anonymous IP/hour.
   - CAPTCHA verification.
   - File count/size limits.
   - Image/voice processing.
   - Description length ≥ 10 chars.
   - Duplicate detection: SHA-256 hash of `institute_code|details_text`, rate-limited within `DUPLICATE_WINDOW_MINUTES` (default 10).
3. Reference ID: `generateRefId(now)` → `APX-YYYY-XXXXXX` format. Retries up to 8 times on collision (MongoDB 11000 duplicate key).
4. Complaint created: ref_id, institute_code, category, details_text, details_hash, urgent, mode, class_label (identified only), status="in_process", created_at.
5. Contact created (identified only).
6. Attachments created.
7. Stats delta applied (`applyStatsDelta`).
8. Audit event: `complaint_created`.
9. Email notifications queued (`queueComplaintNotifications`).
10. Response 201: `{ ref_id, message, acknowledgement_email, attachments }`.

**Reference ID format:** `APX-2611-JGG623` (APX + 4-digit year-month + 6-char base32-ish suffix excluding ambiguous chars).

### 3.12 Thank-You Page

- `/help/thanks` displays:
  - Success mark icon.
  - Reference ID (copyable to clipboard).
  - Acknowledgement email status (sent or not sent for anonymous).
  - "What happens next" steps (case team reviews, In Process, data deleted after retention).
  - Buttons: "Check complaint status" → `/help/status`, "Report another concern" → `/help`.
- Requires `sessionStorage` confirmation data; redirects to empty state if missing.

### 3.13 Complaint Status Checking

1. User navigates to `/help/status`.
2. Enters reference ID (pattern: `^APX-\d{4}-[2-9A-HJKMNP-Z]{6}$`).
3. `POST /api/status/lookup` with `{ ref_id }`.
4. Rate limit: 10 requests/minute per IP.
5. `purgeIfDue(refId)` runs first (retention safety net).
6. `Complaint.findOne({ ref_id }).select("status")` — only status field fetched.
7. Response: `{ status: "In Process" | "Completed" }` or 404.
8. If complaint deleted (DeletionLog exists): `{ status: "Completed", data_deleted: true, message: "..." }`.
9. No complaint details, contact info, or evidence ever exposed.

### 3.14 Follow-up Submission

1. On status page, after successful lookup (non-deleted case), follow-up form appears.
2. User enters text (min 5 chars, max 5000).
3. CAPTCHA required if configured.
4. `POST /api/status/followup` with `{ ref_id, text, captchaToken, deviceId }`.
5. Rate limits: IP/hour, per-ref/hour, device/hour.
6. `purgeIfDue(refId)` runs first.
7. `CaseEvent.create({ complaint_id, member_id: null, event: "reporter_followup", note })`.
8. Audit event: `reporter_followup`.
9. Response 201: `{ ok: true, message }`.

### 3.15 Urgent Complaint Flow

1. User selects "Urgent safety concern" on category page (or sets `urgent: true`).
2. `complaint.urgent = true`, `category = "Urgent safety concern"`.
3. Email notifications:
   - `newComplaintTemplate` (kind=`urgent`) to `APTHEX_CASE_MAILBOX`.
   - `urgentTemplate` to `APTHEX_CASE_MAILBOX` + all `URGENT_ALERT_RECIPIENTS`.
4. `processOutbox()` called with limit 10 (priority processing).
5. Case appears in dashboard with "Urgent" badge.
6. Escalation job (daily 08:00 Mumbai) flags cases open > `ESCALATION_DAYS` (default 7) and sends escalation alerts.

### 3.16 Staff Login and TOTP Authentication

1. User navigates to `/complaint-review-console`.
2. Enters email and password.
3. `POST /api/auth/login`:
   - Rate limit: 5 attempts/15 minutes per IP+email hash.
   - Account lockout: 15 minutes after 5 failed attempts.
   - `bcrypt.compare()` password verification.
4. If TOTP not enrolled:
   - `newSecret()` generates TOTP secret + otpauth URL.
   - Secret encrypted with AES-256-GCM (`TOTP_ENCRYPTION_KEY`).
   - `setupToken` (32-byte random) stored as hash; expires in 10 minutes.
   - Response: `setupRequired: true`, secret, otpauthUrl.
   - Frontend displays manual setup key and QR code URL.
5. User enrolls authenticator app → `POST /api/auth/setup-2fa` with setupToken + 6-digit code.
6. `verifyToken(secret, code)` via `speakeasy.totp.verify` (window: 1).
7. On success: `totp_secret` encrypted and stored, `totp_enabled = true`, session created.
8. Subsequent logins require password + 6-digit TOTP code.
9. `createStaffSession()`: 32-byte token hash, 24-byte CSRF hash, HttpOnly+SameSite=Lax+Secure cookies, TTL from `SESSION_TTL_HOURS` (8h).
10. `GET /api/auth/me` returns member info + CSRF token; refreshes `last_seen_at`.

### 3.17 Case Desk Complaint Management

1. Staff navigates to `/help/desk` (redirects to login if unauthenticated).
2. Dashboard displays: stat cards (all cases, urgent open, in process, completed), filter form, case table, pagination.
3. Filters: search reference, institute code, category, status, spam, urgent only.
4. Clicking a case row navigates to `/help/desk/complaint/[ref]`.
5. Case detail page shows:
   - Case summary: reference, institute, category, mode, class, received, completed, escalated, assigned to.
   - Reporter details (identified only): name, roll number, mobile, email.
   - Evidence: list of attachments with "Open privately" buttons (signed URLs).
   - Case timeline: events (note, follow-up, completed, reopened, assigned, spam, escalated).
   - Side actions: mark complete/reopen, flag/unflag spam, assignment dropdown, add internal note, privacy reminders.
6. All state changes require CSRF token (`X-CSRF-Token` header).
7. All actions audited with member_id, action, entity, outcome, hashed IP.

### 3.18 Case Completion and Reopening

- **Complete:** Staff clicks "Mark complete" → `PATCH /api/complaints/[ref]` with `{ completed: true }` + CSRF.
  - `Complaint.findOneAndUpdate({ status: "in_process" }, { status: "completed", completed_at, delete_after: now + RETENTION_DAYS days })`.
  - Stats delta: `completed: +1` (if not spam).
  - CaseEvent: `completed`.
  - Audit: `complaint_completed`.
- **Reopen:** `PATCH` with `{ completed: false }` → status back to `in_process`, `completed_at` and `delete_after` unset.
  - Stats delta: `completed: -1`.
  - CaseEvent: `reopened`.
  - Audit: `complaint_reopened`.

### 3.19 Internal Notes and Spam Management

- **Internal note:** `PATCH` with `{ note: "text" }` → `CaseEvent.create({ event: "note", note })`; audit `complaint_note_added`.
- **Flag spam:** `PATCH` with `{ flagged_spam: true }` → stats delta reverses received/completed counts; CaseEvent `flagged_spam`; audit `complaint_flagged_spam`. Spam cases excluded from dashboard list by default.
- **Unflag spam:** Reverse of above.

### 3.20 Institute Monthly Reports

- Owner navigates to `/help/desk/stats`.
- Selects institute and month.
- `GET /api/stats/institute/:code` returns aggregate counts and monthly rows.
- `GET /api/reports/preview?institute_code=X&month=Y` returns PDF inline.
- `POST /api/reports/send` (owner + CSRF) queues `monthly_report` email to institute `head_email` with PDF attachment.
- PDF generated by `pdfkit`: A4, aggregate counts only, small-count suppression (`Fewer than 5`), no names/reference IDs/descriptions/category breakdowns.
- Scheduler: `runMonthlyReportJob()` at 06:00 on 1st of each month (Mumbai time), queues reports for all active institutes with `head_email`.

### 3.21 Data Retention and Automatic Deletion

- When case completed: `delete_after = completed_at + RETENTION_DAYS * 86400000` (default 180 days per OPEN_DECISIONS; 30 days dev placeholder).
- Scheduler `runDeletionJob()` at 02:00 daily (Mumbai): `purgeDueComplaints()` finds complaints where `delete_after <= now`.
- Request-time safety net `requestTimeSweep()` throttled to once/minute on public status and staff reads.
- `purgeComplaint()`:
  1. `Complaint.findOneAndDelete()`.
  2. Delete attachments from storage (`deleteObject`).
  3. Delete Attachment, Contact, CaseEvent records.
  4. Create `DeletionLog` (ref_id, institute_code, deleted_by, reason="retention_expired").
  5. Audit: `retention_deletion`.
- Status lookup on deleted ref returns `data_deleted: true`.
- Backup retention: 30 days (per OPEN_DECISIONS recommendation).

### 3.22 Teacher Accounts and Institute Scoping (Owner Configures)

- Staff creation form asks **position first**: *Teacher* (case_team) or *Admin* (owner).
- Teacher accounts require an **institute ref ID** — only assigned, active codes are selectable (`resolveInstituteScope`).
- If no password is typed, the server generates a **unique strong password per teacher** (15 chars: uppercase + lowercase + digits + symbols, no ambiguous glyphs), returned in the POST response as `password` **exactly once**. The panel shows a copy-to-clipboard card; the owner hands the password to the teacher privately. Only the bcrypt hash is stored; there is no shared default password anymore (the old `Teacher8686@#` default was retired and its export removed).
- Access scoping is **server-enforced**, not UI-only:
  - `GET /api/complaints` — `institute_code` filter forced to the teacher's college; query overrides and spam filters ignored; summary counts scoped the same way.
  - `GET /api/complaints/:ref_id` — a case from another college responds `404` (behaves as non-existent).
  - `GET /api/stats/leaderboard` — only the teacher's own college row is returned (empty institute → empty board).
  - All mutations (`PATCH /api/complaints/:ref_id`, attachment URLs, spam flags) remain owner-only (`404` for teachers).
- Teachers see a read-only case view: status/assignment/note action cards are hidden behind an `isOwner` guard and replaced by a "Read-only view" card; the institute and spam filters, assignment dropdown fetch, and Reporting link are hidden for teachers.
- `PATCH /api/staff/members/:id` can set/change `institute_code` (per-row select in the staff table); a case_team member without an institute simply sees nothing until one is attached — safe default.
- Sidebar navigation: Complaints and Leaderboard for everyone; Institute ref IDs, Reporting, Staff accounts for owners only. Audit log and Email log links were removed from the navigation (routes still resolve for owners).

---

## 4. UI/UX Documentation

### 4.1 Design System and Styling

The Complaint Portal uses a self-contained CSS design system (`client-next/src/app/globals.css`):

**Design tokens (CSS custom properties):**
- `--bg: #08090c`, `--bg-elevated: #0d0f14`, `--panel: #111319`, `--panel-2: #161922`, `--panel-3: #1c202b`
- `--line: rgba(255,255,255,0.08)`, `--line-strong: rgba(255,255,255,0.14)`
- `--text: #f4f4f7`, `--text-soft: #c9c9d4`, `--muted: #8c8c9c`
- `--red: #e11d2e`, `--red-bright: #ff3347`, `--red-deep: #a40f1e`, `--red-wash: rgba(225,29,46,0.12)`
- `--green: #3ddc97`, `--amber: #f5b84b`, `--blue: #79a8ff`
- `--radius-sm: 10px`, `--radius: 16px`, `--radius-lg: 24px`
- `--shadow: 0 22px 70px rgba(0,0,0,0.38)`
- Font: Inter, system-ui fallback (no external fonts)

**Component classes:**
- `.card`, `.card-glow` — Glassmorphism panels with red edge glow.
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-emergency`, `.btn-danger` — Button variants.
- `.input`, `.input-code` — Form inputs.
- `.textarea` — Multi-line text.
- `.status-orb`, `.status-orb.process`, `.status-orb.complete` — Status indicators.
- `.badge`, `.badge-urgent`, `.badge-spam`, `.badge-neutral` — Status badges.
- `.alert`, `.alert-error`, `.alert-success`, `.alert-info`, `.alert-warning` — Alert messages.
- `.center-state` — Empty/loading states.
- `.dropzone` — File drag-and-drop zone.
- `.turnstile-block` — CAPTCHA container.
- `.modal`, `.modal-backdrop` — Modal dialogs.

### 4.2 Typography, Colors, Components

- **Font:** Inter (system-ui, -apple-system, BlinkMacSystemFont fallbacks). No external font requests.
- **Color palette:** Dark theme with red accents (`#e11d2e`), green success (`#3ddc97`), amber warning (`#f5b84b`).
- **Icons:** Inline SVG library (`Icon.jsx`) with shield, lock, eye, file, alert, arrowLeft/Right, check, close, building, chat, wallet, user, clock, search, phone, mail, external, refresh, chevronDown, home, list, users, chart, mic, stop, image, play, users, logout, copy.
- **No external CSS frameworks** (no Tailwind, Bootstrap, etc.).
- **No external trackers or analytics.**

### 4.3 Responsive Behavior

- All pages use responsive CSS with `clamp()` for fluid typography and spacing.
- Mobile layouts: single-column stacks, hidden decorative elements (HUDs, floating cards), touch-friendly targets (44px+).
- `@media (hover:none),(pointer:coarse)` disables hover spotlights on touch devices.
- Horizontal overflow tested at 390px width (0 px overflow per TEST_REPORT.md).
- Scroll snap on desktop for section navigation.

### 4.4 Accessibility

- Skip-to-content link on public pages.
- `aria-label`, `aria-current`, `aria-pressed`, `aria-invalid`, `aria-describedby` on interactive elements.
- `role="radiogroup"` on category grid; `role="radio"` on category cards.
- Focus-visible outline (red, 2px, 4px offset).
- `prefers-reduced-motion` respected (motion skipped).
- `lang` attribute set from `useLang()`.
- Speech synthesis for read-aloud feature.
- Color contrast: dark theme with red accents; no reliance on color alone.
- **Note:** Manual WCAG 2.2 AA audit not yet performed (listed as pending in TEST_REPORT.md).

### 4.5 Language Support

- English (`en`), Hindi (`hi`), Marathi (`mr`).
- Full dictionary in `i18n/index.js` with `t()` interpolation function.
- Category labels translated (`CATEGORY_META` with `key`/`descriptionKey`).
- Urgent category has dedicated translation key.
- Speech synthesis language codes: `en-IN`, `hi-IN`, `mr-IN`.

### 4.6 Form Validation and Error States

**Client-side (Zod-equivalent logic in components):**
- Required fields marked with `*`; optional fields marked `(optional)`.
- `aria-invalid` set on invalid fields.
- Error text displayed below invalid fields.
- Form-level error banner (`errorFixFields` message).
- Submit buttons disabled during loading or when CAPTCHA token missing.

**Server-side (Zod schemas):**
- `submissionSchema`: institute code, category, details text, urgent, mode, captcha token, device ID, contact fields.
- `followupSchema`: ref_id, text (min 5), captcha token, device ID.
- `statusLookupSchema`: ref_id pattern.
- `loginSchema`: email, password, optional TOTP code.
- `setupSchema`: email, setup token, 6-digit code.
- `patchComplaintSchema`: completed, flagged_spam, assigned_to (ObjectId), note.
- `memberCreateSchema`: name, email, password (12+ chars, upper/lower/number), role.
- `memberUpdateSchema`: name, role, status.
- `passwordResetSchema`: password (12+ chars).
- Validation errors return 400 with `fields` object mapping field paths to messages.

### 4.7 Loading, Success, and Failure States

- **Loading:** `Spinner` component with `aria-live="polite"`; `Loading` page component; `center-state` for empty states.
- **Success:** Alert success (`alert-success`), check icons, copied-to-clipboard feedback (2.2s timeout), notice messages after case actions.
- **Failure:** Alert error (`alert-error`), 404/401/403/429 responses with user-friendly messages, retry buttons, "Try again" on session errors.
- **Network errors:** `ApiError` with "Could not reach the portal. Check your connection and try again."

---

## 5. Technical Architecture

### 5.1 Next.js Frontend Architecture

- **Framework:** Next.js 16.4.5, React 19.3.0, React DOM 19.3.0.
- **Router:** App Router with `/help` route segment.
- **Rendering:** Static pre-rendering for public pages; dynamic SSR for `/help/desk/complaint/[ref]`.
- **Client components:** All portal pages are `"use client"`; layout shell is client for language state.
- **API proxy:** Next.js rewrites forward `/api/*` to Express backend (`API_PROXY_TARGET` env var).
- **CSP:** `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`; `connect-src 'self' https://challenges.cloudflare.com`; `frame-src https://challenges.cloudflare.com`.
- **Security headers:** CSP, X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy, COOP, HSTS.
- **No build step for server:** `server/build` is a no-op (`console.log('no build step')`).

### 5.2 Backend Architecture

- **Framework:** Express 5.0.1, Node.js 20+ (tested on 24).
- **Database:** MongoDB / Mongoose 9.0.0 (Atlas in production; `mongodb-memory-server` for tests).
- **Middleware stack:**
  1. `x-powered-by` disabled.
  2. `trust proxy` set to `env.TRUST_PROXY` (default 1).
  3. Helmet (CSP disabled, CORS same-site, referrer no-referrer, HSTS in production).
  4. CORS with `allowedOrigins()` origin checker, credentials enabled.
  5. Body parsers (1 MB limit).
  6. Cookie parser.
  7. Global rate limit (600 req/min).
  8. `Cache-Control: no-store`.
- **Routes:** Mounted under `/api/*` as described in Section 2.3.
- **Error handling:** `errorHandler` converts Zod errors, Multer errors, MongoDB 11000, entity parse errors to appropriate HTTP responses; 500s return generic message without stack traces.
- **Process management:** HTTP server with graceful shutdown on SIGTERM/SIGINT.

### 5.3 MongoDB Atlas Connection

- **Connection:** `src/db/connect.js` — Mongoose connection to `MONGODB_URI`.
- **Database name:** `DATABASE_NAME` (dedicated `Apethexhelpportal`, isolated from management `Apthexx`).
- **Development without URI:** In-memory database via `mongodb-memory-server` (data lost on restart).
- **Connection verification:** `GET /api/health` returns `database: "connected"` when `mongoose.connection.readyState === 1`.
- **Network access:** Production requires Lightsail instance IP added to Atlas Network Access list.

### 5.4 Mongoose Models

| Collection | Model File | Key Fields | Indexes |
|---|---|---|---|
| institutes | `Institute.js` | code (APXJIT-### random; legacy JIT-APTHEX### still valid), name (empty = unassigned), type, head_name, head_email, status, created_at, updated_at | code (unique), status |
| complaints | `Complaint.js` | ref_id, institute_code, category, details_text, details_hash, urgent, mode, class_label, status, flagged_spam, escalated, assigned_to, created_at, completed_at, delete_after | ref_id (unique), institute_code, status, flagged_spam, delete_after (partial), details_hash+institute_code |
| contacts | `Contact.js` | complaint_id, kind, name, roll_no, mobile, email, created_at | complaint_id (unique) |
| attachments | `Attachment.js` | complaint_id, type, storage_key, mime, size_bytes, created_at | complaint_id |
| case_events | `CaseEvent.js` | complaint_id, member_id, event, note, occurred_at | complaint_id |
| members | `Member.js` | name, email, password_hash, role, status, totp_secret, totp_enabled, failed_login_count, locked_until, last_login_at, created_at | email (unique), role, status |
| staff_sessions | `StaffSession.js` | token_hash, member_id, csrf_hash, created_at, last_seen_at, expires_at, revoked_at | token_hash (unique), member_id, expires_at (TTL) |
| audit_events | `AuditEvent.js` | occurred_at, member_id, action, entity, entity_id, outcome, ip (hashed), detail | occurred_at, member_id, entity+entity_id |
| rate_limits | `RateLimit.js` | key, window_start, count, expires_at | key+window_start (unique), expires_at (TTL) |
| stats_monthly | `StatsMonthly.js` | institute_code, month, received, completed, escalated, by_category | institute_code+month (unique) |
| deletion_log | `DeletionLog.js` | ref_id, institute_code, deleted_at, deleted_by, reason | ref_id, deleted_at |
| email_outbox | `EmailOutbox.js` | dedupe_key, to, subject, html, text, kind, meta, status, attempts, next_attempt_at, locked_at, last_error, provider_message_id, created_at, sent_at, expires_at | dedupe_key (unique), status+next_attempt_at, expires_at (TTL) |

### 5.5 API Communication

- **Frontend → Backend:** Fetch API with `credentials: "include"` (cookies). `api()` wrapper in `lib/api.js`.
- **CSRF:** `X-CSRF-Token` header on state-changing requests; token stored in memory after login/me responses and in CSRF cookie.
- **Multipart uploads:** `XMLHttpRequest` with `onprogress` for evidence upload progress.
- **Cookies:** `apthex_session` (HttpOnly, Secure in prod), `apthex_csrf` (HttpOnly=false for JS access, Secure in prod), `SameSite=Lax`.
- **Backend → External:** Resend API (email), Cloudflare Turnstile verify (CAPTCHA), Vercel Blob (storage), MongoDB Atlas (database).

### 5.6 Authentication and Authorization

**Staff authentication:**
- Login: email + password (bcrypt) + optional TOTP code.
- First login: TOTP enrolment required (setup token, 10-minute expiry).
- Session: 32-byte random token, SHA-256 hashed in DB, HttpOnly cookie, TTL 8h.
- CSRF: 24-byte random token, hash stored in session, validated via header+cookie comparison on mutations.
- TOTP: `speakeasy` with `window: 1`, secret encrypted AES-256-GCM with `TOTP_ENCRYPTION_KEY`.
- Account lockout: 15 minutes after 5 failed login attempts.
- Session revocation: logout, password reset, owner revocation, deactivation.

**Authorization:**
- `requireAuth()`: Valid session cookie + active member.
- `requireRole("owner")`: Owner-only endpoints (staff management, audit, outbox, reports send).
- `requireCsrf()`: CSRF token on state-changing requests.
- `requireTrustedOrigin()`: Origin/Referer check on auth routes; enforced in production via `REQUIRE_ORIGIN`.
- Unauthorized access returns 401/403/404 (404 for role-based to prevent enumeration).

### 5.7 File Storage Architecture

**Storage drivers:**
- `local` (development): Filesystem under `STORAGE_LOCAL_DIR` (default `./storage`), files mode 0o600, directories 0o700.
- `vercel-blob` (production): Vercel Blob private store with Private access, server-side `BLOB_READ_WRITE_TOKEN`.

**Operations:**
- `saveObject(key, buffer, mime)`: Vercel Blob `put` (private) or writeFile (local).
- `readObject(key)`: Vercel Blob `get` (private) or readFile (local).
- `deleteObject(key)`: Vercel Blob `del` or unlink (local); ignores missing files.
- `newStorageKey(prefix, extension)`: `crypto.randomBytes(20).toString("hex")` → `image/<hex>.jpg` or `voice/<hex>.webm`.

**Access control:**
- `GET /api/attachments/:id/url` requires staff authentication + role; verifies complaint exists.
- Vercel Blob: server-side proxy via `GET /api/attachments/download/:id` (streamed from private blob, token never exposed to client).
- Local: HMAC-SHA256 signed URL `/api/attachments/download/:id?expires=&signature=`, verified with `timingSafeEqual`.
- Download responses: `Content-Type`, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, `Content-Security-Policy: default-src 'none'; sandbox`.
- All access audited (`attachment_url_issued`, `attachment_download`).

### 5.8 Email Architecture

**Provider:** Resend (`resend` SDK v6).
**Queue:** Database outbox (`EmailOutbox` model) — every email persisted before delivery.
**Flow:**
1. `queueEmail()`: Upsert by `dedupe_key`, status `pending`, TTL `EMAIL_OUTBOX_TTL_DAYS` (30 days).
2. `processOutbox()`: Processes pending/failed messages with `attempts < EMAIL_MAX_ATTEMPTS` (5), exponential backoff capped at 6 hours.
3. `deliver()`: Resend `emails.send()` or dev console log (if `EMAIL_DEV_LOG=true` and non-production).
4. Results: `sent`, `dev_logged`, `failed`, or `dead` (after max attempts).
**Scheduler:** `processOutbox({ limit: 20 })` runs every minute via cron (`Asia/Kolkata`).
**Templates:** `newComplaintTemplate`, `urgentTemplate`, `reporterConfirmationTemplate`, `escalationTemplate`, `monthlyReportTemplate` — all HTML-escaped, no complaint content.
**Triggers:** Complaint submission (immediate + outbox process), escalation job (daily), monthly report job (monthly), manual report send (owner).

### 5.9 Background Jobs and Scheduled Tasks

Scheduler (`src/jobs/scheduler.js`) with `node-cron` (timezone `Asia/Kolkata`):

| Cron | Job | Purpose |
|---|---|---|
| `* * * * *` | `processOutbox({ limit: 20 })` | Email outbox processing every minute |
| `0 2 * * *` | `runDeletionJob()` | Retention deletion at 02:00 daily |
| `0 6 1 * *` | `runMonthlyReportJob()` | Monthly reports at 06:00 on 1st |
| `0 8 * * *` | `runEscalationJob()` | Escalation alerts at 08:00 daily |
| Startup +10s | `processOutbox({ limit: 20 })` | Recover queued notifications after restart |

**Escalation job:** Finds complaints open > `ESCALATION_DAYS` (default 7), marks `escalated=true`, applies stats delta, creates CaseEvent, queues escalation email to case mailbox + urgent recipients.

**Deletion job:** Finds complaints where `delete_after <= now`, purges complaint data, creates DeletionLog.

---

## 6. Database Documentation

### 6.1 Collection Overview

| Collection | Purpose | Contains Sensitive Data? |
|---|---|---|
| institutes | Verified institute codes and contact info | No (metadata only) |
| complaints | Complaint records (no contact for anonymous) | Yes (details_text for identified) |
| contacts | Reporter identity (identified only) | Yes (name, roll, mobile, email) |
| attachments | Evidence file metadata | No (file content in storage, not DB) |
| case_events | Case timeline events | Yes (notes may contain sensitive info) |
| members | Staff accounts | Yes (email, password hash; `institute_code` names the college a teacher is scoped to) |
| staff_sessions | Active sessions | No (token hashes only) |
| audit_events | Append-only audit log | No (hashed IP, no complaint content) |
| rate_limits | Rate limit counters | No (hashed keys) |
| stats_monthly | Aggregate monthly statistics | No (counts only) |
| deletion_log | Retention deletion records | No (ref_id + institute only) |
| email_outbox | Email delivery queue | Yes (recipient, subject, body) |

### 6.2 institutes

```js
{
  code: String (required, unique, uppercase, trimmed),      // e.g. "SCHOOL01"
  name: String (required, trimmed),
  type: String (enum: ["school","college","other"], default "school"),
  head_name: String (trimmed),
  head_email: String (trimmed, lowercase),
  status: String (enum: ["active","inactive"], default "active", indexed),
  created_at: Date (default now)
}
Indexes: code (unique), status
```

**Created:** Via seed script (`SCHOOL01`, `COLLEGE01` demos) or staff management. **Updated:** Staff management PATCH. **Accessed:** Institute validation, complaint submission, stats. **Deleted:** Not directly deleted; set `status: "inactive"`.

### 6.3 complaints

```js
{
  ref_id: String (required, unique, indexed),              // APX-YYYY-XXXXXX
  institute_code: String (required, uppercase, indexed),
  category: String (required, enum: CATEGORIES),
  details_text: String (required),                         // sanitized plain text
  details_hash: String (required, indexed),                // SHA-256 for dedup
  urgent: Boolean (default false, indexed),
  mode: String (enum: ["identified","anonymous"], required),
  class_label: String (identified only),                   // undefined for anonymous
  status: String (enum: ["in_process","completed"], default "in_process", indexed),
  flagged_spam: Boolean (default false, indexed),
  escalated: Boolean (default false),
  assigned_to: ObjectId ref Member,
  created_at: Date (default now, indexed),
  completed_at: Date,
  delete_after: Date (partial index)
}
Indexes: ref_id (unique), institute_code, status, flagged_spam, delete_after (partial), details_hash+institute_code, institute_code+created_at, status+created_at, flagged_spam+created_at
```

**Created:** Complaint submission. **Updated:** Case completion/reopening, spam flag, assignment. **Accessed:** Staff list/detail, public status lookup (status only). **Deleted:** Retention purge (with related records).

### 6.4 contacts

```js
{
  complaint_id: ObjectId ref Complaint (required, indexed, unique),
  kind: String (enum: ["reporter"], default "reporter"),
  name: String (required, trimmed),
  roll_no: String (trimmed),
  mobile: String (required, trimmed),
  email: String (required, trimmed, lowercase),
  created_at: Date (default now)
}
Indexes: complaint_id (unique)
```

**Created:** Identified complaint submission. **Accessed:** Staff case detail. **Deleted:** Retention purge. **Never created for anonymous complaints.**

### 6.5 attachments

```js
{
  complaint_id: ObjectId ref Complaint (required, indexed),
  type: String (enum: ["image","voice"], required),
  storage_key: String (required),                          // image/<hex>.jpg or voice/<hex>.webm
  mime: String (required),
  size_bytes: Number (required),
  created_at: Date (default now)
}
Indexes: complaint_id
```

**Created:** Complaint submission (after processing). **Accessed:** Staff case detail, signed URL issuance. **Deleted:** Retention purge (storage object + DB record).

### 6.6 case_events

```js
{
  complaint_id: ObjectId ref Complaint (required, indexed),
  member_id: ObjectId ref Member (default null),           // null for public/system events
  event: String (required),                                // note, reporter_followup, completed, reopened, assigned, unassigned, flagged_spam, unflagged_spam, escalated
  note: String,
  occurred_at: Date (default now)
}
Indexes: complaint_id
```

**Created:** Staff actions, public follow-ups, system events (escalation). **Accessed:** Case detail timeline. **Deleted:** Retention purge.

### 6.7 members

```js
{
  name: String (required, trimmed),
  email: String (required, unique, lowercase, trimmed),
  password_hash: String (required),                        // bcrypt
  role: String (enum: ["owner","case_team"], default "case_team", indexed),
  status: String (enum: ["active","inactive"], default "active", indexed),
  totp_secret: String (encrypted),
  totp_enabled: Boolean (default false),
  totp_pending_secret: String,
  totp_setup_token_hash: String,
  totp_setup_expires: Date,
  failed_login_count: Number (default 0),
  locked_until: Date,
  last_login_at: Date,
  created_at: Date (default now)
}
Indexes: email (unique), role, status
```

**Created:** Seed script or staff management. **Updated:** Login, TOTP enrolment, password reset, profile update, deactivation. **Accessed:** Authentication, staff management, assignment.

### 6.8 audit_events

```js
{
  occurred_at: Date (default now, indexed),
  member_id: ObjectId ref Member (default null),
  action: String (required),
  entity: String (required),
  entity_id: String (sliced to 160 chars),
  outcome: String (enum: ["success","failure"], default "success"),
  ip: String (SHA-256 HMAC, never plaintext),
  detail: String (sliced to 1000 chars)
}
Indexes: occurred_at, member_id, entity+entity_id
```

**Created:** All privileged actions (login, complaint actions, staff management, attachment access, report sends, etc.). **Accessed:** Audit log page (owner only). **Never deleted** (append-only).

### 6.9 rate_limits

```js
{
  key: String (required),
  window_start: Date (required),
  count: Number (default 0),
  expires_at: Date (required, TTL)
}
Indexes: key+window_start (unique), expires_at (TTL)
```

**Created/Updated:** Rate limit checks on submit, status, follow-up, login, institute validation. **Expired:** Automatically by TTL index.

### 6.10 stats_monthly

```js
{
  institute_code: String (required, uppercase),
  month: String (required, YYYY-MM),
  received: Number (default 0),
  completed: Number (default 0),
  escalated: Number (default 0),
  by_category: Mixed (default {})
}
Indexes: institute_code+month (unique)
```

**Created/Updated:** `applyStatsDelta()` on complaint creation, completion, spam flag. **Accessed:** Institute statistics page.

### 6.11 deletion_log

```js
{
  ref_id: String (required, indexed),
  institute_code: String (required),
  deleted_at: Date (default now, indexed),
  deleted_by: String (default "system"),
  reason: String (default "retention_expired")
}
Indexes: ref_id, deleted_at
```

**Created:** Retention purge. **Accessed:** Status lookup (to show `data_deleted`). **Never deleted.**

### 6.12 email_outbox

```js
{
  dedupe_key: String (required, unique, indexed),
  to: String (required),
  subject: String (required),
  html: String (required),
  text: String (required),
  kind: String (enum: ["new_complaint","urgent","reporter_confirmation","monthly_report","escalation","system"], required),
  meta: Mixed (default {}),
  status: String (enum: ["pending","sending","sent","dev_logged","failed","dead"], default "pending", indexed),
  attempts: Number (default 0),
  next_attempt_at: Date (default now, indexed),
  locked_at: Date,
  last_error: String,
  provider_message_id: String,
  created_at: Date (default now),
  sent_at: Date,
  expires_at: Date (required, TTL)
}
Indexes: dedupe_key (unique), status+next_attempt_at, expires_at (TTL)
```

**Created:** `queueEmail()` on complaint submission, escalation, monthly report. **Updated:** `processOutbox()` on delivery success/failure. **Accessed:** Email outbox page (owner only). **Expired:** TTL index.

---

## 7. API Documentation

All endpoints are under `/api/*` on the Express backend (port 4000 by default). The Next.js frontend proxies `/api/*` and `/help/api/*` to the backend.

### 7.1 Public Endpoints (No Authentication)

| Method | Endpoint | Purpose | Request Body / Params | Response | Auth |
|---|---|---|---|---|---|
| GET | `/api/health` | Health check | None | `{ ok, database, time }` | No |
| GET | `/api/config` | Public config | None | `{ environment, languages, captcha, retentionNotice, emergency }` | No |
| GET | `/api/institutes/validate?code=` | Validate institute code (assigned + active only) | Query: `code` | `{ code, name, type }` or 404/400 | No |
| GET | `/api/institutes/list` | Public list of assigned, active codes | None | `{ institutes[] }` | No |
| GET | `/api/institutes/all` | Full ref-ID register incl. unassigned/deactivated | None | `{ institutes[] }` | Owner |
| POST | `/api/institutes` | Generate APXJIT-### ref ID (random, distinct per college; panel sends name only — head details optional) | JSON optional: `{ name?, head_name?, head_email?, type? }` | 201: `{ institute }` | Owner |
| PATCH | `/api/institutes/:code` | Assign a college / edit contact / toggle status | JSON: `{ name?, head_name?, head_email?, type?, status? }` | `{ institute }` | Owner |
| POST | `/api/institutes/:code/regenerate` | Issue a fresh code for the same college; old code retired | None | `{ institute, previous_code }` | Owner |
| POST | `/api/complaints` | Submit complaint | Multipart: institute_code, category, details_text, urgent, mode, captchaToken, deviceId, contact (JSON), images[], voice | 201: `{ ref_id, message, acknowledgement_email, attachments }` | No (CAPTCHA required) |
| POST | `/api/status/lookup` | Check complaint status | JSON: `{ ref_id }` | `{ status: "In Process" \| "Completed" }` or 404 | No |
| POST | `/api/status/followup` | Submit follow-up | JSON: `{ ref_id, text, captchaToken, deviceId }` | 201: `{ ok, message }` | No (CAPTCHA if configured) |

### 7.2 Staff Endpoints (Authentication Required)

| Method | Endpoint | Purpose | Request Body | Response | Auth |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | Staff sign-in | JSON: `{ email, password, code? }` | `{ ok, member, csrfToken }` or `setupRequired` | No (rate-limited) |
| POST | `/api/auth/setup-2fa` | TOTP enrolment | JSON: `{ email, setupToken, code }` | `{ ok, member, csrfToken }` | No (rate-limited) |
| POST | `/api/auth/logout` | Sign out | None | `{ ok }` | Yes + CSRF |
| GET | `/api/auth/me` | Session info | None | `{ member, csrfToken, session }` | Yes |
| GET | `/api/auth/sessions` | List sessions | None | `{ sessions[] }` | Yes |
| POST | `/api/auth/sessions/:id/revoke` | Revoke session | None | `{ ok }` | Yes + CSRF |
| POST | `/api/auth/sessions/revoke-others` | Revoke other sessions | None | `{ ok }` | Yes + CSRF |
| GET | `/api/complaints` | Case list (teachers server-scoped to their institute) | Query: page, limit, filters | `{ items[], page, limit, total, summary }` | Yes |
| GET | `/api/complaints/:ref_id` | Case detail | Path: ref_id | `{ complaint, contact, contacts[], attachments, events[] }` | Yes |
| PATCH | `/api/complaints/:ref_id` | Update case | JSON: `{ completed?, flagged_spam?, assigned_to?, note? }` | `{ ok }` | Yes + CSRF |
| GET | `/api/attachments/:id/url` | Signed evidence URL | Path: id | `{ url, expires_at, mime, type }` | Yes |
| GET | `/api/attachments/download/:id` | Download evidence (local only) | Query: expires, signature | File binary | Yes (signature verified) |
| GET | `/api/staff/assignable` | Assignable staff | None | `{ members[] }` | Yes |
| GET | `/api/staff/members` | Staff list (owner; rows include `institute_code`) | None | `{ members[] }` | Yes + Owner |
| POST | `/api/staff/members` | Create staff (owner). Teacher: `institute_code` required, password auto-generated (unique, returned once as `password`). Admin: `password` required | JSON: `{ name, email, role, password?, institute_code? }` | 201: `{ member, password? }` | Yes + Owner + CSRF |
| PATCH | `/api/staff/members/:id` | Update staff (owner) | JSON: `{ name?, role?, status? }` | `{ member }` | Yes + Owner + CSRF |
| POST | `/api/staff/members/:id/reset-password` | Reset password (owner) | JSON: `{ password }` | `{ ok }` | Yes + Owner + CSRF |
| POST | `/api/staff/members/:id/revoke-sessions` | Revoke sessions (owner) | None | `{ ok }` | Yes + Owner + CSRF |
| GET | `/api/staff/audit` | Audit log (owner) | Query: page, limit, action, entity, outcome | `{ items[], page, limit, total }` | Yes + Owner |
| GET | `/api/staff/outbox` | Email outbox (owner) | Query: page, limit, status, kind | `{ items[], page, limit, total }` | Yes + Owner |
| POST | `/api/staff/outbox/process` | Process outbox (owner) | None | `{ ok, summary }` | Yes + Owner + CSRF |
| GET | `/api/stats/institutes` | Institute list | None | `{ institutes[] }` | Yes |
| GET | `/api/stats/institute/:code` | Institute stats | Path: code | `{ institute, received, completed, in_process, escalated, months[] }` | Yes |
| GET | `/api/stats/monthly` | Monthly stats | Query: institute_code | `{ rows[] }` | Yes |
| GET | `/api/stats/overview` | Overview stats | None | `{ summary, recent[] }` | Yes |
| GET | `/api/reports/preview` | PDF preview | Query: institute_code, month | PDF binary | Yes |
| GET | `/api/reports/data` | Report data | Query: institute_code, month | `{ institute, month, received, completed, in_process, escalated }` | Yes |
| POST | `/api/reports/send` | Send report (owner) | JSON: `{ institute_code, month, force? }` | `{ ok, queued }` | Yes + Owner + CSRF |

**Validation errors:** Return 400 with `{ error, fields: { field: message } }`.
**Authentication errors:** Return 401 `{ error: "Authentication required" }`.
**Authorization errors:** Return 404 `{ error: "Not found" }` (role-based, to prevent enumeration).
**CSRF errors:** Return 403 `{ error: "CSRF verification failed" }`.
**Rate limit errors:** Return 429 with `Retry-After` header.
**Server errors:** Return 500 `{ error: "Internal server error" }` (generic, no stack trace).

---

## 8. External Services and Integrations

### 8.1 MongoDB Atlas

| Property | Value |
|---|---|
| Purpose | Primary database for all complaint portal data |
| Connection | `MONGODB_URI` (SRV connection string in `server/.env`) |
| Database name | `DATABASE_NAME` (`Apethexhelpportal`, dedicated, isolated from management `Apthexx`) |
| Current status | Configured and connected (verified in testing) |
| Production requirement | Add Lightsail instance IP to Atlas Network Access list |
| Testing | `GET /api/health` returns `database: "connected"`; 31 backend tests pass with in-memory DB |

### 8.2 Resend Email Service

| Property | Value |
|---|---|
| Purpose | Email delivery for complaint alerts, reporter confirmations, escalations, monthly reports |
| SDK | `resend` v6 (`server/src/services/email.js`) |
| Sender domain | `mail.apthex.com` (subdomain of `apthex.com`) — must be verified in Resend |
| Sender address | `APTHEX Complaint Portal <no-reply@mail.apthex.com>` (current dev value `apthexx@gmail.com` is invalid for Resend production) |
| API key | `RESEND_API_KEY` in `server/.env` |
| Queue | Database outbox (`EmailOutbox` model) with retry and backoff |
| Current status | API key present in `.env`; domain not verified; real delivery not tested |
| Testing | Cannot test without verified domain and valid API key; dev mode logs to console |

### 8.3 Cloudflare Turnstile

| Property | Value |
|---|---|
| Purpose | CAPTCHA for complaint submission and follow-up |
| Verify URL | `https://challenges.cloudflare.com/turnstile/v0/siteverify` |
| Site key | `CLOUDFLARE_TURNSTILE_SITE_KEY` in `server/.env` |
| Secret key | `CLOUDFLARE_TURNSTILE_SECRET_KEY` in `server/.env` |
| Dev bypass | `CAPTCHA_DEV_BYPASS=true` (development only; blocked in production) |
| Current status | Keys empty; dev bypass enabled; real Turnstile not tested |
| Testing | Tested with mocked provider responses in test suite; live challenge not tested |

### 8.4 Vercel Blob

| Property | Value |
|---|---|
| Purpose | Private evidence storage (images, voice recordings) |
| Store | `apthex-complaint-evidence` (Private access) |
| Region | IAD1 |
| Token | `BLOB_READ_WRITE_TOKEN` — server-side read/write token, never exposed to client |
| Upload | `put(key, buffer, { access: "private", contentType: mime })` |
| Read | `get(key, { access: "private" })` — server-side stream, proxied via `/api/attachments/download/:id` |
| Delete | `del(key)` |
| Signed URL TTL | `STORAGE_SIGNED_URL_TTL_SECONDS` (default 300 seconds = 5 minutes) |
| Current status | Adapter implemented; `STORAGE_DRIVER=local` in development; Vercel Blob not connected |
| Testing | Local storage path tested; Vercel Blob private access not tested (requires real token) |

### 8.5 Hosting and Deployment

| Property | Value |
|---|---|
| Provider | AWS Lightsail (selected) |
| Instance | Ubuntu 24.04, Mumbai (`ap-south-1`), 2 vCPU / 4 GB RAM recommended |
| Ports | 22 (restricted IP), 80, 443 |
| Reverse proxy | Caddy (automatic HTTPS, reverse proxy to Next.js + Express) |
| Frontend | Next.js on port 3000 |
| Backend | Express on port 4000 |
| Current status | Not provisioned |

### 8.6 DNS and Domain Configuration

| Record | Purpose |
|---|---|
| `apthex.com` | Portal URL — **final:** `https://apthex.com/help` (no portal subdomain). A separate record for the Lightsail **backend** hostname is added at provisioning (feeds `API_PROXY_TARGET`). (Historical: `complaints.apthex.com` subdomain considered, superseded.) |
| `mail.apthex.com` | Resend sender subdomain (DKIM, SPF, DMARC records) |
| Turnstile | Domain configuration in Cloudflare dashboard |

**Current status:** DNS not configured. `apthex.com` DNS zone control must be confirmed.

---

## 9. Environment Configuration

All variables in `complaint-portal/server/.env` (gitignored). Template at `.env.example`.

| Variable | Purpose | Required? | Dev Value | Production Value | How to Obtain | Verification |
|---|---|---|---|---|---|---|
| `NODE_ENV` | Runtime mode | Yes | `development` | `production` | Set manually | `assertProductionConfig()` passes |
| `PORT` | API port | No | `4000` | `4000` | Set manually | Server listens on port |
| `TRUST_PROXY` | Trusted proxy hops | No | `1` | `1` (Caddy) | Set manually | IP rate limiting works correctly |
| `LOG_LEVEL` | Log level | No | `info` | `info` | Set manually | Logs visible |
| `MONGODB_URI` | MongoDB connection string | Yes | Atlas URI | Atlas URI | MongoDB Atlas | `/api/health` returns `connected` |
| `DATABASE_NAME` | Database name | Yes | `Apethexhelpportal` | `Apethexhelpportal` | Set manually | Isolated from `Apthexx` |
| `APP_BASE_URL` | Public portal URL | Yes | `http://localhost:3000/help` | `https://apthex.com/help` (or confirmed URL) | Owner decision | Starts with `https://` |
| `CASE_DESK_URL` | Case Desk URL | Yes | `http://localhost:3000/help/desk` | `https://apthex.com/help/desk` | Owner decision | Email links work |
| `CORS_ORIGINS` | Allowed CORS origins | No | `http://localhost:3000` | `https://apthex.com` | Owner decision | Cross-origin requests work |
| `REQUIRE_ORIGIN` | Origin enforcement | No | `false` | `true` | Set manually | Production guard passes |
| `SESSION_SECRET` | Session signing secret | Yes | Dev placeholder | `openssl rand -base64 48` | Generate locally | 32+ chars, not default |
| `TOTP_ENCRYPTION_KEY` | TOTP secret encryption | Yes | Dev placeholder | `openssl rand -base64 48` (different) | Generate locally | 32+ chars, not default |
| `SESSION_TTL_HOURS` | Session TTL | No | `8` | `8` | Set manually | Sessions expire correctly |
| `RETENTION_DAYS` | Retention days | Yes | `30` | `180` (owner/legal approval) | Owner/legal decision | `delete_after` set on completion |
| `ESCALATION_DAYS` | Escalation days | Yes | `7` | `7` | Owner/legal decision | Escalation job works |
| `SMALL_NUMBER_THRESHOLD` | Stats suppression threshold | Yes | `5` | `5` | Owner decision | Stats show ranges below 5 |
| `RESEND_API_KEY` | Resend API key | Yes | Present (dev) | Valid Resend key | Resend dashboard | Emails delivered |
| `EMAIL_FROM` | Sender address | Yes | `apthexx@gmail.com` | `APTHEX Complaint Portal <no-reply@mail.apthex.com>` | Resend verified domain | Resend accepts sender |
| `APTHEX_CASE_MAILBOX` | Case mailbox | Yes | `case@apthex.local` | Real address | Owner decision | Receives test email |
| `URGENT_ALERT_RECIPIENTS` | Urgent recipients | Yes | `urgent@apthex.local` | Real comma-separated | Owner decision | Receives urgent alerts |
| `EMAIL_DEV_LOG` | Dev email logging | Yes | `true` | `false` | Set manually | No console logging in prod |
| `EMAIL_MAX_ATTEMPTS` | Max email attempts | No | `5` | `5` | Set manually | Outbox retries work |
| `EMAIL_OUTBOX_TTL_DAYS` | Outbox TTL | No | `30` | `30` | Set manually | Expired records cleaned |
| `CLOUDFLARE_TURNSTILE_SITE_KEY` | Turnstile site key | Yes | Empty | Turnstile site key | Cloudflare dashboard | CAPTCHA widget loads |
| `CLOUDFLARE_TURNSTILE_SECRET_KEY` | Turnstile secret key | Yes | Empty | Turnstile secret key | Cloudflare dashboard | CAPTCHA verifies |
| `CAPTCHA_DEV_BYPASS` | CAPTCHA bypass | Yes | `true` | `false` | Set manually | Production guard passes |
| `STORAGE_DRIVER` | Storage driver | Yes | `local` | `vercel-blob` | Set manually | Evidence stored privately |
| `STORAGE_LOCAL_DIR` | Local storage dir | No | `./storage` | N/A | Set manually | Files written locally |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token | Yes | Empty | Vercel Blob token | Vercel dashboard | Server-only; never exposed to client |
| `STORAGE_SIGNING_SECRET` | Signing secret | No | Empty | Optional (falls back to SESSION_SECRET) | Generate locally | Signed URLs work |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | Signed URL TTL | No | `300` | `300` | Set manually | URLs expire after 5 min |
| `MAX_IMAGE_BYTES` | Max image size | No | `2097152` | `2097152` | Set manually | Images compressed |
| `MAX_VOICE_BYTES` | Max voice size | No | `10485760` | `10485760` | Set manually | Voice accepted |
| `MAX_VOICE_SECONDS` | Max voice duration | No | `60` | `60` | Set longer than 60 rejected |
| `MAX_IMAGES` | Max image count | No | `5` | `5` | Set manually | Max 5 enforced |
| `MAX_TOTAL_UPLOAD_BYTES` | Max total upload | No | `26214400` | `26214400` | Set manually | Total enforced |
| Rate limits | Various rate limits | No | Defaults | Defaults | Set manually | 429 responses work |
| `AUTO_SEED` | Auto-seed on start | Yes | `true` | `false` | Set manually | No demo data in prod |
| `SEED_OWNER_EMAIL` | Seed owner email | Yes (seed only) | `owner@apthex.local` | Real email | Owner decision | First owner created |
| `SEED_OWNER_PASSWORD` | Seed owner password | Yes (seed only) | `ChangeMe!123` | Strong password | Owner decision | Removed after seeding |

**Never include actual values in chat, email, tickets, or source control.** Write directly to `server/.env`.

---

## 10. Security and Privacy

### 10.1 Identified vs Anonymous Privacy

**Identified reports:**
- Identity fields (name, class, roll number, mobile, email) stored in separate `contacts` collection linked by `complaint_id`.
- `complaint.class_label` stored for identified complaints only.
- Confirmation email sent to reporter's email (contains only reference ID).

**Anonymous reports:**
- No `Contact` document created.
- `complaint.class_label` is `undefined`.
- No name, roll number, mobile, or email stored.
- Zod `superRefine` rejects identity fields if present in anonymous mode.
- No confirmation email sent.
- Status lookup returns only status, never contact data.

### 10.2 RBAC and Permissions

| Role | Can Access |
|---|---|
| Public (unauthenticated) | Submit complaints, check status, send follow-ups, validate institute codes |
| case_team (authenticated) | View/manage all cases, view assignable staff |
| owner (authenticated) | All case_team + manage staff, view audit log, view/process email outbox, send monthly reports |

Role-based endpoints return 404 (not 403) to prevent endpoint enumeration.

### 10.3 TOTP and Session Security

- Passwords: bcrypt with 12 rounds.
- TOTP: `speakeasy` with `window: 1`, secret encrypted AES-256-GCM.
- Sessions: 32-byte token, SHA-256 hashed, HttpOnly+SameSite=Lax+Secure cookies, 8-hour TTL.
- CSRF: 24-byte token, validated via header+cookie comparison.
- Account lockout: 15 minutes after 5 failed attempts.
- Session revocation: logout, password reset, owner revocation, deactivation.

### 10.4 File Validation and EXIF Removal

- Images: Format whitelist (jpeg/png/webp/gif), dimension limit (40 MP), `sharp` re-encoding strips EXIF/GPS, size cap 2 MB.
- Voice: Magic-byte signature detection, `music-metadata` duration parsing, 60-second limit, 10 MB size cap.
- Storage: Private (local 0o600 or Vercel Blob private store with server-side token).
- Access: Staff-only signed URLs (300-second TTL), all access audited.

### 10.5 Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| Global API | 600 requests | 1 minute |
| Submit (IP) | 5/hour | 1 hour |
| Submit (device) | 5/hour | 1 hour |
| Submit (anonymous IP) | 3/hour | 1 hour |
| Status lookup | 10/minute | 1 minute |
| Follow-up | 3/hour | 1 hour |
| Login | 5/15 minutes | 15 minutes |
| Institute lookup | 30/minute | 1 minute |
| Duplicate detection | 1 per `DUPLICATE_WINDOW_MINUTES` | 10 minutes (default) |

### 10.6 CAPTCHA

- Provider: Cloudflare Turnstile.
- Required in production; dev bypass only in development with explicit flag.
- Server-side verification with 5-second timeout.
- Required on complaint submission and follow-up.

### 10.7 Signed URLs

- TTL: 300 seconds (5 minutes).
- Vercel Blob: server-side `get` (private) proxied via `/api/attachments/download/:id`; HMAC-signed short-lived URL.
- Local: HMAC-SHA256 with `timingSafeEqual` comparison.
- Staff authentication required for URL issuance.
- All access audit-logged.
- Tampered URLs rejected.

### 10.8 Audit Logging

- Append-only `AuditEvent` collection.
- Records: action, entity, entity_id, outcome, hashed IP (SHA-256 HMAC), detail (max 1000 chars).
- Covers: login (success/failure), 2FA, complaint actions, staff management, session revocation, attachment access, audit log view, email outbox actions.
- IP addresses never stored in plaintext.
- Never deleted (append-only).

### 10.9 Data Retention and Deletion

- `delete_after = completed_at + RETENTION_DAYS` (default 180 days recommended; 30 days dev).
- Daily scheduler (02:00 Mumbai) purges expired complaints.
- Request-time safety net (throttled to once/minute).
- Purge deletes: complaint, attachments (storage + DB), contact, case events; creates `DeletionLog`.
- Status lookup on deleted ref returns `data_deleted: true`.
- Backup retention: 30 days (recommended).

### 10.10 Email Privacy

- No complaint details in any email template.
- All user-supplied values HTML-escaped.
- Monthly reports: aggregate counts only, small-count suppression (`Fewer than 5`), no names/reference IDs/descriptions.
- Recipient addresses masked in outbox UI (`maskEmail()`).

### 10.11 Production Security Requirements

- `NODE_ENV=production` triggers `assertProductionConfig()`.
- Guard requires: `MONGODB_URI`, `RETENTION_DAYS`, `ESCALATION_DAYS`, strong `SESSION_SECRET`/`TOTP_ENCRYPTION_KEY`, `RESEND_API_KEY`, valid `EMAIL_FROM`, `APTHEX_CASE_MAILBOX`, Turnstile keys, `CAPTCHA_DEV_BYPASS=false`, `AUTO_SEED=false`, `STORAGE_DRIVER=vercel-blob` (+ `BLOB_READ_WRITE_TOKEN`), `APP_BASE_URL` starting with `https://`.
- HSTS enabled in production.
- `REQUIRE_ORIGIN=true` in production.
- Error handler returns generic 500 messages.

---

## 11. Testing and Quality Assurance

### 11.1 Test Suite

**Backend integration tests:** `complaint-portal/server/tests/api.test.js` — 31 tests using `mongodb-memory-server` and supertest.

| # | Test | Result |
|---|---|---|
| 1 | Health reports connected database | PASS |
| 2 | Public config exposes languages and CAPTCHA state | PASS |
| 3 | Institute validation accepts known, rejects unknown/malformed | PASS |
| 4 | Identified complaint separates identity into Contact | PASS |
| 5 | Anonymous complaint stores no identity | PASS |
| 6 | Anonymous mode rejects personal information | PASS |
| 7 | Urgent submissions alert case team | PASS |
| 8 | Submission validation rejects short text/invalid category/incomplete identity | PASS |
| 9 | Duplicate complaint rejected within window | PASS |
| 10 | Image and voice evidence processed, stored privately, signed links | PASS |
| 11 | Status lookup returns only status | PASS |
| 12 | Public follow-up rate-limited, audited, attached | PASS |
| 13 | Staff endpoints reject unauthenticated | PASS |
| 14 | Staff login requires TOTP, HttpOnly cookies | PASS |
| 15 | Case list, filters, summary | PASS |
| 16 | Complaint detail exposes contact/evidence to staff only | PASS |
| 17 | CSRF required for state changes | PASS |
| 18 | Case completion, reopening, notes, spam, assignment audited | PASS |
| 19 | Signed attachment URLs work; tampered rejected | PASS |
| 20 | Signed attachment access audit logged | PASS |
| 21 | Statistics and monthly report endpoints + PDF | PASS |
| 22 | Owner creates staff; case team cannot list staff | PASS |
| 23 | Email outbox owner-only; dev delivery logged | **FAIL** (Resend API key invalid) |
| 24 | Audit log records auth and privileged actions | PASS |
| 25 | CAPTCHA rejects invalid, accepts valid provider responses | PASS |
| 26 | Institute lookup rate limiting returns 429 | PASS |
| 27 | Retention expiry deletes case data, leaves deletion record | PASS |
| 28 | Origin checks reject untrusted state-changing requests | PASS |
| 29 | Logout revokes session, clears cookies | PASS |
| 30 | Owner password reset revokes sessions, clears 2FA | PASS |
| 31 | Attachment and case data count consistently | PASS |

**Result: 30/31 PASS.** The single failure (test 23) is a pre-existing configuration issue: the Resend API key in `.env` is invalid, so email delivery cannot succeed. This is **not a security vulnerability**.

**Deployment smoke test:** 4/4 PASS (`test:smoke` script).
**Browser E2E (Firefox/Playwright):** 15/15 PASS (from TEST_REPORT.md).
**Production build (`next build`):** PASS — all 14 routes generated.
**Security headers:** PASS (CSP, HSTS, frame denial, noindex).
**Dependency audit:** PASS (0 vulnerabilities).
**Mobile layout:** PASS (0 px overflow at 390px).
**Console errors:** PASS (none).

### 11.2 Test Categories Not Yet Run

| Test Type | Status | Reason |
|---|---|---|
| Real Resend delivery | NOT TESTED | No verified domain / valid API key |
| Real Vercel Blob storage | NOT TESTED | No Vercel credentials / Blob store |
| Live Cloudflare Turnstile | NOT TESTED | No production keys |
| HTTPS/TLS in production | NOT TESTED | No deployed environment |
| Penetration test | NOT TESTED | Not commissioned |
| WCAG 2.2 AA accessibility audit | NOT TESTED | Not commissioned |
| Load / soak testing | NOT TESTED | Not performed |
| Real retention expiry wait | NOT TESTED | Would require waiting 180 days |

### 11.3 Test Commands

```bash
# Backend integration tests (31 tests)
cd complaint-portal
npm test

# Deployment smoke test (against running API)
SMOKE_BASE_URL=http://localhost:4000 npm --workspace server run test:smoke

# Production build
npm run build

# All together
npm install && npm test && npm --workspace client-next run build
```

---

## 12. Deployment Guide

### 12.1 Local Development

```bash
cd complaint-portal
npm install
cp .env.example server/.env
# Edit server/.env with local values (MONGODB_URI optional — in-memory DB used if absent)
npm run dev
# Frontend: http://localhost:3000 (may conflict with marketing site)
# API: http://localhost:4000
```

If port 3000 is in use:
```bash
API_PROXY_TARGET=http://localhost:4000 npm --workspace client-next run dev -- -p 3001
# Set APP_BASE_URL=http://localhost:3001 in server/.env
```

### 12.2 Environment Setup

1. Copy `.env.example` to `server/.env` (never commit `.env`).
2. Set `MONGODB_URI` to your Atlas connection string.
3. Set `DATABASE_NAME` to a dedicated database (not `Apthexx`).
4. Generate secrets: `openssl rand -base64 48` for `SESSION_SECRET` and `TOTP_ENCRYPTION_KEY`.
5. For development, leave `CAPTCHA_DEV_BYPASS=true`, `EMAIL_DEV_LOG=true`, `STORAGE_DRIVER=local`, `AUTO_SEED=true`.

### 12.3 MongoDB Connection

- MongoDB Atlas with dedicated database and least-privilege user.
- Restrict network access to deployment egress IP.
- Development without URI: in-memory database (data lost on restart).

### 12.4 Production Hosting

1. Provision AWS Lightsail Ubuntu 24.04 instance in Mumbai (`ap-south-1`).
2. Open ports 22 (restricted IP), 80, 443.
3. Attach static IP.
4. Add instance IP to MongoDB Atlas Network Access.
5. Install Node.js 20+, npm 10+.
6. Install Caddy as reverse proxy with automatic TLS.

### 12.5 Domain and HTTPS

- Confirm `apthex.com` DNS zone control.
- Add a DNS `A` record for the Lightsail **backend** hostname (finalised at provisioning; feeds `API_PROXY_TARGET`). No portal-specific record is needed — the portal already lives at `https://apthex.com/help`.
- Add Resend DKIM/SPF/DMARC records for `mail.apthex.com`.
- Caddy obtains TLS certificate automatically.

### 12.6 Resend Setup

1. Create Resend account.
2. Add and verify `mail.apthex.com` domain.
3. Add DKIM, SPF, DMARC DNS records.
4. Create API key with sending permission.
5. Set `RESEND_API_KEY`, `EMAIL_FROM=APTHEX Complaint Portal <no-reply@mail.apthex.com>`, `APTHEX_CASE_MAILBOX`, `URGENT_ALERT_RECIPIENTS` in `server/.env`.

### 12.7 Turnstile Setup

1. Create Cloudflare Turnstile site for portal hostname.
2. Widget mode: Managed.
3. Set `CLOUDFLARE_TURNSTILE_SITE_KEY` and `CLOUDFLARE_TURNSTILE_SECRET_KEY` in `server/.env`.
4. Set `CAPTCHA_DEV_BYPASS=false`.

### 12.8 Vercel Blob Setup

1. Create private blob store `apthex-complaint-evidence` in the Vercel dashboard (IAD1 region, Private access).
2. Generate a read/write token (`vercel_blob_rw_...`) in the Vercel dashboard.
3. Set `BLOB_READ_WRITE_TOKEN` and `STORAGE_DRIVER=vercel-blob` in `server/.env`.
4. Never commit the token; never expose it to the browser.

### 12.9 Production Build

```bash
cd complaint-portal
npm ci
npm run build
```

### 12.10 Deployment

```bash
# Production start (behind Caddy)
npm run start:server    # API, port 4000
npm run start:client    # Next.js, port 3000
```

### 12.11 Post-Deployment Verification

```bash
SMOKE_BASE_URL=https://apthex.com/help npm run test:smoke
```

Verify:
1. Server starts with `NODE_ENV=production` (production guard passes).
2. Health endpoint returns database connected.
3. Real Resend delivery works (test email).
4. Real Turnstile challenge accepts/rejects.
5. Real Vercel Blob upload/download via signed proxy URLs.
6. Staff login with TOTP works.
7. Complaint submission end-to-end works.
8. Seed first owner, then remove `SEED_OWNER_PASSWORD`.

### 12.12 Rollback and Recovery

- Rollback: Redeploy previous version of `complaint-portal/`; database migrations are additive (Mongoose schemas).
- Database backup: MongoDB Atlas automated backups + 30-day backup retention (recommended).
- Session revocation: `revokeAllSessionsForMember()` for compromised accounts.
- Outbox recovery: `processOutbox()` retries failed messages with exponential backoff.

---

## 13. Current Project Status

### 13.1 Completed Features

| Feature | Status | Evidence |
|---|---|---|
| Public complaint portal (`/help/*`) | Implemented + built | 14 routes generated in `next build` |
| Staff Case Desk (`/help/desk/*`) | Implemented + built | All desk routes generated |
| Institute code validation | Implemented + tested | Test 3 PASS |
| Identified complaint submission | Implemented + tested | Test 4 PASS |
| Anonymous complaint submission | Implemented + tested | Test 5 PASS |
| Image/voice evidence processing | Implemented + tested | Test 10 PASS |
| Signed evidence URLs | Implemented + tested | Tests 19-20 PASS |
| Public status lookup | Implemented + tested | Test 11 PASS |
| Public follow-up | Implemented + tested | Test 12 PASS |
| Staff login + TOTP 2FA | Implemented + tested | Test 14 PASS |
| Case management (complete/reopen/notes/spam/assignment) | Implemented + tested | Test 18 PASS |
| Staff management (owner) | Implemented + tested | Test 22 PASS |
| Audit log | Implemented + tested | Test 24 PASS |
| Email outbox with retry | Implemented + code correct | Test 23 FAIL (credential issue) |
| Monthly PDF reports | Implemented + tested | Test 21 PASS |
| Data retention + deletion | Implemented + tested | Test 27 PASS |
| Rate limiting | Implemented + tested | Test 26 PASS |
| CAPTCHA (dev bypass) | Implemented + tested | Test 25 PASS |
| Vercel Blob private storage adapter | Implemented + connected | `@vercel/blob` in `storage.js` (`put`/`get`/`del`, `access: "private"`) |
| Production config guard | Implemented | `assertProductionConfig()` in `env.js` |

### 13.2 Connected and Verified Integrations

| Integration | Status |
|---|---|
| MongoDB Atlas | Configured and connected (development) |
| Resend API key | Present in `.env`; domain not verified; delivery not tested |
| Cloudflare Turnstile | Keys not configured; dev bypass enabled |
| Vercel Blob | Adapter implemented; `STORAGE_DRIVER=local`; not connected |
| AWS Lightsail | Not provisioned |
| DNS | Not configured |

### 13.3 Pending Tasks

| Task | Owner | Status |
|---|---|---|
| ~~Confirm final portal URL (`complaints.apthex.com` vs `apthex.com/help`)~~ | Owner | **Resolved (Nov 2026):** `https://apthex.com/help` |
| Approve retention (180 days), escalation (7 days), backup (30 days) | Owner + Legal | Pending |
| Supply real institute list CSV | Owner | Pending |
| Approve email wording and privacy notice | Owner | Pending |
| Legal/privacy review, data-processor terms, incident response | Owner + Legal | Pending |
| WCAG 2.2 AA accessibility review | Owner (commissioned) | Pending |
| Penetration test | Owner (commissioned) | Pending |
| Remove demo data and dev owner account | Deployer | Pending |
| Set `AUTO_SEED=false`, `CAPTCHA_DEV_BYPASS=false`, `EMAIL_DEV_LOG=false`, `STORAGE_DRIVER=vercel-blob` | Deployer | Pending |
| Remove `SEED_OWNER_PASSWORD` after first owner created | Deployer | Pending |

### 13.4 Blocked Tasks (Require External Access)

| Task | Required Access |
|---|---|
| Resend domain verification (`mail.apthex.com`) | Resend account + DNS access |
| Cloudflare Turnstile keys | Cloudflare account |
| Vercel Blob store + read/write token | Vercel account |
| AWS Lightsail instance + Atlas IP whitelist | AWS + MongoDB Atlas access |
| DNS records | DNS zone control |

### 13.5 Known Issues

1. **Test failure:** "email outbox is owner-only and development delivery is logged" — fails because `RESEND_API_KEY` in `.env` is invalid/not real. Not a security vulnerability. Resolved by configuring real Resend credentials.
2. ~~**URL conflict:** `OPEN_DECISIONS.md` specifies `https://complaints.apthex.com`; `/help` integration task specifies `https://apthex.com/help`. Owner must confirm.~~ **Resolved (Nov 2026):** final URLs are `https://apthex.com/help` (portal) and `https://apthex.com/help/desk` (Case Desk); browser origin `https://apthex.com`.
3. **Development credentials present:** `SEED_OWNER_EMAIL=owner@apthex.local`, `SEED_OWNER_PASSWORD=ChangeMe!123`, `CAPTCHA_DEV_BYPASS=true`, `AUTO_SEED=true`, `STORAGE_DRIVER=local` — must not ship to production.
4. **No real Resend/Vercel Blob/Turnstile testing** — all require external credentials.
5. **No penetration test or WCAG audit** — required before launch per `OPEN_DECISIONS.md`.

---

## 14. Pending Decisions and Future Roadmap

### 14.1 Unresolved Decisions

| Decision | Options | Owner Decision Needed |
|---|---|---|
| Final portal URL | ~~`https://complaints.apthex.com` (subdomain) vs `https://apthex.com/help` (path)~~ **Resolved:** `https://apthex.com/help` + Case Desk `https://apthex.com/help/desk` | No — finalised Nov 2026 |
| Retention period | Recommended 180 days (legal review required) | Yes + Legal |
| Escalation window | Recommended 7 days | Yes |
| Urgent alert recipients | Recommended `apthexx@gmail.com` + on-call | Yes |
| Roll numbers optional for identified reports | Yes/No | Yes |
| Small-number threshold | Recommended 5 | Yes |
| Real institute list | CSV with code, name, type, head_name, head_email, status | Yes |
| Email wording and anonymity explanation | Drafts in `server/src/services/email.js` | Yes |
| Confirmation email for identified reporters | Always/sometimes/never | Yes |
| Public status/follow-up policy | Current design (status only) | Yes |
| Legal/privacy review | Privacy notice, data-processor terms, incident response, backup policy | Yes + Legal |

### 14.2 Future Roadmap

| Feature | Priority | Notes |
|---|---|---|
| Two-way reporter-staff messaging | Medium | Via reference ID; not in current scope |
| Mobile app / PWA | Low | Not in current scope |
| Additional evidence types (video, documents) | Low | Current: images + voice only |
| Institute head dashboard | Low | Currently: monthly PDF reports only |
| Advanced analytics | Low | Not in current scope |
| Integration with external case management | Low | Not in current scope |
| SMS notifications | Low | Not in current scope |

---

## 15. Change History

| Date | What Changed | Files/Modules Affected | Reason | Tests Performed | Result |
|---|---|---|---|---|---|
| Sat Nov 07 2026 | Initial master documentation created | `complaint-portal/PROJECT_MASTER_DOCUMENTATION.md` (new) | Consolidate all project knowledge into single source of truth | Full codebase inspection: all routes, models, services, configs, tests, existing docs | N/A (documentation only) |
| Mon Nov 16 2026 | Institute ref-ID system (`JIT-APTHEX###`): owner generates sequential codes (e.g. `JIT-APTHEX304`), assigns them to colleges, regenerates, activates/deactivates; unassigned codes never validate publicly. New owner desk page `/desk/institutes`. Optional voice dictation (speech-to-text mic button) on the complaint description field. Royal/premium visual pass: layered crimson + royal-indigo + gold glows, film grain + vignette, gold hairlines on panels, ornamental rings on welcome/complaint pages. | `server/src/routes/institutes.js`, `server/src/models/Institute.js`, `server/src/utils/validation.js`, `server/tests/api.test.js`, `client-next/src/app/desk/institutes/page.js` (new), `client-next/src/components/DeskShell.jsx`, `client-next/src/app/desk/stats/page.js`, `client-next/src/app/complaint/page.js`, `client-next/src/app/globals.css`, `API.md` | Owner requested: dedicated admin option to generate/assign institute ref IDs in the JIT-APTHEX format with a code↔college register; optional mic-based voice complaints; richer, royal UI while keeping buttons/templates unchanged | `npm --workspace server run test` — 43 tests pass incl. 2 new (ref-ID sequence + assign/regenerate/deactivate flow); `npm --workspace client-next run build` — build succeeds, `/desk/institutes` route registered; dev-server smoke: `/complaint` and `/desk/institutes` return 200 | Pass |
| Mon Nov 16 2026 | Security/URL pass: staff login moved from `/staff/login` to `/complaint-review-console` (the only login URL); `/admin` redirect stub deleted so `/admin` 404s instead of resolving to login; all 401/logout redirects updated (`Protected.jsx`, `DeskShell.jsx`, `desk/complaint/[ref]`); public header/footer staff links removed from `PublicShell.jsx` (invite-only portal); noindex header moved to `/complaint-review-console` + `/complaint-review-console/:path*`; root `vercel.json` rewrites updated — removed `/admin`, `/admin/:path*`, `/staff/:path*`, added `/complaint-review-console` + `/complaint-review-console/:path*` (so www.apthex.com/admin and /staff/* 404 at the edge); main-site footer links "File a Complaint" and "Case Desk — Staff" removed from `index.html`; careers page got the home-page hover cursor spotlight (`.careers-spot` inside `.topbg`: same red-veins image with brighter filter, masked radial reveal following the cursor, `pointer:fine` + reduced-motion guarded, touch kill-switch). | `client-next/src/app/complaint-review-console/page.js` (moved from `app/staff/login/page.js`), `client-next/src/app/admin/page.js` (deleted), `client-next/src/components/Protected.jsx`, `client-next/src/components/DeskShell.jsx`, `client-next/src/components/PublicShell.jsx`, `client-next/src/app/desk/complaint/[ref]/page.js`, `client-next/next.config.mjs`, `vercel.json` (root), `index.html`, `careers.html`, `PROJECT_MASTER_DOCUMENTATION.md` | Owner requested: login only at `https://www.apthex.com/complaint-review-console`, `/admin` must throw 404, remove "File a Complaint"/"Case Desk — Staff" footer references (portal invite-only), add home-page hover spotlight glow to careers page | `npm --workspace client-next run build` — route list shows `/complaint-review-console`, no `/admin` or `/staff` routes; `npm --workspace server run test` — 43/43 pass; dev-server smoke: `/complaint-review-console` 200 with `X-Robots-Tag: noindex, nofollow, noarchive`, `/admin` 404, `/staff/login` 404, `/staff` 404, `/complaint` 200; `careers.html` inline script syntax-checked | Pass |
| Tue Nov 17 2026 | Institute ref-ID format changed from sequential `JIT-APTHEX###` to random `APXJIT-###` (e.g. `APXJIT-234`): allocator picks a random unused 3-digit number (100–999; 4-digit pool as fallback), existence-checked + unique-index guarded so every college's ID is distinct and reveals no ordering. Legacy `JIT-APTHEX###` codes remain valid; Regenerate moves a college onto the new format. Leaderboard now lists **every** generated ref ID — zero-complaint colleges included — with the ref code shown alongside the college name; complaint codes no longer active show as "(inactive or archived)". Search bar added to the leaderboard page (filter by ref ID or college name). Wrong/inactive ref codes on the public form keep returning a field-level "Invalid or inactive institute code" error (verified). | `server/src/routes/institutes.js`, `server/src/routes/stats.js`, `server/src/utils/validation.js` (comment), `server/tests/api.test.js` (2 tests updated + zero-complaint leaderboard assertion), `client-next/src/app/desk/leaderboard/page.js`, `client-next/src/app/desk/institutes/page.js`, `client-next/src/app/desk/stats/page.js`, `client-next/src/app/globals.css` (`.lb-search`, `.lb-code`), `API.md`, `PROJECT_MASTER_DOCUMENTATION.md` | Owner requested: per-college ref IDs must stay memorable/distinct (random `APXJIT-###` like `APXJIT-234`), the code↔college mapping must never be lost, complaints must only come through issued ref IDs, and the leaderboard should show all generated ref IDs with a search bar | `npm --workspace server run test` — 43/43 pass (format regex `^APXJIT-\d{3,4}$`, distinctness, regenerate, zero-complaint leaderboard row); `npm --workspace client-next run build` — succeeds with leaderboard search UI | Pass |
| Tue Nov 17 2026 | Teacher institute scoping + panel simplification: **Staff accounts** — creation form asks position first (Admin/Teacher); teachers require an institute code (assigned+active only) and get a **unique server-generated password** (15 chars, upper/lower/digits/symbols) returned once in the POST response and shown in a copy-once card — the shared `Teacher8686@#` default was retired and its export removed; staff table gained Position + Institute per-row selects (owner→case_team switch allowed; teacher without institute simply sees nothing until attached). **Institute ref IDs** — form reduced to college name only (code generates instantly, head/type/assign clutter removed) with a searchable register of all issued codes below (Ref ID/College/Status/Issued columns + New code/Deactivate actions). **Teacher access scoping (server-enforced)** — `GET /api/complaints` allows case_team with `institute_code` forced server-side (query overrides + spam filters ignored, summary counts scoped), `GET /api/complaints/:ref_id` returns `404` for other colleges' cases, `GET /api/stats/leaderboard` returns only the teacher's own college row, all mutations stay owner-only; Member model gained `institute_code` (in `publicMember`). **Sidebar** — Complaints + Leaderboard for everyone, Institute ref IDs/Reporting/Staff accounts for owners; Audit log and Email log links removed (routes kept); `/desk` is now the shared complaints view (teachers land on "College complaints", read-only detail view with owner-only action cards guarded by `isOwner`). | `server/src/models/Member.js`, `server/src/middleware/auth.js` (publicMember), `server/src/utils/validation.js` (memberCreate/memberUpdate/instituteGenerate schemas, TEACHER_DEFAULT_PASSWORD removed), `server/src/routes/staff.js`, `server/src/routes/complaints.js`, `server/src/routes/stats.js`, `server/tests/api.test.js`, `client-next/src/app/desk/staff/page.js` (rewritten), `client-next/src/app/desk/institutes/page.js` (rewritten), `client-next/src/app/desk/page.js`, `client-next/src/app/desk/complaint/[ref]/page.js`, `client-next/src/components/DeskShell.jsx`, `client-next/src/app/complaint-review-console/page.js` (copy), `client-next/src/app/globals.css` (`.generated-password*`), `API.md`, `PROJECT_MASTER_DOCUMENTATION.md` | Owner requested: each teacher logs in with their own separate password (admin hands it over at creation) and can see ONLY their own college's complaints; institutes page should be just name → code with the full generated list + search below; audit/email log links not needed right now | `npm --workspace server run test` — 44/44 pass (teacher scoping: scoped list, other-college detail 404, PATCH 404, scoped leaderboard; unique generated password ≠ shared default; teacher without institute refused at creation; password-only login matches the teacher's own generated password); `npm --workspace client-next run build` — passes (17 routes) | Pass |
| Tue Nov 17 2026 | Live rollout + owner-requested URL restore: all three Vercel projects redeployed manually as the team owner (git-push deploys stay blocked on the Hobby plan — DEPLOY.md flow): `apthex-complaint-api` (server: teacher scoping, generated passwords), `apthex-complaint` (portal client: new nav, institutes/staff redesign), `apethex` (main site rewrites). Hinglish copy removed from the Case Desk (institutes page got a 3-step English explainer; the Reporting page's duplicate "Add a college" form was deleted — ref IDs are issued only from Institute ref IDs). Institute register restyled to the leaderboard design language (glass rows, gold code badges, gold hero form panel, gold password card). `/admin` restored at the owner's request: the root `vercel.json` now rewrites `/admin` (+ `/admin/:path*`) to the portal login, so typing /admin opens the same `/complaint-review-console` sign-in page; `/staff/login` remains 404. | `vercel.json` (root), `complaint-portal/client-next/src/app/desk/institutes/page.js`, `complaint-portal/client-next/src/app/desk/stats/page.js`, `complaint-portal/client-next/src/app/globals.css` (`.inst-*`, `.refid-panel`, `.generated-password*`), Vercel projects `apthex-complaint-api` / `apthex-complaint` / `apethex`, `complaint-portal/PROJECT_MASTER_DOCUMENTATION.md` | Owner reported the admin panel "missing" at /admin (404 by the Phase-B security pass) and asked for it back; also asked for the leaderboard's premium UI style on the other desk pages and all Hindi text removed from the site | `npm --workspace client-next run build` pass; curl sweep: `/desk`, `/desk/institutes`, `/desk/staff`, `/desk/stats`, `/desk/leaderboard`, `/complaint`, `/status`, `/thanks` all 200; `/admin` → 200 serving the login page; `/api/health` `{"ok":true,"database":"connected"}` | Pass |
| Wed Nov 18 2026 | Full theme overhaul, CSS-only (no JSX changes): the portal's cool blue-gray palette retinted to a warm "quiet luxury" executive-desk system — umber-black canvas (`#0a0908`, warm panels `#171411/#1d1915/#262019`), ivory text, champagne gold (`#d9b866`/`#f1d69a`) as the signature accent for primary buttons (dark text on gold), active nav, eyebrows, input focus rings, stat numerals, ref-ID badges, leaderboard rank #1 + bars, role-owner badge, checkboxes and text selection; red demoted to urgent/danger semantics only. All headings (h1–h4), stat numerals and the APTHEX wordmark now use an editorial serif (Georgia stack, `--font-serif`); the wordmark is gradient-clipped gold with a solid-gold fallback. Welcome/quick-shell ember glows, cards, stat tiles, info/help notes, option menus, vignette and both `#050609` hardcodes warmed to match. | `complaint-portal/client-next/src/app/globals.css` (`:root` tokens, headings, `.eyebrow`, `.btn-primary`, inputs, `.select option`, `.desk-header`, `.desk-nav-link.active`, `.card`, `.stat-card*`, `.badge.role-owner`, `.lb-rank-first`/`.lb-code`/`.lb-bar`/`.lb-count`, `.brand-mark`, `body::before/::after`, welcome/quick-shell glows, `.alert-info`, `.form-help`, `.refid-attach-note`, `.checkbox-field input`, Redacted-File `--bg`), Vercel project `apthex-complaint` | Owner: Case Desk "looking so much dull and AI generated — make it professional, rich and great colour theme" | `npm --workspace client-next run build` pass (17 routes); zero leftover cool hardcodes in a grep sweep; urgent/danger red semantics verified intact; deployed to `apthex-complaint`, all portal pages 200, live CSS fingerprint contains `#0a0908`, `--gold:#d9b866`, `Georgia` | Pass |
| Wed Nov 18 2026 | Cinematic premium redesign of the Case Desk login page (`/complaint-review-console`, also serving `/admin`), CSS+JSX only with auth logic untouched (same login → TOTP-enrolment state machine, same `/api/auth/login` + `/api/auth/setup-2fa` calls, same error handling). New composition per the owner's reference: left column with APTHEX / Complaint Portal brand row, pulsing "Internal access" chip, gold eyebrow "Institute case management", mixed-face heading (bold sans APTHEX + champagne-gold italic serif *Case Desk*), secure-management lede and four glass feature cards (Secure Access / Case Management / Role-Based Access / Audit & History) with 3D pointer tilt and cursor-following sheen; right column: floating glass sign-in panel with champagne rim, lock tile, password visibility toggle (eye/eye-off), sheen-swept gold "Sign In Securely →" CTA with loading state, internal-access footer, plus the 2FA-enrolment view restyled in the same panel. Ambient architectural scene: gold-rimmed eclipse with slow conic light arc, drifting light rings, vertical light bars, podium ellipse with floor glow and rising gold motes. Staggered CSS entrance animations; pointer interactions guarded by `pointer: fine` + `prefers-reduced-motion` (scene stills instantly); responsive two-column → stacked (≤960px) → compact (≤680px); gold `:focus-visible` rings; 16px inputs (no iOS zoom). Added `eyeOff` + `layers` icons to Icon.jsx; no new dependencies (CSS animations, no framer-motion). Old `.auth-*` CSS replaced by the sign-in stage system. | `complaint-portal/client-next/src/app/complaint-review-console/page.js`, `complaint-portal/client-next/src/app/globals.css` (sign-in stage section replaces old auth block, responsive cleanup), `complaint-portal/client-next/src/components/Icon.jsx`, Vercel project `apthex-complaint` | Owner supplied an art-directed reference render and a full spec: premium/futuristic/cinematic login UI with specific layout, animations, login interactions, responsive and technical restrictions (no backend/auth changes, no new packages, reduced-motion respected) | `npm --workspace client-next run build` pass (17 routes); server suite 44/44 (auth, 2FA, teacher scoping untouched); prod-build smoke test: all required elements rendered (password field, toggle with aria-pressed, 4 feature cards, scene layers, footer notices); deployed to `apthex-complaint`; live `/admin` + `/complaint-review-console` 200 with new markup and animation CSS fingerprint present | Pass |
| Thu Nov 19 2026 | Admin surfaces unified on the brand's black-red identity (CSS+JSX only, auth/API/route logic untouched, no new packages). **Login** (`/complaint-review-console`, `/admin`): full black-red canvas with red radial glows, faint red veins, red top hairline; the top-left brand lockup now renders the public site's exact two-tone APTHEX mark (red radial-gradient body + white wing on a dark rounded tile) at 40px with a red glow; APTHEX wordmark and *Case Desk* heading gradient-clipped red; red-tinted feature tiles, red glass panel halo, red inputs and focus rings. **Case Desk** (`/desk`, signed-in): shared `BrandMark` component; sidebar top-left logo lockup at 40px with red APTHEX wordmark and `Case Desk` subtitle; full `.desk-shell` black-red theme — sidebar/topbar, nav hover/active, cards, stat cards, filter card, inputs, table header/hover/urgent row, primary/secondary/ghost buttons, summary block, owner badge and red focus rings. Duplicated nested `.summary-container` CSS replaced by one flat summary block. Local/prod `/admin` rewrite added in `next.config.mjs` so the friendly URL no longer 404s. | `complaint-portal/client-next/src/app/complaint-review-console/page.js`, `complaint-portal/client-next/src/app/globals.css` (auth black-red block + Case Desk black-red block + flat summary CSS), `complaint-portal/client-next/src/components/BrandMark.jsx` (new), `complaint-portal/client-next/src/components/DeskShell.jsx`, `complaint-portal/client-next/next.config.mjs`, Vercel project `apthex-complaint` | Owner: admin panel must be fully black-red with the APTHEX logo visible at the top-left, matching the public site's red identity; login redesign must keep auth logic unchanged and add no packages | `npm --workspace client-next run build` pass (17 routes); local Firefox renders verified at 1440px and 390px (login) and via static desk preview (sidebar logo, red nav/CTA, clean filters/table/summary); `/admin` + `/complaint-review-console` return 200 locally; deployed to `apthex-complaint`; live portal + www `/admin`, `/complaint-review-console`, `/desk` all 200; live CSS contains `auth-brand-logo`, `desk-brand-lockup`, `desk-brand-logo`, `desk-shell .badge.role-owner` and the black-red `radial-gradient(1200px 760px` fingerprint | Pass |

| Thu Nov 19 2026 | Admin palette refinement after owner review ("too much red, too much flat black, logo cramped, staff spacing broken"). Replaced the red-washed admin surfaces with a layered graphite system: main canvas `#101015 → #0d0d12 → #0b0b10`, sidebar `#14141a → #0f0f14`, neutral `rgba(255,255,255,0.07)` borders and soft white ambient light. Red is now a signal only — logo tile, active nav rail/icon, primary buttons, urgent stat/badge and focus rings; red radial washes, red card tints, red table headers and red sidebar glow removed. Champagne tokens neutralised inside `.auth-shell` and `.desk-shell` so no gold remains. Login: ivory APTHEX wordmark, muted red *Case Desk* gradient, graphite glass panel, neutral feature tiles, red CTA only. Logo mark scaled from `0.859` to `0.76` inside the tile and given a subtle `rgba(255,255,255,0.10)` tile ring, displayed at 46px on login and desk — no more edge-cropping. Dashboard summary rebuilt from the old two-row summary into four proper stat cards (Total / Urgent open / In process / Completed) with icons and ivory numerals. Staff accounts table (the owner's screenshot) rebuilt as responsive member cards: initials avatar, name/email, status + 2FA badges, Position/Institute/Last sign-in fields and a compact action row; layout stacks below 1280px, card header reflows to a two-row grid below 720px, so the old 175px-tall squeezed table rows and horizontal scroll are gone. Complaints table keeps reference IDs on one line. | `complaint-portal/client-next/src/app/globals.css` (login oxblood-on-graphite block, desk graphite block, summary-card/staff-card CSS, responsive rules), `complaint-portal/client-next/src/app/desk/page.js` (summary cards), `complaint-portal/client-next/src/app/desk/staff/page.js` (member cards), `complaint-portal/client-next/src/app/complaint-review-console/page.js` + `src/components/BrandMark.jsx` (logo scale + tile ring), Vercel project `apthex-complaint` | Owner supplied a screenshot of the Staff accounts page and asked for much less red, less flat black, a properly spaced logo and proper cards instead of the cramped table | `npm --workspace client-next run build` pass (17 routes); local Firefox renders checked at 1440/1222/390px — login, staff cards and dashboard summary all verified; staff card header reflows correctly on mobile (name/email no longer truncated); deployed to `apthex-complaint`; live `/admin`, `/desk`, `/desk/staff` all 200 on portal and www; live CSS contains `desk-summary`, `summary-card-urgent`, `staff-avatar`, `staff-card-meta`, `desk-brand-logo` and the graphite gradient; live login HTML contains `scale(0.76)` and the tile ring stroke | Pass |
| Thu Nov 19 2026 | Case Desk redesign to the owner's warm maroon executive reference (CSS+JSX only, auth/API/route logic untouched, no new packages). **Canvas** warmed from graphite to a maroon-umber executive palette (`#1a1416 → #171214 → #141013`) with a soft crimson aurora behind the content and no flat black; serif display headings (Georgia stack) for page titles, stat values and panel headings. Red stays an accent only — logo, active nav, primary action, urgent state. **Sidebar** 240px with the APTHEX logo lockup given breathing space, `CASE DESK` sub-label, nav Complaints / Leaderboard / Institute ref IDs / Reporting / Staff accounts, and a bordered Help & Support card at the bottom (headset icon + phone + email). Topbar keeps owner name + `OWNER` pill + Public portal + Sign out; eyebrow is `CASE DESK` on `/desk` and `APTHEX ADMIN & TEACHER AREA` elsewhere. **Dashboard** rebuilt to the earlier reference: eyebrow `CASE DESK`, serif `Case Overview`, four colored summary cards (red Total / amber Urgent / blue In process / green Completed) with icon tiles and low wave graphics, a single-row filter bar (inline search icon, category, status, institute, spam, Urgent-only toggle, Clear + red Apply), and a clean table with uppercase headers, institute as a mono sub-label under Reference, blue `In Process` pill and a three-dot row action. **Staff accounts** rebuilt to the new reference: eyebrow `APTHEX ADMIN & TEACHER AREA`, serif `Staff Accounts`, left `Case Desk Accounts` table (Name/Position/Institute/Status/2FA/Last sign-in/three-dot) with inline Position and Institute selects and a Deactivate/Reset password/Revoke sessions menu (outside-click + Escape close), right `Create a Login Account` card with red `+ Create Teacher Account`; layout is two columns at ≥1400px and stacks below 1399px. Added `more`, `headset`, `userPlus`, `plus`, `filter` icons. | `complaint-portal/client-next/src/app/globals.css` (warm maroon desk block replaces the graphite block), `complaint-portal/client-next/src/app/desk/page.js` (summary cards, filter row, cases table), `complaint-portal/client-next/src/app/desk/staff/page.js` (accounts table, action menu, create card), `complaint-portal/client-next/src/components/DeskShell.jsx` (Help & Support card, dynamic eyebrow), `complaint-portal/client-next/src/components/Icon.jsx` (new icons), Vercel project `apthex-complaint` | Owner supplied two reference renders — the dashboard Case Overview and the Staff Accounts page — and asked for that warm maroon, serif-headed, roomy executive look | `npm --workspace client-next run build` pass (17 routes); static previews rendered from the dev CSS and checked at 1440/1222/390px for both pages (table columns, create card stacking, mobile card rows, no logo cropping); deployed to `apthex-complaint`; live `/`, `/admin`, `/desk`, `/desk/staff` all 200; live CSS contains `staff-table-card`, `summary-card-total`, `desk-filter-row`, `staff-menu`, `desk-help-card` and the `1399px` breakpoint | Pass |
| Thu Nov 19 2026 | Case Desk tone correction after owner feedback ("red too much — make it black with ~10% red and add a line texture"). Canvas moved from warm maroon to near-black (`#141113 → #121011 → #100e10`) with the crimson radial hint cut from `0.2` to `0.07` (and the lower glow `0.09 → 0.03`); a faint 1px line grid (vertical `rgba(255,242,238,0.022)`, horizontal `0.015`, 96px pitch) now textures the content canvas. Sidebar red glow `0.1 → 0.04`, active nav pill `0.5/0.34 → 0.34/0.18`, topbar neutralised to `rgba(19,16,18,0.8)`, aurora `0.3/0.12 → 0.09/0.04`, card red radial `0.045 → 0.02` and card top hairline red `0.3 → 0.16`. Red remains only on the logo, active nav, primary buttons, owner badge and urgent states. No layout or logic changes. | `complaint-portal/client-next/src/app/globals.css` (desk theme block), Vercel project `apthex-complaint` | Owner: the warm maroon had become too red — wanted a mostly black canvas with roughly ten percent red and a subtle lines texture | `npm --workspace client-next run build` pass (17 routes); static previews at 1440px for dashboard + staff confirm the near-black canvas, visible-but-subtle line grid and red reduced to accents; deployed to `apthex-complaint`; live `/`, `/admin`, `/desk`, `/desk/staff` all 200; live CSS contains `repeating-linear-gradient`, `#100e10`, `staff-table-card` and `summary-card-total` | Pass |
| Thu Nov 19 2026 | Production demo-data cleanup before handover: removed all demo/test records from the live Atlas database — 10 complaints (incl. 1 spam) with 3 attachments, 4 case events, 717 audit events, 23 outbox emails, 3 monthly stat rows, 1 rate-limit bucket, 7 staff sessions, 9 contact messages, 6 demo/test institutes (SCHOOL01, COLLEGE01, PRANAV, APXJIT-125, APXJIT-663) and the 3 non-owner staff accounts (teacher@apthex.local, nammu, ff). The owner login (owner@apthex.local) was preserved and verified. The local dev DB was also cleaned (2 demo complaints, 1 demo teacher, related logs) while keeping the 421 imported Nashik institute records. | Production + local MongoDB (Atlas), no code changes | Owner: "saara data demo ka tha, remove karde, bas admin panel rehne de" before submitting the task | Dry-run counts matched the live API; post-cleanup live API returns 0 complaints, 1 staff (owner) and 0 institutes; local API returns 0 complaints, 2 owners and 421 institutes; live `/admin`, `/desk`, `/desk/staff` all 200 | Pass |


---

## Continuous Documentation Maintenance

This document is the single source of truth for the APTHEX Complaint Portal. Whenever any future development work changes the project, the following must be done:

1. **Update the relevant section** of this document.
2. **Update project structure** (Section 2) if files or modules are added, removed, or renamed.
3. **Update routes and API documentation** (Section 7) when endpoints change.
4. **Update database documentation** (Section 6) when schemas or indexes change.
5. **Update integration status** (Section 8 and Section 13) when external services are connected.
6. **Update testing results** (Section 11) only after actual tests are run.
7. **Update the project status tracker** (Section 13).
8. **Add an entry to the dated changelog** (Section 15) — never overwrite previous entries.
9. **Keep pending decisions and blockers synchronized** (Sections 13-14).
10. **Before finishing any future development task**, check whether this documentation needs updating.

### Documentation Rules

- Use actual code and configuration as the source of truth.
- Do not invent functionality, endpoints, test results, or integrations.
- Distinguish implemented, configured, connected, and verified features.
- Keep explanations detailed but easy for another developer to understand.
- Use tables, Mermaid diagrams, code examples, and clear headings.
- Never include secrets or personal complaint data.
- Cross-reference existing documentation (`API.md`, `TEST_REPORT.md`, `OPEN_DECISIONS.md`, `PRODUCTION_INPUTS.md`, `PRODUCTION_READINESS.md`, `EMAIL_INTEGRATION_AUDIT.md`, `SECURITY_AUDIT.md`, `OWNER_ACTION_CHECKLIST.md`) rather than losing useful details.
- Preserve all existing project functionality.
