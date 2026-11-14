# APTHEX Technologies — System Structure

**File:** `APTHEX_SYSTEM_STRUCTURE.md`  
**Status:** Complete hierarchical structure of all APTHEX projects  
**Last updated:** Sat Nov 07 2026  
**Source of truth:** Actual file system inspection — every file listed exists  

---

## 1. Repository Root

```
/run/media/shubhamjadhav/New Volume1/DEV/Ape/Public site/
├── .git/                          Git repository metadata
├── .vscode/                       VS Code workspace settings
├── complaint-portal/              Complaint Portal (frontend + backend)
├── dist/                          Distribution build output (empty)
├── design/                        Design assets (hero-bg.mp4, contact.png, team.png, etc.)
├── index.html                     Static single-page marketing site (source of truth)
├── nextjs-site/                   Next.js 16.4.5 marketing website (inlines index.html)
├── partners/                      Partner/client logos
└── team/                          Team member photos (pranav.jpg, devendra.jpg, yukta.jpg)
```

---

## 2. Project: Public Website (`nextjs-site/`)

```
nextjs-site/
├── .gitignore                     Git ignore rules
├── AGENTS.md                      Next.js 16 breaking changes warning
├── jsconfig.json                  TypeScript/JavaScript project config
├── next.config.mjs                Next.js configuration
│   ├── API rewrites: /api/* → Express backend (port 4000)
│   ├── CSP headers with Turnstile allowance
│   ├── Security headers (HSTS, X-Frame-Options, etc.)
│   └── noindex on /help/desk/* and /help/staff/*
├── package.json                   Next.js 16.4.5, React 19.3.0, React DOM 19.3.0
├── package-lock.json
├── README.md                      Project readme
├── public/                        Static assets
│   ├── design/                    hero-bg.mp4, contact.png, Red Veins image
│   ├── favicon.svg
│   └── partners/                  Partner logos (7 partner images)
├── app/                           Next.js App Router
│   ├── layout.js                  Root layout (metadata, fonts, html/body)
│   ├── globals.css                Global CSS styles
│   ├── page.js                    Homepage — inlines content.js (BODY_HTML + SCRIPT_JS)
│   ├── page.module.css            Homepage-specific CSS modules
│   └── content.js                 BODY_HTML (6-section static site) + SCRIPT_JS (interactivity)
│       ├── Sections: Home, Threats, Services, Partners, Team, Work/Contact
│       ├── Assessment form modal (POST to FormSubmit)
│       ├── Threat data (Global/India, live counter)
│       └── Partner logos + testimonials carousel
└── help/                          Complaint Portal integration (mounted at /help)
    ├── layout.js                  Server metadata + client language shell
    ├── layout-shell.jsx           Client-side PublicShell wrapper with language state
    ├── globals.css                Complaint Portal design system CSS
    ├── page.js                    /help — Welcome page (institute validation)
    ├── category/page.js           /help/category — Category selection
    ├── details/page.js            /help/details — Complaint details + evidence
    ├── thanks/page.js             /help/thanks — Submission confirmation
    ├── status/page.js             /help/status — Public status lookup + follow-up
    ├── staff/login/page.js        /help/staff/login — Staff sign-in with TOTP
    └── desk/                      Staff Case Desk routes
        ├── page.js                /help/desk — Dashboard (case list, filters, stats)
        ├── complaint/[ref]/page.js /help/desk/complaint/[ref] — Individual case detail
        ├── stats/page.js          /help/desk/stats — Institute statistics + reports
        ├── staff/page.js          /help/desk/staff — Staff management (owner)
        ├── audit/page.js          /help/desk/audit — Security audit log (owner)
        └── email/page.js          /help/desk/email — Email outbox log (owner)
├── components/                    Copied portal components (with /help-based links)
│   ├── PublicShell.jsx            Header, nav, language switcher, footer (public pages)
│   ├── DeskShell.jsx              Header, nav, logout (Case Desk pages)
│   ├── Protected.jsx              Session verification wrapper for Case Desk routes
│   ├── Turnstile.jsx              Cloudflare Turnstile CAPTCHA widget
│   ├── StepIndicator.jsx          Progress indicator (Welcome → Category → Details)
│   ├── Icon.jsx                   SVG icon library (25+ icons)
│   ├── Spinner.jsx                Loading spinner component
│   ├── LanguageSwitcher.jsx       EN/HI/MR language selector
│   └── StatusBadge.jsx            Case status display badge
├── lib/                           Copied portal lib files
│   ├── api.js                     API client with CSRF, credentials, multipart upload
│   ├── session.js                 sessionStorage helpers (institute, category, confirmation)
│   ├── lang.js                    useLang hook, useReadAloud (speech synthesis)
│   ├── format.js                  Date/time, byte, duration, month formatting
└── i18n/                          Internationalization
    └── index.js                   en, hi, mr translations + category metadata
```

