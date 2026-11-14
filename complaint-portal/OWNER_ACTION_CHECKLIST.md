# OWNER ACTION CHECKLIST — APTHEX Complaint Portal Production Launch

**Source documents reviewed:** `OPEN_DECISIONS.md`, `PRODUCTION_READINESS.md`, `EMAIL_INTEGRATION_AUDIT.md`, `SECURITY_AUDIT.md`  
**Prepared:** Sat Nov 07 2026  
**Status:** Development implementation complete; production approval pending.  
**Instruction:** Do not silently decide anything on behalf of the owner. Each item lists the action, who must provide it, current status, and how to verify completion. Duplicate items across source documents have been merged.

---

## 1. Decisions Requiring Owner or Legal Approval

| # | Action required | Who provides | Current status | How to verify completion |
|---|---|---|---|---|
| 1.1 | ~~Confirm the public portal URL~~ — **finalised (Nov 2026):** `https://apthex.com/help` (portal) and `https://apthex.com/help/desk` (Case Desk) on the Vercel `apthex` project; browser origin `https://apthex.com` (separate subdomain superseded). | Owner | **Resolved.** Set `APP_BASE_URL=https://apthex.com/help`, `CASE_DESK_URL=https://apthex.com/help/desk` and `CORS_ORIGINS=https://apthex.com` in `server/.env` (the Origin header carries no path, so `CORS_ORIGINS` holds the bare origin). | Values in `server/.env` match the final URLs, start with `https://`, and `CORS_ORIGINS=https://apthex.com` is present. |
| 1.2 | Approve retention period (recommended: 180 days after case completion) and backup deletion (recommended: 30 days). Legal review still required. | Owner + Legal | `RETENTION_DAYS=30` (development placeholder); `ESCALATION_DAYS=7`; backup 30 days recommended in `OPEN_DECISIONS.md`. | `RETENTION_DAYS=180` and `ESCALATION_DAYS=7` set in `server/.env`; legal sign-off documented. |
| 1.3 | Approve the 7-day escalation window and the on-call owner. | Owner | Recommended in `OPEN_DECISIONS.md`; not yet confirmed. | `ESCALATION_DAYS=7` in `server/.env`; on-call owner named. |
| 1.4 | Confirm urgent-alert recipients (recommended: `apthexx@gmail.com` plus an on-call address). | Owner | `URGENT_ALERT_RECIPIENTS=urgent@apthex.local` (placeholder, not a real domain). | Real, comma-separated email addresses in `server/.env`; verified by sending a test urgent alert. |
| 1.5 | Confirm whether roll numbers stay optional for identified reports. | Owner | Recommended as optional in `OPEN_DECISIONS.md`; not yet confirmed. | Owner confirms in writing; code already enforces optional roll numbers (no change needed if confirmed). |
| 1.6 | Confirm the small-number threshold of 5 for institute statistics. | Owner | Recommended as 5 in `OPEN_DECISIONS.md`; not yet confirmed. | `SMALL_NUMBER_THRESHOLD=5` in `server/.env`; owner confirms in writing. |
| 1.7 | Supply the real institute list (code, name, type, head name, head email, active status) as CSV. Demo `SCHOOL01`/`COLLEGE01` must not ship. | Owner | Demo institutes `SCHOOL01`/`COLLEGE01` seeded in development. | Real institute CSV loaded into MongoDB; `SCHOOL01`/`COLLEGE01` removed; monthly reports address real `head_email` values. |
| 1.8 | Approve final confirmation/alert email wording and the anonymity explanation. | Owner | Draft templates exist in `server/src/services/email.js`; not yet approved. | Owner reviews and signs off on email wording; templates unchanged in code unless owner requests edits. |
| 1.9 | Approve whether identified reporters always receive a confirmation email containing the reference ID. | Owner | Code sends confirmation only to identified reporters with a valid email; not yet owner-approved. | Owner confirms in writing; `acknowledgement_email` behavior in `complaints.js` matches the decision. |
| 1.10 | Approve the public status/follow-up policy and the privacy notice. | Owner | Status returns only `In Process`/`Completed` (no complaint content); follow-up is rate-limited and audited. Not yet owner-approved. | Owner reviews and signs off; privacy notice published at the portal. |
| 1.11 | Approve legal/privacy review, data-processor terms, incident response, and backup policy. | Owner + Legal | Not yet completed. | Legal sign-off documented; data-processor terms and incident response plan in place. |
| 1.12 | Complete a manual WCAG 2.2 AA accessibility review. | Owner (commissioned) | Not yet performed. | Accessibility audit report issued; any required fixes applied. |
| 1.13 | Complete a penetration test before launch. | Owner (commissioned) | Not yet performed. | Penetration test report issued; any critical/high findings remediated. |

