# APTHEX Complaint Portal

Public, privacy-first complaint reporting for schools and colleges, with a separate staff-only Case Desk.

This project lives in the **public website repository** under `complaint-portal/`. It is intentionally independent of the APTHEX marketing site (`nextjs-site/`) and of the internal management dashboard. The marketing site is not imported, modified, or required at runtime.

## Stack

| Layer | Implementation |
| --- | --- |
| Public + staff frontend | Next.js 16 App Router, React 19, self-contained CSS design system |
| API | Node.js + Express 5 |
| Database | MongoDB / Mongoose (Atlas in the owner environment, separate database from the management app) |
| Evidence storage | Private local filesystem in development, private Vercel Blob store (`apthex-complaint-evidence`) in production |
| Email | Resend, with a database outbox and development console fallback |
| CAPTCHA | Cloudflare Turnstile, with an explicitly development-only bypass |
| Staff authentication | Password + TOTP 2FA, server-side revocable sessions, CSRF protection |

## What is implemented

### Public portal

- Institution-code validation before a report can start.
- Complaint categories, urgent safety workflow, plain-text descriptions.
- Identified or anonymous reporting. Anonymous mode stores no name, roll number, phone, email, or contact record, and rejects submissions containing identity fields.
- Optional image evidence (processed and re-encoded) and a voice note.
- CAPTCHA verification, per-IP/per-device rate limits, and duplicate-submission suppression.
- Human-readable reference ID (`APX-YYMM-XXXXXX`).
- Public status lookup that returns only `In Process` or `Completed`.
- Public follow-up messages attached to the case timeline.
- English, Hindi, and Marathi interface copy.

### Case Desk (staff only)

- TOTP enrolment on first sign-in; TOTP required on subsequent sign-ins.
- Short-lived, revocable sessions with HttpOnly session cookie and CSRF token.
- Role separation: `owner` and `case_team`.
- Case list, search, filters, summary counts, detail view, private evidence access.
- Notes, assignment, spam flag, complete/reopen, and a full case timeline.
- Auditor view, staff management, email outbox, institute statistics, and monthly PDF reports.
- Every sign-in, case view, evidence access, and privileged action is written to the audit log.

### Security and privacy controls

- Anonymous reports contain no identity fields or contact document.
- Evidence is never public: access is via short-lived signed links and is audit logged.
- Complaint text is rendered as plain text, never as HTML.
- CAPTCHA, rate limits, duplicate checks, origin checks, and CSRF protection.
- Helmet security headers on the API; CSP, HSTS, frame denial, no-referrer, and `noindex` on staff routes in the frontend.
- Production startup refuses unsafe development settings (`CAPTCHA_DEV_BYPASS`, `AUTO_SEED`, local storage, weak secrets, missing HTTPS URL, missing providers).
- Retention deletion removes case data and leaves only a minimal deletion record.

## Project layout

```
complaint-portal/
├── client-next/          # Canonical Next.js app (public portal + Case Desk)
├── server/               # Express API, models, jobs, tests, seed scripts
│   ├── scripts/smoke.js  # Deployment smoke test
│   ├── src/              # Application code
│   └── tests/api.test.js # 31 integration tests
├── client/               # Legacy Vite client, not a workspace and not used
├── .env.example          # Documented environment contract
├── API.md                # Endpoint reference
├── TEST_REPORT.md        # Actual test results and residual issues
└── OPEN_DECISIONS.md     # Items requiring owner approval
```

## Prerequisites

- Node.js 20+ (tested with Node 24)
- npm 10+
- A MongoDB deployment (MongoDB Atlas is supported)
- For production only: a private Vercel Blob store and its `BLOB_READ_WRITE_TOKEN`, Resend API key, Cloudflare Turnstile keys, and HTTPS

## Local setup

```bash
cd complaint-portal
npm install
cp .env.example server/.env
```

Edit `server/.env`:

- `MONGODB_URI` — your Atlas/local connection string. Never commit this file.
- `DATABASE_NAME` — use a dedicated database, for example `Apethexhelpportal`. Do not reuse the management dashboard database.
- `SESSION_SECRET` and `TOTP_ENCRYPTION_KEY` — generate each with `openssl rand -base64 48`.
- Leave `CAPTCHA_DEV_BYPASS=true`, `EMAIL_DEV_LOG=true`, and `STORAGE_DRIVER=local` only for local development.

Start both services:

```bash
npm run dev
```

- Frontend: <http://localhost:3000>
- API: <http://localhost:4000>

If port 3000 is already used by the marketing site, run the portal frontend on another port:

```bash
API_PROXY_TARGET=http://localhost:4000 npm --workspace client-next run dev -- -p 3001
```

Then set `APP_BASE_URL=http://localhost:3001` and `CASE_DESK_URL=http://localhost:3001/desk` in `server/.env`.

### Seed data

With `AUTO_SEED=true` the server creates demo institutes and an owner on startup. To run it explicitly:

```bash
npm run seed
```

Development defaults (change before any shared deployment):

- Institutes: `SCHOOL01`, `COLLEGE01`
- Owner: `owner@apthex.local` / `ChangeMe!123`
- The owner enrols TOTP on first sign-in.

Never use these defaults in production.

### Public routes

`/` → `/category` → `/details` → `/thanks`, plus `/status`.

### Staff routes

`/staff/login` → `/desk`, `/desk/complaint/[ref]`, `/desk/stats`, `/desk/staff`, `/desk/audit`, `/desk/email`.

## Tests

```bash
# Backend integration suite (in-memory MongoDB, 31 tests)
npm test

# Smoke test against a running API
SMOKE_BASE_URL=http://localhost:4000 npm run test:smoke

# Production build
npm run build
```

The integration suite covers anonymous identity separation, validation, duplicates, rate limits, evidence processing, signed URLs, status privacy, follow-ups, TOTP/2FA, CSRF, origin checks, RBAC, audit logging, stats, PDF reports, email outbox, retention deletion, and staff management. See `TEST_REPORT.md`.

## Production deployment

Selected target: AWS Lightsail Mumbai, Vercel Blob `apthex-complaint-evidence` (Private), Resend sending from `mail.apthex.com`, and Cloudflare Turnstile. See `PRODUCTION_INPUTS.md` for the exact credentials and owner decisions still required.

1. **Provision MongoDB Atlas** with a dedicated database and least-privilege user. Restrict network access to the deployment egress.
2. **Provision private object storage** (selected: Vercel Blob `apthex-complaint-evidence` with Private access) and set `BLOB_READ_WRITE_TOKEN` plus `STORAGE_DRIVER=vercel-blob`.
3. **Configure Resend** with a verified sender domain; set `RESEND_API_KEY`, `EMAIL_FROM`, `APTHEX_CASE_MAILBOX`, and `URGENT_ALERT_RECIPIENTS`.
4. **Configure Turnstile**; set the site/secret keys and `CAPTCHA_DEV_BYPASS=false`.
5. **Set secrets** (`SESSION_SECRET`, `TOTP_ENCRYPTION_KEY`) to random 32+ character values, and set `APP_BASE_URL`/`CASE_DESK_URL` to the HTTPS portal URL.
6. **Disable development conveniences**: `AUTO_SEED=false`, `EMAIL_DEV_LOG=false`, `STORAGE_DRIVER=vercel-blob`, `REQUIRE_ORIGIN=true`.
7. **Set owner-approved policy values** for `RETENTION_DAYS`, `ESCALATION_DAYS`, and `SMALL_NUMBER_THRESHOLD` (see `OPEN_DECISIONS.md`).
8. **Build and run**:

   ```bash
   npm ci
   npm run build
   npm run start:server     # API, port 4000 by default
   npm run start:client     # Next.js, port 3000 by default
   ```

   Put both behind a TLS reverse proxy. Forward `/api/*` to the API and everything else to Next.js, or use the built-in Next.js rewrite (`API_PROXY_TARGET`).
9. **Set `TRUST_PROXY`** to the number of trusted reverse-proxy hops. If the API is exposed directly, set `TRUST_PROXY=0` so client IP headers cannot be spoofed.
10. **Seed the first owner** with `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` through a controlled one-time run, then remove those values.
11. **Verify** with `SMOKE_BASE_URL=https://portal.example.org npm run test:smoke` and a manual 2FA sign-in.

The API refuses to start in production if required secrets/providers are missing or if development-only settings remain enabled.

## Environment and data safety

- Never commit `server/.env`; it is gitignored.
- Use a different `DATABASE_NAME` from the management dashboard.
- Do not print or expose Atlas credentials, session secrets, TOTP keys, or provider keys.
- The public status endpoint deliberately returns only status and no complaint content.
- Evidence files are private; do not configure a public bucket or CDN path.

## Documentation

- `API.md` — endpoint contracts and examples.
- `TEST_REPORT.md` — executed tests, actual results, and unresolved issues.
- `OPEN_DECISIONS.md` — provider choices and owner approvals required before production.
- `PRODUCTION_INPUTS.md` — exact credentials, DNS access, and approvals still needed.
- `.env.example` — full environment variable reference.