**Key architectural fact:** The `nextjs-site/` `app/page.js` inlines the entire static `index.html` via `content.js` exports (`BODY_HTML` and `SCRIPT_JS`). The Next.js app is essentially a renderer for the static HTML site, with the Complaint Portal mounted as a sub-application at `/help`.

---

## 3. Project: Complaint Portal (`complaint-portal/`)

```
complaint-portal/
├── .env.example                   Environment template (gitignored: server/.env)
├── .gitignore                     Git ignore rules
├── API.md                         Endpoint reference documentation
├── OPEN_DECISIONS.md              Owner approvals required before production
├── PRODUCTION_INPUTS.md           Production handover checklist
├── PRODUCTION_READINESS.md        Production readiness audit
├── EMAIL_INTEGRATION_AUDIT.md     Resend email integration audit
├── SECURITY_AUDIT.md              Security audit (10 areas)
├── TEST_REPORT.md                 Test results (30/31 pass) and limitations
├── README.md                      Project documentation
├── package.json                   npm workspaces (server, client-next)
├── package-lock.json
├── client-next/                   Canonical Next.js frontend (port 3000)
│   ├── .eslintrc.cjs              ESLint configuration
├── ├── jsconfig.json              TypeScript/JavaScript config
├── ├── next.config.mjs            Next.js config (API rewrites to :4000)
├── ├── package.json               Next.js 16.4.5, React 19.3.0
├── ├── package-lock.json
├── ├── src/
│   │   ├── app/                   Next.js App Router
│   │   │   ├── layout.js          Root layout (metadata, viewport)
│   │   │   ├── page.js            /help — Welcome page
│   │   │   ├── loading.js         Loading state component
│   │   │   ├── not-found.js       404 page
│   │   │   ├── error.js           Error boundary
│   │   │   ├── globals.css        Complaint Portal design system (CSS custom properties)
│   │   │   ├── category/page.js   /help/category
│   │   │   ├── details/page.js    /help/details (form + evidence + review + submit)
│   │   │   ├── status/page.js     /help/status (lookup + follow-up)
│   │   │   ├── thanks/page.js     /help/thanks (confirmation + reference ID)
│   │   │   ├── staff/login/page.js /help/staff/login (TOTP 2FA)
│   │   │   └── desk/              Staff Case Desk
│   │   │       ├── page.js        /help/desk (dashboard)
│   │   │       ├── complaint/[ref]/page.js /help/desk/complaint/[ref]
│   │   │       ├── stats/page.js  /help/desk/stats
│   │   │       ├── staff/page.js  /help/desk/staff (owner)
│   │   │       ├── audit/page.js  /help/desk/audit (owner)
│   │   │       └── email/page.js  /help/desk/email (owner)
│   │   ├── components/            Shared React components
│   │   │   ├── PublicShell.jsx    Header/nav/footer for public pages
│   │   │   ├── DeskShell.jsx      Header/nav/logout for Case Desk
│   │   │   ├── Protected.jsx      Session verification (redirects to login on 401)
│   │   │   ├── Turnstile.jsx      Cloudflare Turnstile CAPTCHA
│   │   │   ├── StepIndicator.jsx  3-step progress (Welcome → Category → Details)
│   │   │   ├── Icon.jsx           SVG icon library
│   │   │   ├── Spinner.jsx        Loading spinner
│   │   │   ├── LanguageSwitcher.jsx EN/HI/MR selector
│   │   │   └── StatusBadge.jsx    Case status badge
│   │   ├── lib/                   Shared utilities
│   │   │   ├── api.js             API client (fetch with CSRF, credentials, XHR upload)
│   │   │   ├── session.js         sessionStorage helpers (institute, category, confirmation, deviceId)
│   │   │   ├── lang.js            useLang hook, useReadAloud (speech synthesis)
│   │   │   └── format.js          Date/time, bytes, duration, month formatting
│   │   └── i18n/                  Internationalization
│   │       └── index.js           en/hi/mr dictionary, t() function, CATEGORY_META
├── client/                        Legacy Vite client (UNUSED, not a workspace)
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── components/Protected.jsx
│   │   ├── i18n/index.js
│   │   ├── lib/api.js
│   │   ├── lib/lang.js
│   │   └── pages/
│   │       ├── Welcome.jsx
│   │       ├── Category.jsx
│   │       ├── Details.jsx
│   │       ├── ThankYou.jsx
│   │       ├── StatusCheck.jsx
│   │       ├── StaffLogin.jsx
│   │       ├── DeskDashboard.jsx
│   │       ├── DeskComplaint.jsx
│   │       └── DeskStats.jsx
├── server/                        Express 5 + MongoDB backend (port 4000)
│   ├── package.json               Express 5, mongoose 9, @vercel/blob, resend, sharp, etc.
│   ├── package-lock.json
│   ├── .env                       Environment variables (gitignored)
│   ├── src/
│   │   ├── index.js               Server entry (DB connect, seed, scheduler, listen)
│   │   ├── app.js                 Express app (CORS, Helmet, rate limiting, routes)
│   │   ├── config/
│   │   │   └── env.js             Zod schema validation + assertProductionConfig()
│   │   ├── db/
│   │   │   └── connect.js         MongoDB connection (Atlas or in-memory)
│   │   ├── models/                12 Mongoose models
│   │   │   ├── Complaint.js       ref_id, institute_code, category, details_text, mode, status, delete_after
│   │   │   ├── Contact.js         complaint_id, name, roll_no, mobile, email (identified only)
│   │   │   ├── Attachment.js      complaint_id, type, storage_key, mime, size_bytes
│   │   │   ├── CaseEvent.js       complaint_id, event, note, member_id
│   │   │   ├── Member.js          email, password_hash, role, status, totp_enabled
│   │   │   ├── StaffSession.js    token_hash, member_id, csrf_hash, expires_at
│   │   │   ├── AuditEvent.js      action, entity, outcome, ip (hashed), detail
│   │   │   ├── RateLimit.js       key, window_start, count, expires_at
│   │   │   ├── StatsMonthly.js    institute_code, month, received, completed, escalated
│   │   │   ├── DeletionLog.js     ref_id, institute_code, deleted_by, reason
│   │   │   ├── EmailOutbox.js     dedupe_key, to, subject, kind, status, attempts
│   │   │   ├── Institute.js       code, name, type, head_email, status
│   │   │   └── EmailOutbox.js
│   │   ├── routes/                10 API route modules (/api/*)
│   │   │   ├── config.js          GET /api/config (languages, CAPTCHA state)
│   │   │   ├── auth.js            Login, TOTP setup, logout, session management
│   │   │   ├── institutes.js      GET /api/institutes/validate
│   │   │   ├── complaints.js      POST/GET/PATCH /api/complaints
│   │   │   ├── status.js          POST /api/status/lookup, POST /api/status/followup
│   │   │   ├── attachments.js     GET /api/attachments/:id/url, GET /api/attachments/download/:id
│   │   │   ├── staff.js           Staff CRUD, audit log, email outbox (owner)
│   │   │   ├── stats.js           Institute statistics
│   │   │   ├── reports.js         Monthly PDF reports (preview/data/send)
│   │   │   └── attachments.js     (see above)
│   │   ├── services/              Business logic
│   │   │   ├── email.js           Resend integration, queueEmail, processOutbox, templates
│   │   │   ├── storage.js         S3/local storage, saveObject/readObject/deleteObject, signAttachmentUrl
│   │   │   ├── captcha.js         Cloudflare Turnstile verification
│   │   │   ├── stats.js           applyStatsDelta, getInstituteTotals
│   │   │   ├── purge.js           Retention deletion (purgeComplaint, purgeDueComplaints, requestTimeSweep)
│   │   │   ├── report.js          Monthly PDF generation (pdfkit)
│   │   │   └── monthlyReport.js   buildMonthlyReportData, buildMonthlyReportPdf
│   │   ├── middleware/            Express middleware
│   │   │   ├── auth.js            requireAuth, requireCsrf, requireTrustedOrigin, requireRole, session management
│   │   │   └── error.js           Error handler (Zod, Multer, 11000, generic)
│   │   ├── jobs/                  Scheduled jobs (node-cron)
│   │   │   └── scheduler.js       Outbox (every min), deletion (daily 02:00), reports (1st 06:00), escalation (daily 08:00)
│   │   ├── scripts/               Seed scripts
│   │   │   ├── seed.js            Seed entry point
│   │   │   └── seed-data.js       Demo institutes + owner creation
│   │   ├── utils/                 Utility functions
│   │   │   ├── validation.js      Zod schemas (submission, followup, statusLookup, login, staff)
│   │   │   ├── sanitize.js        sanitizeText, normalizeEmail, normalizePhone, escapeHtml, escapeRegex, maskEmail
│   │   │   ├── audit.js           Append-only audit event writer
│   │   │   ├── rateLimit.js       Fixed-window rate limiter (MongoDB-backed)
│   │   │   ├── refId.js           generateRefId, isRefId, REF_ID_PATTERN
│   │   │   ├── hash.js            hashIp, hashDeviceId, sha256, randomToken, timingSafeEqual
│   │   │   ├── totp.js            TOTP secret encryption (AES-256-GCM), verification (speakeasy)
│   │   │   └── dates.js           Date utilities
│   │   └── tests/                 Integration test suite
│   │       └── api.test.js        31 integration tests (30 pass, 1 pre-existing fail)
│   └── storage/                   Local evidence storage directory (development only)
├── client-next/node_modules/      Frontend dependencies
└── server/node_modules/           Backend dependencies
```

