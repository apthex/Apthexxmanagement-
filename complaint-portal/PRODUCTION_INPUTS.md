# Production handover — what is still needed

Status: the portal code, tests, build, and documentation are complete. **Production is not approved yet.** The remaining work is credentials, DNS/server access, and owner policy approvals.

Do not paste secrets into chat, email, a ticket, or git. Put them directly in `complaint-portal/server/.env` (already gitignored) or hand them to the deployer through a password manager. When you are done, tell me “credentials are in `server/.env`” and I will verify that the required variables are present without printing their values.

## 0. Rotate the leaked Gemini key first

The Gemini key pasted into chat must be treated as compromised. The portal does not use Gemini, so this does not affect the portal.

1. Open <https://aistudio.google.com/app/apikey>.
2. Find the exposed key and **delete/revoke** it. Do not just rename it.
3. Create a new key only if another project still needs Gemini; store it in a password manager or a local `.env`, never in chat or source control.
4. Review Google Cloud billing and API usage for unexpected activity.
5. Update any other application that used the old key.

## 1. Create the accounts and access

### Resend (email)

1. Create a Resend account.
2. Add the sending domain **`mail.apthex.com`** (a subdomain of the existing `apthex.com` domain).
3. Add the DNS records Resend shows (DKIM, SPF, and the recommended DMARC record). Wait for verification.
4. Create an API key with sending permission.
5. Put the key in `server/.env` as `RESEND_API_KEY`.
6. Set:
   - `EMAIL_FROM=APTHEX Complaint Portal <no-reply@mail.apthex.com>`
   - `APTHEX_CASE_MAILBOX=apthexx@gmail.com`
   - `URGENT_ALERT_RECIPIENTS=apthexx@gmail.com,contact@apthex.com` (remove `contact@` if not approved)

Resend cannot send from `@gmail.com`; the verified subdomain is required.

### Cloudflare Turnstile (CAPTCHA)

1. In the Cloudflare dashboard, open **Turnstile** and add a site.
2. Hostname/origin: `apthex.com` (the browser origin of the Vercel `apthex` project — the portal lives under `https://apthex.com/help`; no portal subdomain).
3. Widget mode: **Managed**.
4. Put the site key and secret key in `server/.env`:
   - `CLOUDFLARE_TURNSTILE_SITE_KEY`
   - `CLOUDFLARE_TURNSTILE_SECRET_KEY`
5. Set `CAPTCHA_DEV_BYPASS=false`.

### Vercel Blob (private evidence)

1. In the Vercel dashboard, create a blob store named `apthex-complaint-evidence` with **Private** access (IAD1 region).
2. Generate a read/write token (`vercel_blob_rw_...`) for the store.
3. Put these in `server/.env`:
   - `STORAGE_DRIVER=vercel-blob`
   - `BLOB_READ_WRITE_TOKEN=<the generated token>`

Do not commit the token. Never expose it to the browser (no `NEXT_PUBLIC_` prefix).

### AWS Lightsail (hosting)

1. Create an Ubuntu 24.04 instance in **Mumbai (`ap-south-1`)**, ideally 2 vCPU / 4 GB RAM.
2. Open only ports **22** (restricted to your IP), **80**, and **443**.
3. Attach a static IP.
4. Add the instance's public IP to MongoDB Atlas **Network Access**.
5. Portal paths need no new DNS record (part of `https://apthex.com/help`). Choose the **backend** hostname at provisioning and point it at the static IP with a DNS `A` record — that hostname becomes the `API_PROXY_TARGET` for the Vercel project. Caddy will obtain the TLS certificate automatically.
6. Provide the public IP and SSH access details (or run the deployment commands yourself). Do not send the SSH private key in chat; place it locally or use a password manager.

If you prefer not to manage a server, say so before creating the instance; an equivalent managed container host can be used, but AWS Mumbai was selected for data residency.

## 2. Values to put directly in `server/.env`

Do not send these values to me in chat. Generate or copy them locally.

