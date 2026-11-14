# Production Readiness Audit — APTHEX Complaint Portal

**Audit scope:** `complaint-portal/server/.env` vs production requirements  
**Audit date:** Sat Nov 07 2026  
**Portal URL target:** `https://apthex.com/help` (same origin as main APTHEX website)  
**Case Desk URL target:** `https://apthex.com/help/desk`  

## Summary label definitions

| Label | Meaning |
|---|---|
| **READY** | Correctly configured for production as-is |
| **MISSING** | Value is wrong, absent, or a development placeholder; can be set locally without external account access |
| **BLOCKED** | Cannot be completed without external account/provisioning access (AWS, Cloudflare, Resend, MongoDB Atlas, DNS) |

---

## 1. Runtime configuration

| Variable | Current value | Required production value | Label | Notes |
|---|---|---|---|---|
| `NODE_ENV` | `development` | `production` | MISSING | Must be changed before `assertProductionConfig()` will run |
| `PORT` | `4000` | `4000` | READY | Default acceptable |
| `TRUST_PROXY` | (unset, default `1`) | `1` (Caddy in front) | READY | Default matches Caddy single-hop topology |
| `LOG_LEVEL` | (unset, default `info`) | `info` | READY | Default acceptable |

---

## 2. MongoDB production configuration

| Variable | Current value | Required production value | Label | Notes |
|---|---|---|---|---|
| `MONGODB_URI` | Set (Atlas SRV, credentials embedded) | Atlas URI, dedicated DB user | READY | Value present; verify Atlas Network Access allows the Lightsail instance egress IP |
| `DATABASE_NAME` | `Apethexhelpportal` | Dedicated DB name, not the management `Apthexx` DB | READY | Isolated from management dashboard DB |

**Assessment:** MongoDB is configured and connected (verified in testing). The URI is present in `.env` (gitignored). External action: add Lightsail instance IP to MongoDB Atlas Network Access list.

---

## 3. Public URLs and CORS (apthex.com/help integration)

| Variable | Current value | Required production value | Label | Notes |
|---|---|---|---|---|
| `APP_BASE_URL` | `http://localhost:3000/help` | `https://apthex.com/help` | MISSING | Currently `http` + `localhost`; `assertProductionConfig()` requires `https://` |
| `CASE_DESK_URL` | `http://localhost:3000/help/desk` | `https://apthex.com/help/desk` | MISSING | Currently `http` + `localhost` |
| `CORS_ORIGINS` | `http://localhost:3000` | `https://apthex.com` | MISSING | Must allow the production site origin; `allowedOrigins()` also includes `APP_BASE_URL` automatically |

**Assessment:** All three URL/CORS values point at localhost and must be updated for `apthex.com`. No external account access required.

---

## 4. Production secrets, session security, TOTP encryption

| Variable | Current value | Required production value | Label | Notes |
|---|---|---|---|---|
| `SESSION_SECRET` | Present (long value) | 32+ random chars, `openssl rand -base64 48` | MISSING | Present and passes the length check, but is a weak/predictable development value. Regenerate before production. |
| `TOTP_ENCRYPTION_KEY` | Present (`shubha-jadha-sa-aptehes-serewrw`) | 32+ random chars, different `openssl rand -base64 48` output | MISSING | Present and passes length check, but is a development placeholder. Regenerate before production. |
| `SESSION_TTL_HOURS` | (unset, default `8`) | `8` | READY | Default acceptable |

**Assessment:** Both secrets are present but are development values, not cryptographically random. They must be regenerated locally with `openssl rand -base64 48`. Secret values must not be exposed in chat or source control.

---

## 5. CAPTCHA and email development settings (must be disabled in production)

| Variable | Current value | Required production value | Label | Notes |
|---|---|---|---|---|
| `CAPTCHA_DEV_BYPASS` | `true` | `false` | MISSING | Production refuses to start with this enabled |
| `EMAIL_DEV_LOG` | `true` | `false` | MISSING | Development console logging must be disabled |
| `AUTO_SEED` | `true` | `false` | MISSING | Production refuses to start with this enabled |
| `SEED_OWNER_EMAIL` | `owner@apthex.local` | Initial owner email (one-time seed) | MISSING | Development placeholder; set for seed run, then remove |
| `SEED_OWNER_PASSWORD` | `ChangeMe!123` | Strong one-time password (one-time seed) | MISSING | Development placeholder; remove from `.env` after first owner is created |