---

## 4. Database Schema Structure

### 4.1 Entity Relationship Summary

```
institutes 1 ──< complaints >── 1 contacts (identified only)
complaints 1 ──< attachments
complaints 1 ──< case_events
members 1 ──< staff_sessions
members 1 ──< case_events (staff actions)
members 1 ──< complaints (assigned_to)
```

### 4.2 Collection Details

| Collection | Key Fields | Indexes | Sensitive Data |
|---|---|---|---|
| `institutes` | code, name, type, head_email, status | code (unique), status | No |
| `complaints` | ref_id, institute_code, category, details_text, mode, status, delete_after | ref_id (unique), institute_code, status, flagged_spam, delete_after | Yes (details_text) |
| `contacts` | complaint_id, name, roll_no, mobile, email | complaint_id (unique) | Yes |
| `attachments` | complaint_id, type, storage_key, mime, size_bytes | complaint_id | No (file in storage) |
| `case_events` | complaint_id, event, note, member_id | complaint_id | Yes (notes) |
| `members` | email, password_hash, role, status, totp_enabled | email (unique), role, status | Yes |
| `staff_sessions` | token_hash, member_id, csrf_hash, expires_at | token_hash (unique), member_id, expires_at (TTL) | No (hashes only) |
| `audit_events` | action, entity, outcome, ip (hashed), detail | occurred_at, member_id, entity+entity_id | No |
| `rate_limits` | key, window_start, count, expires_at | key+window_start (unique), expires_at (TTL) | No (hashed keys) |
| `stats_monthly` | institute_code, month, received, completed, escalated | institute_code+month (unique) | No |
| `deletion_log` | ref_id, institute_code, deleted_by, reason | ref_id, deleted_at | No |
| `email_outbox` | dedupe_key, to, subject, kind, status, attempts | dedupe_key (unique), status+next_attempt_at, expires_at (TTL) | Yes (recipient, subject, body) |

