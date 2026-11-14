# TEST REPORT — APTHEX Complaint Portal

**Date:** 5 November 2026  
**Portal location:** `complaint-portal/` in the public website repository  
**Environment:** Linux, Node.js v24.20.0, npm workspaces, Next.js 16.4.5, Express 5, MongoDB (Atlas for manual E2E; `mongodb-memory-server` for integration tests)  
**Browser:** Firefox 157.0 via Playwright (headless)

## Verdict

**PASS for development/demo acceptance. NOT approved for production launch yet.**

All automated functional, security, build, and browser checks passed on the final code. Production readiness still depends on the owner decisions and provider integrations listed in `OPEN_DECISIONS.md` and the limitations below.

## Summary

| Check | Result |
| --- | --- |
| Backend integration suite | **31 / 31 PASS** |
| Deployment smoke test | **4 / 4 PASS** |
| API end-to-end (real HTTP, Atlas test DB) | **30 / 30 PASS** |
| Browser UI end-to-end (Firefox) | **15 / 15 PASS** |
| Production build (`next build`) | **PASS** — all routes generated |
| Security headers (CSP, HSTS, frame denial, noindex) | **PASS** |
| Production configuration guard | **PASS** — refuses unsafe production settings |
| Vercel Blob production configuration guard | **PASS** — requires `STORAGE_DRIVER=vercel-blob` and `BLOB_READ_WRITE_TOKEN` in production |
| Secret exposure scan of client build and server source | **PASS** — no live credentials; only documented dev placeholder defaults |
| Dependency audit (`npm audit`) | **PASS** — 0 vulnerabilities |
| Mobile layout overflow check (390 px) | **PASS** — 0 px horizontal overflow |
| Uncaught browser errors / console errors | **PASS** — none |

## 1. Backend integration tests

Command:

```bash
npm --workspace server test
```

Result: **31 passed, 0 failed** (about 15–25 s depending on MongoDB download/cache). Uses an isolated in-memory MongoDB and temporary private storage.

| # | Test | Result |
| --- | --- | --- |
| 1 | Health reports a connected database | PASS |
| 2 | Public config exposes languages and CAPTCHA state without secrets | PASS |
| 3 | Institute validation accepts known code, rejects unknown/malformed | PASS |
| 4 | Identified complaint is accepted and separates identity into Contact | PASS |
| 5 | Anonymous complaint stores no identity at all | PASS |
| 6 | Anonymous mode rejects personal information | PASS |
| 7 | Urgent submissions use urgent category and alert the case team | PASS |
| 8 | Submission validation rejects short text, invalid category, incomplete identity | PASS |
| 9 | Duplicate complaint text inside duplicate window is rejected | PASS |
| 10 | Image and voice evidence processed, stored privately, served via signed links | PASS |
| 11 | Status lookup returns only status and never complaint details | PASS |
| 12 | Public follow-up is rate-limited, audited, and attached to the case | PASS |
| 13 | Staff endpoints reject unauthenticated requests | PASS |
| 14 | Staff login requires TOTP and session cookies are HttpOnly | PASS |
| 15 | Case list, filters, and summary available to staff | PASS |
| 16 | Complaint detail exposes contact and evidence only to staff | PASS |
| 17 | State-changing staff requests require a valid CSRF token | PASS |
| 18 | Case completion, reopening, notes, spam, assignment are audited | PASS |
| 19 | Signed attachment URLs work; tampered links rejected | PASS |
| 20 | Signed attachment access is audit logged | PASS |
| 21 | Statistics and monthly report endpoints return aggregates and PDF | PASS |
| 22 | Owner can create staff; case team cannot list staff | PASS |
| 23 | Email outbox is owner-only; development delivery is logged | PASS |
| 24 | Audit log records authentication and privileged actions | PASS |
| 25 | CAPTCHA rejects invalid tokens and accepts valid provider responses | PASS |
| 26 | Institute lookup rate limiting returns 429 | PASS |
| 27 | Retention expiry deletes case data, leaves only deletion record | PASS |
| 28 | Origin checks reject state-changing requests from untrusted origins | PASS |
| 29 | Logout revokes session and clears cookies | PASS |
| 30 | Owner password reset revokes case-team sessions and clears 2FA | PASS |
| 31 | Old attachments and case data count consistently after tests | PASS |

## 2. Deployment smoke test

Command:

```bash
SMOKE_BASE_URL=http://localhost:4000 npm --workspace server run test:smoke
```

| Check | Result |
| --- | --- |
| Health endpoint reports connected database | PASS |
| Public config returns languages and no secrets | PASS |
| Unknown institute codes rejected | PASS |
| Staff endpoints require authentication | PASS |

**4 / 4 passed.**

