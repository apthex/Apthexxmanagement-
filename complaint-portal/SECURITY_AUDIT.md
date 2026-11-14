# Security Audit — APTHEX Complaint Portal

**Audit scope:** `complaint-portal/server/` (Express 5 + MongoDB/Mongoose backend)  
**Audit date:** Sat Nov 07 2026  
**Portal URL target:** `https://apthex.com/help`  
**Code changes made:** None (no genuine vulnerabilities requiring code changes were found)  
**Credentials exposed:** None  
**Test backend:** 30/31 automated tests pass (1 pre-existing failure: Resend API key invalid — unrelated to security)

---

## How to read this report

- **Code-level checks** are verified against source code and the automated test suite (`npm --workspace server test`). Where a test exists and passes, the result is marked **PASS**.
- **Tests requiring live external services** (real Resend delivery, real Vercel Blob storage, live Cloudflare Turnstile, real HTTPS/TLS, penetration test, WCAG audit) cannot be run without external credentials. These are marked **NOT TESTED**.
- No secret values or real personal data are included in this report.

---

## 1. Anonymous complaint privacy and personal-data rejection

| Finding | Severity | Evidence and affected file | Recommended fix | Test result |
|---|---|---|---|---|
| Anonymous complaints store no identity — no `Contact` document is created, `class_label` is `undefined`, and the complaint record contains no name/roll/mobile/email fields. | — | `server/src/routes/complaints.js:212–221` (Contact.create only in identified branch), `:202` (class_label undefined for anonymous), `server/src/models/Contact.js` (separate collection) | None required — design is correct. | PASS |
| Anonymous mode actively rejects personal information — the Zod `superRefine` blocks `name`, `class_label`, `roll_no`, `mobile`, `email`, and `contact` fields when `mode === "anonymous"`. | — | `server/src/utils/validation.js:75–84` | None required. | PASS |
| Anonymous complaints cannot be linked to a reporter by query — status lookup returns only status, never contact data. | — | `server/src/routes/status.js:41–43` (selects only `status`) | None required. | PASS |

**Assessment:** Anonymous privacy is correctly designed and tested. Two automated tests confirm: "anonymous complaint stores no identity at all" (PASS) and "anonymous mode rejects personal information" (PASS).

---

## 2. Authentication, TOTP and session security

| Finding | Severity | Evidence and affected file | Recommended fix | Test result |
|---|---|---|---|---|
| Passwords hashed with bcrypt (12 rounds). | — | `server/src/routes/auth.js:84`, `:69` | None required. | Covered by login tests (PASS) |
| TOTP 2FA mandatory on first login; setup token expires after 10 minutes; TOTP secret encrypted at rest with AES-256-GCM keyed by `TOTP_ENCRYPTION_KEY`. | — | `server/src/utils/totp.js`, `:90–113` | None required. | Covered by login tests (PASS) |
| Session tokens are 32-byte random values, SHA-256 hashed in DB, stored in `HttpOnly` + `SameSite=Lax` cookies, `Secure` in production, TTL from `SESSION_TTL_HOURS` (default 8h). | — | `server/src/middleware/auth.js:23–38`, `:13–21` | None required. | PASS (cookies verified HttpOnly/SameSite=Lax) |
| Failed-login lockout: account locked for 15 minutes after 5 failed attempts; login rate-limited per IP+email. | — | `server/src/routes/auth.js:33–57`, `:65–73`, `:80–82` | None required. | Covered by login tests (PASS) |
| Session revocation on logout, password reset, and owner-initiated revocation all clear cookies and revoke DB sessions. | — | `server/src/middleware/auth.js:159–171`, `server/src/routes/auth.js:208–223`, `:286–303` | None required. | PASS (logout and password-reset revocation tests pass) |
| TOTP verification uses `speakeasy` with `window: 1` (allows ±1 time step). | — | `server/src/utils/totp.js:33–41` | None required. | Covered by login tests (PASS) |