---

## 5. API Route Structure

### 5.1 Route Mounting (server/src/app.js)

```
GET     /api/health                           → Health check
GET     /api/config                           → Public config
GET     /api/institutes/validate              → Institute validation
POST    /api/complaints                       → Submit complaint
GET     /api/complaints                       → Case list (staff)
GET     /api/complaints/:ref_id               → Case detail (staff)
PATCH   /api/complaints/:ref_id               → Update case (staff + CSRF)
POST    /api/auth/login                       → Staff sign-in
POST    /api/auth/setup-2fa                   → TOTP enrolment
POST    /api/auth/logout                      → Sign out (staff + CSRF)
GET     /api/auth/me                          → Session info (staff)
GET     /api/auth/sessions                    → List sessions (staff)
POST    /api/auth/sessions/:id/revoke         → Revoke session (staff + CSRF)
POST    /api/auth/sessions/revoke-others      → Revoke others (staff + CSRF)
POST    /api/status/lookup                    → Public status lookup
POST    /api/status/followup                  → Public follow-up
GET     /api/attachments/:id/url              → Signed evidence URL (staff)
GET     /api/attachments/download/:id         → Local download (staff + signature)
GET     /api/staff/assignable                 → Assignable staff (staff)
GET     /api/staff/members                    → Staff list (owner + CSRF)
POST    /api/staff/members                    → Create staff (owner + CSRF)
PATCH   /api/staff/members/:id                → Update staff (owner + CSRF)
POST    /api/staff/members/:id/reset-password → Reset password (owner + CSRF)
POST    /api/staff/members/:id/revoke-sessions → Revoke sessions (owner + CSRF)
GET     /api/staff/audit                      → Audit log (owner + CSRF)
GET     /api/staff/outbox                     → Email outbox (owner + CSRF)
POST    /api/staff/outbox/process             → Process outbox (owner + CSRF)
GET     /api/stats/institutes                 → Institute list (staff)
GET     /api/stats/institute/:code            → Institute stats (staff)
GET     /api/stats/monthly                    → Monthly stats (staff)
GET     /api/stats/overview                   → Overview stats (staff)
GET     /api/reports/preview                  → PDF preview (staff)
GET     /api/reports/data                     → Report data (staff)
POST    /api/reports/send                     → Send report (owner + CSRF)
```