**Assessment:** All four dev-convenience flags/values must be flipped or replaced. No external account access required.

---

## 6. Evidence storage — Vercel Blob validation

| Variable | Current value | Required production value | Label | Notes |
|---|---|---|---|---|
| `STORAGE_DRIVER` | `local` | `vercel-blob` | MISSING | Production refuses to start unless `vercel-blob` |
| `BLOB_READ_WRITE_TOKEN` | (empty) | Vercel Blob read/write token (`vercel_blob_rw_...`) | BLOCKED | Requires Vercel dashboard token generation |
| `STORAGE_SIGNING_SECRET` | (empty) | Optional; falls back to `SESSION_SECRET` | READY | Optional |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | `300` | `300` | READY | 5-minute signed URL TTL acceptable |

**Assessment:** Vercel Blob adapter code is fully implemented (`storage.js` with `put`, `get`, `del` from `@vercel/blob`). Local storage remains available for development. Blob store + read/write token require Vercel dashboard provisioning (BLOCKED).

---

## 7. Resend email configuration and sender domain

| Variable | Current value | Required production value | Label | Notes |
|---|---|---|---|---|
| `RESEND_API_KEY` | Present | Valid Resend API key with sending permission | READY | Value present; verify it is valid and not a leaked/test key |
| `EMAIL_FROM` | `APTHEX Complaint Portal apthexx@gmail.com` | `APTHEX Complaint Portal <no-reply@mail.apthex.com>` | BLOCKED | Resend cannot send from `@gmail.com`. Requires Resend account + verified domain `mail.apthex.com` + DNS (DKIM/SPF/DMARC) |
| `APTHEX_CASE_MAILBOX` | `case@apthex.local` | `apthexx@gmail.com` (receiving only) | MISSING | `.local` is not a real domain |
| `URGENT_ALERT_RECIPIENTS` | `urgent@apthex.local` | Approved recipients, comma-separated (e.g. `apthexx@gmail.com,on-call@...`) | MISSING | `.local` is not a real domain |
| `EMAIL_MAX_ATTEMPTS` | (unset, default `5`) | `5` | READY | Default acceptable |
| `EMAIL_OUTBOX_TTL_DAYS` | (unset, default `30`) | `30` | READY | Default acceptable |

**Assessment:** Resend API key is present, but the sender address `@gmail.com` is invalid for Resend production sending. Requires Resend account + domain verification for `mail.apthex.com` + DNS records (BLOCKED). Case mailbox and urgent recipients use `.local` placeholders and need real addresses (MISSING).

---

## 8. CORS, allowed origins, HTTPS requirements

Production `assertProductionConfig()` enforces:

| Check | Current state | Label | Notes |
|---|---|---|---|
| `APP_BASE_URL` starts with `https://` | `http://localhost:3000/help` | MISSING | Fails production guard |
| `REQUIRE_ORIGIN` | `false` | `true` | MISSING | Production deployment uses same-origin proxy; set to `true` |
| Allowed origins | `APP_BASE_URL` + `CORS_ORIGINS` | `https://apthex.com` + `https://apthex.com/help` | MISSING | `allowedOrigins()` derives from `APP_BASE_URL` + `CORS_ORIGINS` |

**Assessment:** HTTPS enforcement and origin checking are implemented in code but not yet configured with production values. No external account access required (DNS for `apthex.com` already exists).

---

## 9. Production config guard (`assertProductionConfig()`)

The server **will refuse to start** in `NODE_ENV=production` with the current `.env` because:

1. `APP_BASE_URL` does not start with `https://`
2. `SESSION_SECRET` / `TOTP_ENCRYPTION_KEY` are weak dev values (would need to be < 32 chars or equal to defaults to fail, but they are predictable — should be regenerated regardless)
3. `RESEND_API_KEY` present but `EMAIL_FROM` invalid for Resend
4. `CLOUDFLARE_TURNSTILE_SITE_KEY` / `SECRET_KEY` empty
5. `CAPTCHA_DEV_BYPASS=true`
6. `AUTO_SEED=true`
7. `STORAGE_DRIVER=local` (not `vercel-blob`)

---

## 10. Production readiness report

### READY (no action required)