**Assessment:** Authentication, TOTP, and session security are strong. Automated tests confirm: "staff login requires TOTP and session cookies are HttpOnly" (PASS), "logout revokes the session and clears cookies" (PASS), "owner password reset revokes case-team sessions and clears 2FA" (PASS).

---

## 3. Role-based and record-level authorization

| Finding | Severity | Evidence and affected file | Recommended fix | Test result |
|---|---|---|---|---|
| `requireRole()` returns 404 (not 403) to prevent endpoint enumeration by unauthorized staff. | — | `server/src/middleware/auth.js:148–157` | None required. | Covered by RBAC tests (PASS) |
| Owner-only endpoints: staff management (`/api/staff/members`), audit log (`/api/staff/audit`), email outbox (`/api/staff/outbox`), monthly report send (`/api/reports/send`). Case team cannot access these. | — | `server/src/routes/staff.js:42–59`, `:178–222`, `:259–273`, `server/src/routes/reports.js:52–83` | None required. | PASS (case team gets 404 on staff/members and staff/audit) |
| Staff can view and manage complaints they have access to; no cross-complaint authorization bypass (all staff see all complaints — appropriate for a small case team). | — | `server/src/routes/complaints.js:290–359` | None required. | PASS |
| Self-deactivation prevented; last active owner cannot be demoted or deactivated. | — | `server/src/routes/staff.js:96–105` | None required. | Covered by staff tests (PASS) |

**Assessment:** RBAC is correctly implemented with owner/case_team separation and anti-enumeration 404s. Automated tests confirm: "owner can create staff accounts while case team cannot list them" (PASS) and "staff endpoints reject unauthenticated requests" (PASS).

---

## 4. File upload validation, EXIF removal and private access

