# Apthex Internal Operations Portal (`apt-root.apthex.com`)

Private, login-only operations portal for Apthex Technologies Pvt. Ltd. Covers leads, clients, tasks, daily work logs, meetings, finances, members directory, security audit logs, and LiveWeb visitor analytics.

> **CONFIDENTIAL & INTERNAL USE ONLY**  
> Built strictly to the specifications of `Apthex_Internal_Portal_Build_Spec.pdf` (Version 1.0, 23 October 2026).

---

## 1. Architectural Overview & Boundary Isolation

### Isolated Architecture
- **Workspace Isolation:** The internal operations portal resides completely in this directory and has zero connection to the public website (`apthex.com`).
- **Separate Browser Origin:** Operates on its own subdomain `apt-root.apthex.com`.
- **Zero Trust Front Door:** Cloudflare Access (email allowlist + one-time pin) protects the custom domain. Next.js middleware cryptographically validates the `Cf-Access-Jwt-Assertion` header using Cloudflare's JWKS public keys (`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`).
- **Vercel Deployment Protection:** Direct access to auto-generated `*.vercel.app` URLs must be locked via *Standard Protection (Vercel Authentication)*, preventing attackers from bypassing Cloudflare.

### Technology Stack
- **Framework:** Next.js 15 (App Router), TypeScript (Strict Mode)
- **Styling:** Tailwind CSS, shadcn/ui design language
- **Colors:** Dark top nav (`#17171B`), light grey sidebar, white canvas, Cyber Red primary actions (`#E11D2E`), Status green (`#157B41`), amber (`#9A6400`), blue (`#2355B8`)
- **Typography:** Self-hosted Space Grotesk (headings) and Inter (body) via `next/font` (Google Fonts CDNs blocked via CSP)
- **Database & ORM:** PostgreSQL (Neon serverless) via Drizzle ORM; local development and test suite utilize PGlite embedded engine for zero-dependency execution
- **Authentication:** Server-side sessions (sha256 hashed tokens, 8-hour idle timeout, 7-day max lifetime), Argon2id password hashing (`m=19456, t=2, p=1`), TOTP 2FA with replay prevention (`last_totp_step`) and 10 single-use recovery codes
- **Audit Logging:** Append-only immutable audit trail; restricted application database role has `INSERT` and `SELECT` privileges only (`UPDATE`, `DELETE`, `TRUNCATE` denied)

---

## 2. Local Development Quickstart

### Prerequisites
- Node.js `>= 20.19.0`
- npm `>= 10.0.0`

### Step 1: Environment Configuration
Copy the template to `.env.local`:
```bash
cp .env.example .env.local
```
Key local development settings in `.env.local`:
```dotenv
DATABASE_URL=pglite://./.local-db
DATABASE_URL_MIGRATE=pglite://./.local-db
DATABASE_SSL=false
APP_URL=http://localhost:3000
ACCESS_GATE_ENABLED=false
TOTP_REQUIRED=true
DEV_SHOW_SETUP_LINKS=true
```

### Step 2: Database Migration & Synthetic Seeding
Run the local database initialization script to apply Drizzle migrations and seed synthetic demonstration accounts:
```bash
npm run db:reset-local
```
This seeds the following test accounts:
| Name | Role | Email | Password |
| :--- | :--- | :--- | :--- |
| **Devendra Hyalij** | Owner | `devendra@apthex.test` | `Apthex-local-owner-2026` |
| **Pranav Patil** | Owner | `pranav@apthex.test` | `Apthex-local-owner-2026` |
| **Shubham Jadhav** | Team | `shubham@apthex.test` | `Apthex-local-owner-2026` |
| **Rishi Shakya** | Team | `rishi@apthex.test` | `Apthex-local-owner-2026` |
| **Om Kale** | Growth | `om@apthex.test` | `Apthex-local-owner-2026` |
| **Viewer Test** | Viewer | `viewer@apthex.test` | `Apthex-local-owner-2026` |

*TOTP seed secret for dev accounts:* `JBSWY3DPEHPK3PXPJBSWY3DP`  
To generate a current valid TOTP code in your terminal:
```bash
npm run otp -- devendra@apthex.test
```

### Step 3: Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Automated Test Suite & Code Quality

Run full TypeScript compilation check:
```bash
npm run lint
```

Run automated Vitest test suite:
```bash
npm test
```