---

## 2. External Account / Access Requirements (Blocked — cannot be set locally)

| # | Action required | Who provides | Current status | How to verify completion |
|---|---|---|---|---|
| 2.1 | **Resend account**: create account, add and verify sending domain `mail.apthex.com`, add DKIM/SPF/DMARC DNS records, create API key with sending permission, put `RESEND_API_KEY` in `server/.env`. | Owner (with DNS access) | `RESEND_API_KEY` present but unverified; `EMAIL_FROM` is `apthexx@gmail.com` (invalid for Resend). | Resend domain verified; `EMAIL_FROM=APTHEX Complaint Portal <no-reply@mail.apthex.com>`; real test email delivered successfully. |
| 2.2 | **Cloudflare Turnstile**: create Turnstile site for the portal hostname; obtain site key and secret key; put both in `server/.env`; set `CAPTCHA_DEV_BYPASS=false`. | Owner (with Cloudflare access) | `CLOUDFLARE_TURNSTILE_SITE_KEY` and `SECRET_KEY` empty; `CAPTCHA_DEV_BYPASS=true`. | Turnstile keys in `server/.env`; live Turnstile challenge accepts/rejects correctly on the portal. |
| 2.3 | **Vercel Blob**: create private blob store `apthex-complaint-evidence` in the Vercel dashboard (IAD1), generate a read/write token, put `BLOB_READ_WRITE_TOKEN` in `server/.env`; set `STORAGE_DRIVER=vercel-blob`. | Owner (with Vercel access) | `STORAGE_DRIVER=local`; `BLOB_READ_WRITE_TOKEN` empty. | Blob store private; token server-only; upload/download of evidence works via signed proxy URLs; `STORAGE_DRIVER=vercel-blob` in `.env`. |
| 2.4 | **AWS Lightsail**: provision Ubuntu 24.04 instance in Mumbai (`ap-south-1`), obtain static IP and SSH access; add instance IP to MongoDB Atlas Network Access. | Owner (with AWS access) | Not provisioned. | Lightsail instance running; IP whitelisted in MongoDB Atlas; server reachable on ports 22/80/443. |
| 2.5 | **MongoDB Atlas network access**: add Lightsail instance egress IP to Atlas Network Access list. | Owner (with Atlas access) | Not done (depends on Lightsail IP). | Lightsail IP appears in Atlas Network Access list; server connects to Atlas from production. |

---

## 3. DNS Changes Pending

| # | Action required | Who provides | Current status | How to verify completion |
|---|---|---|---|---|
| 3.1 | Confirm who controls the `apthex.com` DNS zone. | Owner | Not confirmed. | DNS zone controller identified in writing. |
| 3.2 | Add DNS records for Resend (DKIM, SPF, recommended DMARC) on `mail.apthex.com`. | Owner (with DNS access) | Not added. | Resend domain verification succeeds. |
| 3.3 | Add Cloudflare Turnstile DNS records if required by the Turnstile site configuration. | Owner (with DNS access) | Not added. | Turnstile site active and reachable. |
| 3.4 | ~~If the subdomain option (`complaints.apthex.com`) is chosen~~ — **N/A.** The subdomain option was not chosen; portal paths live under `https://apthex.com/help` on the existing `apthex.com` Vercel project, so no portal DNS record is required. Only the Lightsail **backend** hostname (finalised at provisioning, feeds `API_PROXY_TARGET`) will need a record. | Owner (with DNS access) | N/A (URL finalised Nov 2026). | n/a — no portal DNS record needed. |