### 5.2 Authentication Requirements by Route Group

| Route Group | Auth Required | Role Required | CSRF Required |
|---|---|---|---|
| `/api/health` | No | — | No |
| `/api/config` | No | — | No |
| `/api/institutes/validate` | No | — | No |
| `/api/complaints` (POST) | No | — | No (CAPTCHA instead) |
| `/api/complaints` (GET/PATCH) | Yes | — | Yes (PATCH) |
| `/api/auth/*` | No (login/setup) | — | Yes (logout/sessions) |
| `/api/status/*` | No | — | No (CAPTCHA for follow-up) |
| `/api/attachments/*` | Yes | — | No |
| `/api/staff/*` | Yes | Owner (for members/audit/outbox/reports/send) | Yes (state-changing) |
| `/api/stats/*` | Yes | — | No |
| `/api/reports/*` | Yes | Owner (for send) | Yes (send) |

---

## 6. Environment Variable Structure

```
server/.env (gitignored)
├── Runtime: NODE_ENV, PORT, TRUST_PROXY, LOG_LEVEL
├── MongoDB: MONGODB_URI, DATABASE_NAME
├── URLs: APP_BASE_URL, CASE_DESK_URL, CORS_ORIGINS, REQUIRE_ORIGIN
├── Sessions: SESSION_SECRET, SESSION_TTL_HOURS, TOTP_ENCRYPTION_KEY
├── Retention: RETENTION_DAYS, ESCALATION_DAYS, SMALL_NUMBER_THRESHOLD
├── Rate limits: RATE_LIMIT_* (11 variables)
├── Email: RESEND_API_KEY, EMAIL_FROM, APTHEX_CASE_MAILBOX, URGENT_ALERT_RECIPIENTS
├── Email limits: EMAIL_DEV_LOG, EMAIL_MAX_ATTEMPTS, EMAIL_OUTBOX_TTL_DAYS
├── CAPTCHA: CLOUDFLARE_TURNSTILE_SITE_KEY, CLOUDFLARE_TURNSTILE_SECRET_KEY, CAPTCHA_DEV_BYPASS
├── Storage: STORAGE_DRIVER, STORAGE_LOCAL_DIR, STORAGE_ENDPOINT, STORAGE_BUCKET
├── Storage keys: STORAGE_REGION, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY
├── Storage signing: STORAGE_PUBLIC_URL, STORAGE_SIGNING_SECRET, STORAGE_SIGNED_URL_TTL_SECONDS
├── Upload limits: MAX_IMAGE_BYTES, MAX_VOICE_BYTES, MAX_VOICE_SECONDS, MAX_IMAGES, MAX_TOTAL_UPLOAD_BYTES
├── Seed: AUTO_SEED, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD
```