### Test Coverage Highlights
- **Role Permission Matrix:** Unit tests verifying access boundaries for all 4 roles (Owner, Team, Growth, Viewer) against every capability.
- **Auth & Session Security:** Verifies Argon2id parameters, minimum 12-char length, common password dictionary check, TOTP step generation, replay rejection, session idle/max timeouts.
- **Finance Integrity:** Verifies integer-paise arithmetic, reversal entries (equal and opposite), and formula injection escaping on CSV exports (`=`, `+`, `-`, `@`, tab, CR).
- **Work Logs & IST Locking:** Verifies Monday-based week calculation, one-log-per-day constraint, and request-time midnight lock in Asia/Kolkata timezone.
- **Audit Logging & Atomic Transactions:** Verifies that successful mutations and audit events commit in a single database transaction, while denied/failed requests write in standalone transactions.

---

## 4. Production Hardening & Deployment Guide

### Vercel Project Setup
1. Create a **new, dedicated Vercel project** for `apt-root.apthex.com`. Do NOT reuse the public website project.
2. In Vercel Project Settings:
   - **Deployment Protection:** Select *Standard Protection*, method *Vercel Authentication*.
   - **Custom Domain:** Bind `apt-root.apthex.com` through Cloudflare DNS.
   - **Critical Trap Avoidance:** Do NOT select "All Deployments" (this would block Cloudflare proxying); do NOT select "(Legacy)".
   - Verify: `curl -I https://<project>.vercel.app` must return `401 Unauthorized` or redirect to Vercel login.

### Cloudflare Access Setup
1. In Cloudflare Zero Trust:
   - Add an Application for `apt-root.apthex.com`.
   - Setup Policy: Action *Allow*, Rule *Emails in allowlist* (4-6 authorized personnel).
   - Copy Application **AUD Tag** and **Team Domain** into Vercel environment variables:
     - `CF_ACCESS_TEAM_DOMAIN=your-team.cloudflareaccess.com`
     - `CF_ACCESS_AUD=your-application-aud-tag`
     - `ACCESS_GATE_ENABLED=true`

### Database Deployment (Neon PostgreSQL)
1. Deploy a Neon PostgreSQL project on a paid plan with 30-day point-in-time automated backups enabled.
2. Run database migration script using migration role:
   ```bash
   DATABASE_URL_MIGRATE="postgres://owner:...@ep-xyz.neon.tech/neondb?sslmode=require" npm run db:migrate
   ```
3. Execute `db/production-hardening.sql` using the database superuser/owner role to create a restricted `app_user` role:
   ```sql
   -- Grants application role only required permissions and revokes DELETE/UPDATE on audit_events
   REVOKE ALL ON audit_events FROM app_user;
   GRANT SELECT, INSERT ON audit_events TO app_user;
   ```
4. Set `DATABASE_URL` in Vercel to connect as the restricted `app_user`.

### Rollback Strategy
- **Application Rollback:** Use Vercel's instant rollback feature to redeploy the previous immutable deployment artifact.
- **Database Rollback:** Neon provides Point-In-Time Restore (PITR) within the 30-day retention window.
- **Audit Immutability:** Because `audit_events` is append-only, rollback events must be inspected via audit logs.

---

## 5. Security & Permission Reference Matrix

| Module / Action | Owner | Team | Growth | Viewer | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Dashboard** | ✓ | ● | ● | R | Non-owners see only personal tasks/meetings; Viewers land on Leads |
| **Leads** | ✓ | — | ✓ | R | Growth & Owner manage; Team has no access; Won opens client conversion |
| **Clients** | ✓ | ● | ✓ | R | Team sees only clients they appear on via `client_assignments` |
| **Tasks** | ✓ | ● | ● | — | Only Owner can create/assign; Assignee can only change status and comment |
| **Work Logs** | ✓ | ● | ● | — | 1 log/member/day; locks at midnight IST; ratings 1-5 visible to Owner only |
| **Meetings** | ✓ | ● | ● | R | Plain text notes only; members see attended or client-assigned meetings |
| **Finance** | ✓ | — | — | — | Owner only; integer-paise math; reversals only (never deleted); owner email alerts |
| **Members** | ✓ | R | R | — | Owner only for edits/deactivations; deactivation revokes all sessions immediately |
| **Audit Log** | ✓ | — | — | — | Owner only; immutable append-only trail; records reads, writes, denials, and auth |
| **LiveWeb** | ✓ | — | R | — | Live & historic visitors; IP, location, device, referrer; explicit unavailable fallback |

*Legend: ✓ Full Access · ● Scoped to Own Records Only · R Read-Only · — No Access*