---

## 4. Production Environment Variables Still Missing (settable locally)

| # | Variable | Current value | Required production value | Who sets | How to verify |
|---|---|---|---|---|---|
| 4.1 | `NODE_ENV` | `development` | `production` | Owner | Server starts only with production guard passing |
| 4.2 | `APP_BASE_URL` | `http://localhost:3000/help` | `https://apthex.com/help` (or confirmed subdomain URL) | Owner | Starts with `https://`; matches confirmed URL |
| 4.3 | `CASE_DESK_URL` | `http://localhost:3000/help/desk` | `https://apthex.com/help/desk` (or confirmed subdomain URL) | Owner | Starts with `https://`; matches confirmed URL |
| 4.4 | `CORS_ORIGINS` | `http://localhost:3000` | `https://apthex.com` | Owner | `allowedOrigins()` includes production origin |
| 4.5 | `SESSION_SECRET` | Development placeholder | 32+ random chars via `openssl rand -base64 48` | Owner | Not equal to default; passes production guard |
| 4.6 | `TOTP_ENCRYPTION_KEY` | Development placeholder | Different 32+ random chars via `openssl rand -base64 48` | Owner | Different from `SESSION_SECRET`; passes guard |
| 4.7 | `RETENTION_DAYS` | `30` | `180` (owner/legal approval required) | Owner | Equals approved retention period |
| 4.8 | `EMAIL_DEV_LOG` | `true` | `false` | Owner | Production guard passes; no console email logging |
| 4.9 | `CAPTCHA_DEV_BYPASS` | `true` | `false` | Owner | Production guard passes; Turnstile enforced |
| 4.10 | `AUTO_SEED` | `true` | `false` | Owner | Production guard passes; no auto-seeding |
| 4.11 | `REQUIRE_ORIGIN` | `false` | `true` | Owner | State-changing requests require trusted origin |
| 4.12 | `APTHEX_CASE_MAILBOX` | `case@apthex.local` (placeholder) | Real receiving address | Owner | Real domain; receives test email |
| 4.13 | `URGENT_ALERT_RECIPIENTS` | `urgent@apthex.local` (placeholder) | Real comma-separated recipients | Owner | Real domains; receives urgent test alert |
| 4.14 | `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | `owner@apthex.local` / `ChangeMe!123` | Initial owner email + strong one-time password (seed only; remove after first owner created) | Owner | First owner created; seed values removed from `.env` |

**Already set correctly (no action needed):** `PORT=4000`, `TRUST_PROXY=1`, `LOG_LEVEL=info`, `MONGODB_URI`, `DATABASE_NAME=Apethexhelpportal`, `STORAGE_SIGNING_SECRET` (optional), `STORAGE_SIGNED_URL_TTL_SECONDS=300`, upload limits, rate limits, `SESSION_TTL_HOURS=8`.

---

## 5. Live Integration Tests Pending (require live external services)

| # | Test | Why blocked | How to verify |
|---|---|---|---|
| 5.1 | Real Resend email delivery (new-complaint alert, urgent alert, reporter confirmation, escalation, monthly report) | No verified `mail.apthex.com` domain; no valid `RESEND_API_KEY` | Test email delivered to real inbox; `EmailOutbox` status shows `sent` |
| 5.2 | Real Vercel Blob storage (private image/voice upload, signed proxy URL access, file deletion) | No Vercel credentials; no Blob store provisioned | Upload succeeds; signed URL returns file; object is private; token never leaves server |
| 5.3 | Live Cloudflare Turnstile (accept valid token, reject invalid) | No production Turnstile keys | Valid challenge passes; invalid challenge returns 400 with `captchaFailed` |
| 5.4 | HTTPS/TLS and HSTS in production (`max-age=15552000`, `includeSubDomains`, `preload`) | No deployed production environment | `curl -I` returns `strict-transport-security` header; Caddy obtains TLS certificate |
| 5.5 | Production config guard (`assertProductionConfig()`) | Cannot run without real production `.env` | Server starts successfully with `NODE_ENV=production` and all production values |

---

## 6. Unresolved Test Failures

| # | Test | Failure reason | Severity | Owner action |
|---|------|---------------|----------|--------------|
| 6.1 | "email outbox is owner-only and development delivery is logged" (backend test) | `RESEND_API_KEY` in `.env` is invalid/not real, so delivery cannot succeed; outbox items remain in non-`sent`/`dev_logged` state | Configuration / credential (not a security vulnerability) | Configure real Resend credentials (item 2.1) and re-run `npm --workspace server test`; expect 31/31 PASS |

**Current automated test results:** 30/31 pass (the above failure is pre-existing and unrelated to security). All security code-level checks in `SECURITY_AUDIT.md` are PASS.

---

## 7. Exact Completion Criteria Before Production Deployment

All of the following must be true before the Complaint Portal is launched:

- [ ] Owner confirms final portal URL (subdomain vs `/help`) in writing; `APP_BASE_URL` and `CASE_DESK_URL` set to confirmed `https://` URL.
- [ ] `NODE_ENV=production` in `server/.env`.
- [ ] `SESSION_SECRET` and `TOTP_ENCRYPTION_KEY` regenerated via `openssl rand -base64 48`; not equal to defaults.
- [ ] `CAPTCHA_DEV_BYPASS=false`, `EMAIL_DEV_LOG=false`, `AUTO_SEED=false`, `REQUIRE_ORIGIN=true`, `STORAGE_DRIVER=vercel-blob`.
- [ ] `RETENTION_DAYS` and `ESCALATION_DAYS` set to owner/legal-approved values.
- [ ] Real `APTHEX_CASE_MAILBOX` and `URGENT_ALERT_RECIPIENTS` (no `.local` placeholders).
- [ ] `SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD` used for one-time seed, then removed from `server/.env`.
- [ ] Demo institutes `SCHOOL01`/`COLLEGE01` and synthetic development data removed from MongoDB; real institute list loaded.
- [ ] Resend account created; `mail.apthex.com` verified; DKIM/SPF/DMARC DNS added; `RESEND_API_KEY` and valid `EMAIL_FROM` in `server/.env`.
- [ ] Cloudflare Turnstile site created; site key and secret key in `server/.env`.
- [ ] Vercel Blob private store `apthex-complaint-evidence` created; `BLOB_READ_WRITE_TOKEN` in `server/.env`; `STORAGE_DRIVER=vercel-blob`.
- [ ] AWS Lightsail Ubuntu 24.04 instance in Mumbai provisioned; static IP added to MongoDB Atlas Network Access.
- [ ] DNS zone control confirmed; Resend/Turnstile DNS records added (no `complaints.apthex.com` record — the `/help` path option was finalised; the Lightsail backend hostname is chosen at provisioning for `API_PROXY_TARGET` only).
- [ ] `assertProductionConfig()` passes — server starts successfully with `NODE_ENV=production`.
- [ ] All 31 backend tests pass (30/31 currently; the 1 failure resolved by real Resend credentials).
- [ ] Real Resend delivery tested and verified (test email delivered).
- [ ] Real Vercel Blob upload/download via signed proxy URLs tested and verified.
- [ ] Live Cloudflare Turnstile challenge tested and verified.
- [ ] HTTPS/TLS and HSTS verified on deployed environment.
- [ ] Manual WCAG 2.2 AA accessibility review completed; findings addressed.
- [ ] Penetration test completed; critical/high findings remediated.
- [ ] Legal/privacy review, data-processor terms, incident response, and backup policy approved by owner + legal.
- [ ] `SEED_OWNER_PASSWORD` removed from `server/.env` after first owner is created.
- [ ] Legacy `client/` Vite directory optionally deleted.

**Do not deploy or modify production DNS without owner approval.** Real AWS credentials and Resend API keys must be written directly to `complaint-portal/server/.env` (gitignored) and never placed in chat or source control.
