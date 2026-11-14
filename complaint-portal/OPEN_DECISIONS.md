# OPEN DECISIONS — APTHEX Complaint Portal

Status: **development implementation complete; production approval pending.**

The portal is built in the public website repository at `complaint-portal/`. It is separate from the marketing site and from the internal management dashboard. Provider choices have been made; credentials, DNS access, and owner policy approvals are still required before launch.

## Selected production stack

These choices were delegated to the implementation team and are now the target configuration.

| Area | Selection | Reason |
| --- | --- | --- |
| Email | **Resend**, sending from a verified `mail.apthex.com` subdomain | Already integrated with a database outbox and retries; simpler and more reliable than Gmail SMTP; keeps the root domain's mail reputation isolated |
| CAPTCHA | **Cloudflare Turnstile** | Privacy-friendly, free, and already integrated |
| Evidence storage | **Vercel Blob `apthex-complaint-evidence`**, Private access | Server-side `BLOB_READ_WRITE_TOKEN`, private blobs, short-lived signed proxy URLs |
| Hosting | **AWS Lightsail, Mumbai (`ap-south-1`)**, Ubuntu 24.04 + Caddy TLS | Simple fixed-cost India hosting; Caddy provides automatic HTTPS and a reverse proxy |
| Database | Existing **MongoDB Atlas**, dedicated database `Apethexhelpportal` | Already configured; remains isolated from the management `Apthexx` database |
| Public portal URL | **`https://apthex.com/help`** (finalised Nov 2026) | Same origin as the marketing site; portal routes live under `/help` on the existing Vercel `apthex` project |
| Case Desk URL | **`https://apthex.com/help/desk`** (finalised Nov 2026) | Same protected origin as the public portal, staff-only routes under `/help/desk` |
| Roll number | **Optional for identified reports; never collected in anonymous mode** | Keeps the reporting barrier low and preserves anonymous-mode guarantees |
| Small-number threshold | **5** | Suppresses institute statistics for very small groups |
| Retention | **180 days after case completion** (recommended operational value; legal review still required) | Allows follow-up while applying data minimisation |
| Escalation | **7 days** for unfinished cases | Gives the Case Desk a clear follow-up window |
| Backup retention | **30 days**, encrypted, aligned with the retention/deletion policy | Limits backup copies without losing short-term recovery |

## Resolved implementation decisions

| Decision | Resolution |
| --- | --- |
| Repository / location | Public website repo, `complaint-portal/`; marketing site untouched |
| Frontend | Next.js App Router (`client-next`); legacy Vite `client/` is unused |
| Backend | Express + MongoDB/Mongoose |
| Database isolation | Dedicated `DATABASE_NAME`; do not reuse the management `Apthexx` database |
| Case Desk placement | Separate staff-only area inside this portal (`/staff/login`, `/desk`), not the internal operations portal |
| Anonymous identity | No identity fields or contact document are stored; identity fields are rejected |
| Evidence privacy | Private storage plus short-lived signed URLs; every access is audited |
| Staff authentication | Password + TOTP 2FA, server-side revocable sessions, CSRF protection |
| Public status detail | Status only (`In Process` / `Completed`), no complaint content |
| CAPTCHA | Cloudflare Turnstile; development bypass is blocked in production |
| Email | Resend with a database outbox and retry worker |
| Email sender | `APTHEX Complaint Portal <no-reply@mail.apthex.com>` after domain verification |
| Case mailbox | `apthexx@gmail.com` (receives staff notifications; it is not a sender address) |
| Urgent alerts | `apthexx@gmail.com` plus any approved on-call recipients |

## Required before production

### Credentials and access

1. **Resend**: create an account, add and verify `mail.apthex.com`, then put `RESEND_API_KEY` directly in `server/.env`. DNS access is needed for the DKIM/SPF records.
2. **Cloudflare Turnstile**: create a Turnstile site for `apthex.com` (the browser origin serving `https://apthex.com/help`); provide the site key and secret key directly in `server/.env`.
3. **Vercel Blob**: create a private blob store `apthex-complaint-evidence` (Private access), generate a read/write token, and put `BLOB_READ_WRITE_TOKEN` in `server/.env`.
4. **AWS Lightsail**: provision an Ubuntu 24.04 instance in Mumbai and provide its public IP (or SSH access) for deployment. Add the instance IP to MongoDB Atlas network access.
5. **DNS**: no portal-specific record is needed — the portal lives at `https://apthex.com/help`. Add the Resend/Turnstile DNS records and, after Lightsail provisioning, an `A` record for the chosen backend hostname (this becomes `API_PROXY_TARGET`). Confirm who controls the `apthex.com` DNS zone.
6. **Secrets**: generate `SESSION_SECRET` and `TOTP_ENCRYPTION_KEY` with `openssl rand -base64 48` and put them directly in `server/.env`; never send them in chat.
7. **Initial owner**: choose the owner login email and set a strong one-time password directly in `server/.env` for the seed run, then remove `SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD` after seeding.

### Owner approvals

1. ~~Confirm the selected portal hostname~~ — **finalised (Nov 2026):** portal `https://apthex.com/help`, Case Desk `https://apthex.com/help/desk`, browser origin `https://apthex.com`. Confirm the final QR/poster URL (same address).
2. Approve retention (currently recommended: 180 days after completion) and backup deletion.
3. Approve the 7-day escalation window and the on-call owner.
4. Confirm urgent-alert recipients (recommended: `apthexx@gmail.com` and an on-call address).
5. Confirm whether roll numbers stay optional for identified reports.
6. Confirm the small-number threshold of 5.
7. Supply the real institute list: code, name, type, head name, head email, and active status. Demo `SCHOOL01`/`COLLEGE01` must not ship.
8. Approve final confirmation/alert email wording and the anonymity explanation.
9. Approve whether identified reporters always receive a confirmation email containing the reference ID.
10. Approve the public status/follow-up policy and the privacy notice.
11. Approve legal/privacy review, data-processor terms, incident response, and the backup policy.
12. Complete a manual WCAG 2.2 AA accessibility review and a penetration test before launch.

### Cleanup before launch

- Drop or migrate the synthetic development data. The development Atlas database currently contains test records.
- Remove the demo institutes and the development owner account.
- Set `AUTO_SEED=false`, `CAPTCHA_DEV_BYPASS=false`, `EMAIL_DEV_LOG=false`, and `STORAGE_DRIVER=vercel-blob`.
- Remove `SEED_OWNER_PASSWORD` after the first owner is created.
- Optionally delete the unused legacy `client/` Vite directory.

## Development placeholders — must not ship as-is

- `owner@apthex.local` / `ChangeMe!123`
- `CAPTCHA_DEV_BYPASS=true`
- `EMAIL_DEV_LOG=true`
- `STORAGE_DRIVER=local`
- `AUTO_SEED=true`
- Development session and TOTP keys
- Placeholder retention/escalation values in local development

Production startup rejects the unsafe values listed above where the server can detect them. Do not treat placeholders as approved decisions.

See `PRODUCTION_INPUTS.md` for the exact handover checklist and secure-secret instructions.