## 3. API end-to-end tests (real HTTP)

The suite ran against the real Express server and a dedicated Atlas test database (`Apethexhelpportal_e2e5`), using real multipart uploads, cookies, TOTP, CSRF, and signed URLs. No mocks were used for the HTTP layer.

| # | Flow | Result |
| --- | --- | --- |
| 1 | Public config loads | PASS |
| 2 | Institute code validates | PASS |
| 3 | Unknown institute rejected (404) | PASS |
| 4 | Identified complaint + image accepted (201) | PASS |
| 5 | Reference ID format validated | PASS |
| 6 | Anonymous complaint accepted without identity (201) | PASS |
| 7 | Anonymous mode rejects identity fields (400) | PASS |
| 8 | Short description rejected (400) with friendly field messages | PASS |
| 9 | Status lookup returns only `In Process` | PASS |
| 10 | Public follow-up accepted (201) | PASS |
| 11 | Staff list rejects unauthenticated request (401) | PASS |
| 12 | Owner first login enrols TOTP and starts session | PASS |
| 13 | Session `/me` works with cookie + CSRF | PASS |
| 14 | State change without CSRF rejected (403) | PASS |
| 15 | Case desk list loads submissions | PASS |
| 16 | Case detail exposes contact to staff | PASS |
| 17 | Case detail shows reporter follow-up event | PASS |
| 18 | Evidence attached to case | PASS |
| 19 | Signed evidence URL issued | PASS |
| 20 | Signed evidence downloads (338-byte image) | PASS |
| 21 | Tampered signature rejected (404) | PASS |
| 22 | Staff case note saved | PASS |
| 23 | Stats overview loads | PASS |
| 24 | Monthly report JSON loads | PASS |
| 25 | Monthly PDF generates (`%PDF`, 1,927 bytes) | PASS |
| 26 | Audit log lists privileged actions (12 events) | PASS |
| 27 | Email outbox visible to owner (3 emails) | PASS |
| 28 | Case completion works | PASS |
| 29 | Completed case publicly shows `Completed` | PASS |
| 30 | Logout revokes session; subsequent `/me` returns 401 | PASS |

**30 / 30 passed.** Final reference IDs: `APX-2611-2WB8UB` (identified), `APX-2611-VRRR2F` (anonymous).

## 4. Browser UI end-to-end tests

Command: Playwright + Firefox, viewport 1440×1000 then 390×844.

| # | User journey | Result |
| --- | --- | --- |
| 1 | Home page renders with correct title | PASS |
| 2 | Institute code validates and shows verified institute | PASS |
| 3 | Category selection reaches the details step | PASS |
| 4 | Details form reaches review screen with 1 attached image | PASS |
| 5 | Public submission completes and shows a valid reference ID | PASS |
| 6 | Public status lookup shows `In Process` | PASS |
| 7 | First staff login requires 2FA enrolment | PASS |
| 8 | TOTP setup opens the Case Desk and lists the new case | PASS |
| 9 | Case detail shows reporter contact and image evidence | PASS |
| 10 | Internal note saves from the UI | PASS |
| 11 | Case completion works from the UI | PASS |
| 12 | Completed status appears publicly | PASS |
| 13 | Mobile layout has no horizontal overflow (0 px at 390 px) | PASS |
| 14 | No uncaught browser page errors | PASS |
| 15 | No browser console errors | PASS |

**15 / 15 passed.** Final UI reference: `APX-2611-84FJCH`.

## 5. Security verification

| Control | Verification | Result |
| --- | --- | --- |
| Anonymous identity separation | Integration + API E2E: no Contact document; identity fields rejected | PASS |
| Evidence privacy | Private storage; signed URL works; tampered signature rejected; expiry enforced in code (not waited out) | PASS |
| Staff authentication | TOTP required; setup flow tested; session cookies HttpOnly | PASS |
| Session revocation | Logout, password reset, owner revocation all tested | PASS |
| CSRF | Mutations without token return 403 | PASS |
| Origin checks | Untrusted origin rejected in integration test | PASS |
| Rate limits | Institute/status/follow-up/submission/login limits exercised | PASS |
| Audit logging | Login, logout, list/detail views, evidence access, completion, notes, staff changes | PASS |
| Retention deletion | Expired case data deleted; deletion record retained | PASS |
| Production guard | Server refuses production with dev secrets, dev CAPTCHA, auto-seed, local storage, or non-HTTPS URL | PASS |
| Secret scan | No Atlas URI/password or provider keys in client build or server source; documented dev placeholder defaults only | PASS |
| Dependency vulnerabilities | `npm audit`: 0 low/moderate/high/critical | PASS |

### Security headers observed

All public and staff pages returned:

- `Content-Security-Policy` with `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, and Turnstile-only frame/script allowances.
- `Strict-Transport-Security: max-age=15552000; includeSubDomains; preload`.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: no-referrer`.
- `Permissions-Policy` limiting camera, geolocation, microphone, and payment.
- `X-Robots-Tag: noindex, nofollow, noarchive` on `/staff/*` and `/desk/*`.

### Production guard output

With `NODE_ENV=production` and development values, startup correctly failed for:

- Weak session secret and TOTP key.
- Missing Resend and Turnstile keys.
- CAPTCHA bypass enabled.
- Auto-seed enabled.
- Local storage driver.
- Non-HTTPS `APP_BASE_URL`.

## 6. Build and static verification

```bash
npm --workspace client-next run build
```

Result: **PASS**. Routes generated:

`/`, `/category`, `/details`, `/thanks`, `/status`, `/staff/login`, `/desk`, `/desk/complaint/[ref]`, `/desk/stats`, `/desk/staff`, `/desk/audit`, `/desk/email`, plus not-found.

- TypeScript check passed.
- All public and staff routes generated.
- No client bundle references to Atlas credentials or provider secrets.

## 7. Test data and cleanup

Integration tests use an in-memory database and a temporary storage directory, so they leave no Atlas data.

Manual E2E used isolated databases:

- `Apethexhelpportal_e2e`
- `Apethexhelpportal_e2e2`
- `Apethexhelpportal_e2e3`
- `Apethexhelpportal_e2e4`
- `Apethexhelpportal_e2e5`

These are separate from the configured portal database and from the management `Apthexx` database. They contain synthetic test cases and can be dropped after review. The development database may also contain older synthetic data; confirm before launch.

No production credentials were printed during testing.

## 8. Unresolved issues and limitations

| Item | Severity | Status / owner action |
| --- | --- | --- |
| Production hosting, domain, TLS, and reverse proxy not provisioned | High | Owner decision required. Portal was tested on port 3001 to avoid disturbing the marketing site on port 3000. |
| Real Resend delivery not tested (no API key/sender domain) | High | Development outbox/log path tested. Configure Resend and verify a real inbox before launch. |
| Live Cloudflare Turnstile not tested (no production keys) | High | Verification behavior tested with mocked provider responses; production keys and a live challenge are still required. |
| Vercel Blob private storage not tested (local storage used) | High | Local signed-URL path is fully tested. Verify Vercel Blob private put/get/del, token hygiene, and proxy download in staging. |
| Retention/escalation values are placeholders | High | `RETENTION_DAYS` and `ESCALATION_DAYS` require owner/legal approval. Recommended production values: 180-day retention and 7-day escalation. |
| Manual screen-reader / WCAG audit not performed | Medium | Responsive layout and semantic markup verified; commission a manual accessibility audit before launch. |
| Voice recording through a real microphone not exercised in headless Firefox | Medium | Backend voice processing is covered by integration tests; test microphone capture on target mobile devices. |
| Anonymous browser flow not separately exercised | Low | Anonymous submission/rejection and identity separation are covered by backend and API E2E tests; the public anonymous UI path should still be spot-checked on target devices. |
| No load, soak, or penetration test | Medium | Run before public launch, especially against submission, status lookup, and login endpoints. |
| CSP allows `'unsafe-inline'` for scripts/styles | Medium | Required by the current Next.js inline runtime. Consider nonce-based CSP if the deployment model permits. |
| `TRUST_PROXY` must match the deployment topology | Medium | Set to the number of trusted proxy hops; use `0` if the API is directly exposed, otherwise IP rate limits can be spoofed. |
| Legacy Vite `client/` remains in the folder | Low | Not a workspace and not used. Delete after owner confirms no one depends on it. |
| Development owner credentials and demo institutes present | High if deployed | Never deploy with `owner@apthex.local` / `ChangeMe!123` or `SCHOOL01`/`COLLEGE01`; replace with approved records. |
| Marketing site and portal share port 3000 in local defaults | Low | Run the portal on 3001 locally or put both behind a reverse proxy with distinct hostnames. |
| No real retention or signed-URL expiry wait executed | Low | Deletion logic was tested with expired fixtures; the 30-day scheduler and 300-second signed-URL TTL were not waited out in real time. |

## 9. Reproducibility

```bash
cd complaint-portal
npm install
npm --workspace server test
npm --workspace client-next run build

# With the API running:
SMOKE_BASE_URL=http://localhost:4000 npm --workspace server run test:smoke
```

The browser and API E2E harnesses used during this review are external test scripts; the repository's permanent automated suite is `server/tests/api.test.js` (31 tests) plus `server/scripts/smoke.js`.