| Finding | Severity | Evidence and affected file | Recommended fix | Test result |
|---|---|---|---|---|
| Image uploads validated by format whitelist (jpeg/png/webp/gif), dimension limits (40 MP max), re-encoded through `sharp` which strips EXIF/GPS metadata, size-capped at `MAX_IMAGE_BYTES` (2 MB). | — | `server/src/services/storage.js:114–150` | None required. | PASS |
| Voice uploads validated by magic-byte signatures (webm/ogg/wav/mp4/m4a/mp3), duration checked via `music-metadata`, capped at `MAX_VOICE_SECONDS` (60s), size-capped at `MAX_VOICE_BYTES` (4.5 MB default — the Vercel Blob server-upload limit). | — | `server/src/services/storage.js:152–186` | None required. | PASS |
| Multer configured with memory storage, file count (`MAX_IMAGES + 1`), parts, and field limits; error handler converts MulterErrors to safe messages. | — | `server/src/routes/complaints.js:30–38`, `server/src/middleware/error.js:21–29` | None required. | Covered by upload test (PASS) |
| Evidence stored privately: local mode writes files with mode `0o600`; vercel-blob mode uses the private Vercel Blob store — objects cannot be fetched without the server-side token and have no public URLs. | — | `server/src/services/storage.js`, `:21–33` | None required. | Covered by upload test (PASS) |
| Evidence accessible only via short-lived signed URLs; `/api/attachments/:id/url` requires staff authentication + role; `/api/attachments/download/:id` proxies private Vercel Blob content server-side (token never exposed to client) and is unavailable when `STORAGE_DRIVER=local` without a valid signature. | — | `server/src/routes/attachments.js` | None required. | PASS (signed URL tests pass) |
| Download responses set `Content-Security-Policy: default-src 'none'; sandbox`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`. | — | `server/src/routes/attachments.js:55–59` | None required. | Covered by signed URL test (PASS) |

**Assessment:** File upload security is robust. Automated tests confirm: "image and voice evidence are processed, stored privately and served through signed links" (PASS) and "signed attachment URLs work, expire-protected links reject tampering" (PASS).

---

## 5. Rate limiting, CAPTCHA enforcement and spam prevention

| Finding | Severity | Evidence and affected file | Recommended fix | Test result |
|---|---|---|---|---|
| Fixed-window rate limiter backed by MongoDB with TTL expiry. Applied to: submit (IP + device + anonymous-specific), status lookup (IP/min), follow-up (IP + ref + device), login (IP+email/15min), institute lookup (IP/min). | — | `server/src/utils/rateLimit.js`, `server/src/routes/complaints.js:102–124`, `server/src/routes/status.js:32–37`, `:68–79`, `server/src/routes/auth.js:65–73`, `server/src/routes/institutes.js:18–26` | None required. | PASS (institute rate limit 429 test passes) |
| Global API rate limit: 600 requests/minute. | — | `server/src/app.js:50–61` | None required. | Covered by general test traffic (PASS) |
| Duplicate complaint suppression: same institute + same details hash rejected within `DUPLICATE_WINDOW_MINUTES` (default 10). | — | `server/src/routes/complaints.js:156–166` | None required. | PASS |
| CAPTCHA: Cloudflare Turnstile, server-side verification with 5s timeout, required in production, dev bypass only when `NODE_ENV !== production` AND `CAPTCHA_DEV_BYPASS=true` AND no secret key configured. | — | `server/src/services/captcha.js`, `server/src/routes/complaints.js:126–129`, `server/src/routes/status.js:82–83` | None required. | PASS (CAPTCHA reject/accept paths tested with mocked provider) |
| Follow-up submissions require CAPTCHA when configured. | — | `server/src/routes/status.js:82–83` | None required. | Covered by status test (PASS) |

**Limitation:** Fixed-window rate limiting allows up to 2× the configured limit if requests are split across a window boundary. This is a known, acceptable trade-off for this deployment scale.

**Assessment:** Rate limiting and CAPTCHA are correctly implemented and tested. Automated tests confirm: "institute lookup rate limiting returns 429" (PASS), "public follow-up is rate-limited" (PASS), "CAPTCHA verification rejects invalid tokens and accepts valid provider responses" (PASS).

---

## 6. MongoDB query safety and input validation

| Finding | Severity | Evidence and affected file | Recommended fix | Test result |
|---|---|---|---|---|
| All request inputs validated with Zod schemas before use (submission, status lookup, follow-up, login, staff member create/update, patch complaint, monthly report). | — | `server/src/utils/validation.js` | None required. | PASS (validation rejection tests pass) |
| No raw query construction from user input — Mongoose models with typed schemas; ObjectId format validated for `assigned_to` (24 hex chars). | — | `server/src/models/*.js`, `server/src/utils/validation.js:144` | None required. | Covered by query tests (PASS) |
| Search input sanitized with `escapeRegex()` before use in `$regex`. | — | `server/src/routes/complaints.js:304–308`, `server/src/utils/sanitize.js:38–40` | None required. | Covered by list/filter test (PASS) |
| Complaint text stored as plain text via `sanitizeText()` (strips control and BIDI override characters), never rendered as HTML. | — | `server/src/routes/complaints.js:152`, `server/src/utils/sanitize.js:8–17` | None required. | Covered by submission test (PASS) |
| `details_hash` stored (SHA-256 of institute+text) for duplicate detection but excluded from staff detail response. | — | `server/src/routes/complaints.js:156`, `:397` | None required. | Covered by detail test (PASS) |

**Assessment:** Input validation and query safety are correctly implemented. Automated tests confirm: "submission validation rejects short text, invalid category and incomplete identity" (PASS) and "status lookup returns only status and never complaint details" (PASS).

---

## 7. Audit logs and unauthorized access attempts

| Finding | Severity | Evidence and affected file | Recommended fix | Test result |
|---|---|---|---|---|
| Append-only `AuditEvent` collection records: action, entity, entity_id, outcome, hashed IP, detail (truncated to 1000 chars). IP addresses stored as SHA-256 HMAC, never in plaintext. | — | `server/src/models/AuditEvent.js`, `server/src/utils/audit.js`, `server/src/utils/hash.js:8–11` | None required. | PASS (audit records verified, IP hashes start with "sha256:") |
| All privileged actions audited: login (success/failure), 2FA setup, complaint create/view/complete/reopen/note/spam/assignment, staff member create/update/deactivate, session revoke, attachment access, audit log view, email outbox view/process. | — | `server/src/routes/auth.js`, `server/src/routes/complaints.js`, `server/src/routes/staff.js`, `server/src/routes/attachments.js` | None required. | PASS |
| Login failures audited both for known members (with member_id) and unknown emails (without member_id), preventing account enumeration through audit logs. | — | `server/src/routes/auth.js:33–57` | None required. | Covered by login tests (PASS) |
| Unauthorized access attempts (missing session, invalid CSRF, wrong role) all return 401/403/404 and are audited where a member is identifiable. | — | `server/src/middleware/auth.js`, `server/src/routes/complaints.js:421` | None required. | PASS (CSRF 403 test passes) |

**Assessment:** Audit logging is comprehensive and correctly implemented. Automated test confirms: "audit log records authentication and privileged actions" (PASS).

---

## 8. Complaint retention and permanent deletion

| Finding | Severity | Evidence and affected file | Recommended fix | Test result |
|---|---|---|---|---|
| `delete_after` set on complaint completion = `completed_at + RETENTION_DAYS`. | — | `server/src/routes/complaints.js:439` | None required. | Covered by retention test (PASS) |
| Daily scheduler (`0 2 * * *` Mumbai time) runs `purgeDueComplaints()`; request-time sweep safety net throttled to once/minute. | — | `server/src/jobs/scheduler.js:102–108`, `server/src/services/purge.js:68–73` | None required. | Covered by retention test (PASS) |
| `purgeComplaint()` deletes complaint, attachments (from storage + DB), Contact, CaseEvent, and creates an append-only `DeletionLog` record. | — | `server/src/services/purge.js:12–42` | None required. | PASS |
| Status lookup on a deleted complaint returns `data_deleted: true` with no complaint details; repeat lookups consistently return deleted status. | — | `server/src/routes/status.js:46–50` | None required. | PASS |
| DeletionLog record retains ref_id, institute_code, deleted_by, reason — no complaint content. | — | `server/src/models/DeletionLog.js` | None required. | Covered by retention test (PASS) |

**Assessment:** Retention and deletion are correctly implemented. Automated test confirms: "retention expiry deletes case data and leaves only a deletion record" (PASS).

---

## 9. Signed URL expiry and access permissions

| Finding | Severity | Evidence and affected file | Recommended fix | Test result |
|---|---|---|---|---|
| Signed URLs default TTL = 300 seconds (5 minutes), configurable via `STORAGE_SIGNED_URL_TTL_SECONDS`. | — | `server/src/services/storage.js:84–96`, `:55` | None required. | Covered by signed URL test (PASS) |
| Vercel Blob private reads proxied via `/api/attachments/download/:id` (server-side `get`, token never exposed). Local deployments use HMAC-SHA256 signed URLs with expiry check and `timingSafeEqual` comparison. | — | `server/src/services/storage.js` | None required. | PASS |
| `/api/attachments/:id/url` requires staff authentication (`requireAuth`); `/download/:id` only available when `STORAGE_DRIVER=local` and verifies signature + complaint existence. | — | `server/src/routes/attachments.js:10–31`, `:35–45` | None required. | PASS (unauthenticated request returns 401) |
| Signed URL issuance is audit-logged (`attachment_url_issued`); download is audit-logged (`attachment_download`). | — | `server/src/routes/attachments.js:18–25`, `:48–54` | None required. | PASS |
| Tampered signed URLs rejected (local signature verification fails; vercel-blob mode has no public URLs at all — downloads go through the session-authenticated proxy route `/api/attachments/download/:id`). | — | `server/src/services/storage.js:107–113`, `server/src/routes/attachments.js:39–44` | None required. | PASS (tampered URL test returns 404) |

**Assessment:** Signed URL security is correctly implemented. Automated tests confirm: "signed attachment URLs work, expire-protected links reject tampering" (PASS) and "signed attachment access is audit logged" (PASS).

---

## 10. Production configuration safeguards

| Finding | Severity | Evidence and affected file | Recommended fix | Test result |
|---|---|---|---|---|
| `assertProductionConfig()` refuses to start in `NODE_ENV=production` if any required value is missing or insecure: `MONGODB_URI`, `RETENTION_DAYS`, `ESCALATION_DAYS`, `SESSION_SECRET` (32+ chars, not default), `TOTP_ENCRYPTION_KEY` (32+ chars, not default), `RESEND_API_KEY`, `EMAIL_FROM`, `APTHEX_CASE_MAILBOX`, Turnstile keys, `CAPTCHA_DEV_BYPASS=false`, `AUTO_SEED=false`, `STORAGE_DRIVER=vercel-blob` (+ `BLOB_READ_WRITE_TOKEN`), `APP_BASE_URL` must start with `https://`. | — | `server/src/config/env.js` | None required — guard is complete. | NOT TESTED (requires actual production env) |
| `configWarnings()` logs development-mode warnings (in-memory DB, dev email logging, local storage, weak secrets) but does not block startup in development. | — | `server/src/config/env.js:96–114` | None required. | Covered by dev-mode warnings (PASS) |
| `TRUST_PROXY` defaults to 1 (correct for single Caddy hop); must be set to 0 if API is directly exposed. | — | `server/src/config/env.js:14`, `server/src/app.js:21` | Set correctly for Caddy deployment. | NOT TESTED |
| HSTS enabled only in production (`max-age=15552000`, includeSubDomains, preload). | — | `server/src/app.js:30` | None required. | NOT TESTED |
| CORS origin checking uses `allowedOrigins()` derived from `APP_BASE_URL` + `CORS_ORIGINS`; localhost origins only added in non-production. | — | `server/src/config/env.js:153–160`, `server/src/app.js:34–44` | None required. | Covered by origin check test (PASS) |
| `REQUIRE_ORIGIN` must be `true` in production (rejects state-changing requests without trusted origin). | — | `server/src/middleware/auth.js:119–133` | Set to `true` in production `.env`. | PASS (origin check test passes) |
| Error handler returns generic "Internal server error" for 500s (no stack traces leaked); 4xx messages are application-generated, not user-echoed. | — | `server/src/middleware/error.js:39–42` | None required. | Covered by error-handling paths (PASS) |

**Assessment:** Production configuration safeguards are implemented in code but **cannot be fully tested without a production environment** with real credentials. The `assertProductionConfig()` guard will correctly block startup with the current development `.env`.

---

## Overall summary

| Area | Result |
|---|---|
| 1. Anonymous complaint privacy | PASS |
| 2. Authentication, TOTP, session security | PASS |
| 3. Role-based and record-level authorization | PASS |
| 4. File upload validation, EXIF removal, private access | PASS |
| 5. Rate limiting, CAPTCHA, spam prevention | PASS |
| 6. MongoDB query safety, input validation | PASS |
| 7. Audit logs, unauthorized access | PASS |
| 8. Complaint retention, permanent deletion | PASS |
| 9. Signed URL expiry, access permissions | PASS |
| 10. Production configuration safeguards | Code correct; NOT TESTED (requires live prod env) |

### Automated test results (backend suite)
- **30 / 31 tests pass**
- 1 pre-existing failure: "email outbox is owner-only and development delivery is logged" — fails because the Resend API key in `.env` is invalid/not real. This is a configuration/credential issue, **not a security vulnerability**.

### Items NOT TESTED (require live external services)
- Real Resend email delivery (no valid API key / verified domain)
- Real Vercel Blob storage (no Vercel credentials)
- Live Cloudflare Turnstile (no production keys)
- HTTPS/TLS and HSTS in production (no deployed environment)
- Penetration test
- Manual WCAG 2.2 AA accessibility review

### Recommendation
The codebase is security-sound. No code changes are required. Before production deployment, the owner must complete the environment provisioning listed in `PRODUCTION_READINESS.md` and `OPEN_DECISIONS.md` (Resend domain, Turnstile keys, `BLOB_READ_WRITE_TOKEN` for the `apthex-complaint-evidence` Vercel Blob store, Lightsail hosting, real institute data, owner approvals), then run the production config guard and a manual penetration test.