| Variable | What to use |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_BASE_URL` | `https://apthex.com/help` |
| `CASE_DESK_URL` | `https://apthex.com/help/desk` |
| `CORS_ORIGINS` | `https://apthex.com` (browser origin — required because the Origin header carries no path and must sit alongside `APP_BASE_URL`) |
| `REQUIRE_ORIGIN` | `true` |
| `TRUST_PROXY` | `1` (Caddy is directly in front of the app) |
| `SESSION_SECRET` | Output of `openssl rand -base64 48` |
| `TOTP_ENCRYPTION_KEY` | A different `openssl rand -base64 48` output |
| `RETENTION_DAYS` | `180` (recommended; owner/legal approval required) |
| `ESCALATION_DAYS` | `7` |
| `SMALL_NUMBER_THRESHOLD` | `5` |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | `APTHEX Complaint Portal <no-reply@mail.apthex.com>` |
| `APTHEX_CASE_MAILBOX` | `apthexx@gmail.com` |
| `URGENT_ALERT_RECIPIENTS` | Approved recipients, comma-separated |
| `CLOUDFLARE_TURNSTILE_SITE_KEY` | Turnstile site key |
| `CLOUDFLARE_TURNSTILE_SECRET_KEY` | Turnstile secret key |
| `CAPTCHA_DEV_BYPASS` | `false` |
| `EMAIL_DEV_LOG` | `false` |
| `STORAGE_DRIVER` | `vercel-blob` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token (`vercel_blob_rw_...`) |
| `AUTO_SEED` | `false` |
| `SEED_OWNER_EMAIL` | Initial owner login email (one-time seed only) |
| `SEED_OWNER_PASSWORD` | Strong one-time password (one-time seed only) |

`MONGODB_URI` and `DATABASE_NAME` are already configured in `server/.env`. Keep the dedicated database name and do not point it at the management database.

After the first owner is created, remove `SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD` from `server/.env`. The owner will use password + TOTP.

## 3. Non-secret information and approvals I need

Please send these in chat (they are not secrets):

1. ~~Confirmation that the final public URL is agreed~~ — **finalised (Nov 2026):** `https://apthex.com/help` is the final public URL (Case Desk: `https://apthex.com/help/desk`).
2. Which email address should be the initial owner login.
3. The real institute list as CSV with these columns:

```csv
code,name,type,head_name,head_email,status
SCHOOL-CODE,Institute name,school,Principal Name,head@example.edu,active
```

4. Approval of the 180-day retention period, 7-day escalation period, and 30-day backup retention.
5. Approval of `apthexx@gmail.com` plus any on-call recipient for urgent alerts.
6. Confirmation that roll numbers stay optional for identified reports.
7. Approval of the small-number threshold of 5.
8. Whether identified reporters should always receive a confirmation email containing the reference ID.
9. Approval of the email wording and anonymity explanation. I can send a draft for review.
10. Legal/privacy sign-off for the privacy notice, data-processor terms, incident response, and backup deletion.
11. Confirmation that the demo institutes, synthetic test data, and development owner account may be removed before launch.

## 4. Deployment commands (after credentials are in place)

```bash
cd complaint-portal
npm ci
npm run build
```

Production start (behind Caddy):

```bash
npm run start:server
npm run start:client
```

Then verify:

```bash
SMOKE_BASE_URL=https://apthex.com/help npm run test:smoke
```

The API refuses to start in production if required variables are missing or unsafe development values remain enabled.

## 5. What I will do after handover

1. Verify `server/.env` has every required production value without revealing secrets.
2. Run the production build and the smoke test against the deployed URL.
3. Seed the first owner and the real institutes, then remove the seed password.
4. Verify Resend delivery, Turnstile rejection/acceptance, private Vercel Blob upload, session-protected evidence access, and audit logging with real services.
5. Run the manual accessibility, load, and penetration checks.
6. Remove demo data and development credentials, then provide the launch sign-off and portal URL/QR.

Until these steps are complete, treat the portal as **staging only**.