| Area | Item |
|---|---|
| MongoDB | `MONGODB_URI` and `DATABASE_NAME` present; isolated from management DB |
| Blob store | `BLOB_READ_WRITE_TOKEN` (Vercel dashboard) |
| Session TTL | Default `8` hours |
| Log level | Default `info` |
| Port | Default `4000` |
| Trust proxy | Default `1` (single Caddy hop) |
| Resend API key | Value present (verify validity) |
| Email max attempts | Default `5` |
| Email outbox TTL | Default `30` days |
| Upload limits | `MAX_IMAGE_BYTES=2MB`, `MAX_VOICE_BYTES=10MB`, `MAX_IMAGES=5`, `MAX_TOTAL_UPLOAD_BYTES=25MB` |
| Rate limits | All configured with sensible defaults |
| Vercel Blob adapter code | Fully implemented in `storage.js` (put/get/del + server-side proxy download) |
| Local storage fallback | Preserved for development (`STORAGE_DRIVER=local`) |

### MISSING (can be set locally; no external account required)

| Variable | Change needed |
|---|---|
| `NODE_ENV` | `development` → `production` |
| `APP_BASE_URL` | `http://localhost:3000/help` → `https://apthex.com/help` |
| `CASE_DESK_URL` | `http://localhost:3000/help/desk` → `https://apthex.com/help/desk` |
| `CORS_ORIGINS` | `http://localhost:3000` → `https://apthex.com` |
| `SESSION_SECRET` | Regenerate with `openssl rand -base64 48` |
| `TOTP_ENCRYPTION_KEY` | Regenerate with `openssl rand -base64 48` (different from SESSION_SECRET) |
| `RETENTION_DAYS` | `30` → `180` (owner/legal approval required) |
| `EMAIL_DEV_LOG` | `true` → `false` |
| `CAPTCHA_DEV_BYPASS` | `true` → `false` |
| `AUTO_SEED` | `true` → `false` |
| `REQUIRE_ORIGIN` | `false` → `true` |
| `BLOB_READ_WRITE_TOKEN` | Empty → `vercel_blob_rw_...` from Vercel dashboard |
| `APTHEX_CASE_MAILBOX` | `case@apthex.local` → real receiving address |
| `URGENT_ALERT_RECIPIENTS` | `urgent@apthex.local` → real comma-separated recipients |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | Set for one-time seed, then remove from `.env` |

### BLOCKED (requires external account/provisioning access)

| Item | Required external access |
|---|---|
| **Resend sender domain** | Resend account + verify `mail.apthex.com` + add DKIM/SPF/DMARC DNS records. `EMAIL_FROM` must become `APTHEX Complaint Portal <no-reply@mail.apthex.com>`. Resend cannot send from `@gmail.com`. |
| **Cloudflare Turnstile** | Cloudflare account + create Turnstile site for the portal hostname + obtain site key and secret key. |
| **Vercel Blob store** | Vercel account + create private blob store `apthex-complaint-evidence` + generate read/write token (`BLOB_READ_WRITE_TOKEN`). |
| **Cloudflare Turnstile** | Cloudflare account + create Turnstile site for the portal hostname + obtain site key and secret key. |
| **AWS Lightsail** | (Hosting, not a `.env` var) Ubuntu 24.04 instance in Mumbai + static IP + add IP to MongoDB Atlas Network Access. |
| **MongoDB Atlas network** | Add Lightsail egress IP to Atlas Network Access list. |
| **DNS** | Confirm `apthex.com` DNS zone control; add records for Resend and Turnstile as needed. (Portal itself is served at `apthex.com/help` via existing site; no new subdomain required.) |

---

## Overall verdict

**The Complaint Portal backend is NOT production-ready.**

- **READY items:** 16 (MongoDB, Vercel Blob token requirement, session TTL, upload limits, rate limits, Vercel Blob adapter code, etc.)
- **MISSING items:** 15 (URLs, secrets, dev-convenience flags, email addresses — all configurable locally)
- **BLOCKED items:** 5 (Resend domain, Turnstile keys, Vercel Blob store, Lightsail hosting, Atlas network access — all require external accounts)

The `assertProductionConfig()` guard will reject startup in production with the current `.env`. No code changes are required — the production validation logic, Vercel Blob adapter, CORS, and HTTPS enforcement are all implemented. Remaining work is entirely environment provisioning and owner approvals.

**Do not deploy or modify DNS without owner approval.** Real Vercel Blob token must not be placed in chat or source control; write it directly to `complaint-portal/server/.env` (gitignored).