---

## 7. File Count Summary

| Project | Source Files | Test Files | Config Files |
|---|---|---|---|
| Public Website (`nextjs-site/`) | ~30 (JS, JSX, CSS, MJS) | 0 | 4 (package.json, next.config.mjs, jsconfig.json, README.md) |
| Complaint Portal Frontend (`client-next/`) | ~35 (JSX, JS, CSS, MJS) | 0 | 5 (package.json, next.config.mjs, jsconfig.json, eslint.config.mjs, README.md) |
| Complaint Portal Backend (`server/`) | ~35 (JS) | 1 (api.test.js, 732 lines, 31 tests) | 6 (package.json, .env.example, etc.) |
| Legacy Vite Client (`client/`) | ~12 (JSX, JS, CSS) | 0 | 4 (package.json, vite.config.js, tailwind.config.js, postcss.config.js) |
| Root | 3 (index.html, favicon.svg, design/assets) | 0 | 1 (.gitignore) |

---

## 8. Change History

| Date | What Changed | Files/Modules Affected | Reason | Tests Performed | Result |
|---|---|---|---|---|---|
| Sat Nov 07 2026 | Initial system structure documentation created | `APTHEX_SYSTEM_STRUCTURE.md` (new) | Complete file/module inventory of entire ecosystem | Full file system traversal (glob + ls) | N/A (documentation only) |

---

## 9. Continuous Maintenance Rules

This document must be updated whenever:

1. New files, modules, or routes are added to any project.
2. Database models change (fields, indexes, collections).
3. API endpoints are added, modified, or removed.
4. Environment variables are added or changed.
5. External service integrations are added or modified.
6. Project structure changes (directories renamed, files moved).

**Rules:**
- Use actual file system inspection as the source of truth.
- Do not invent files or directories that don't exist.
- Keep the structure tree accurate and complete.
- Never include secrets or personal complaint data.
- Add change history entries for all structural changes.
