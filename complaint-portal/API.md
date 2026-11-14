# APTHEX Complaint Portal — API Reference

Base URL in development: `http://localhost:4000`. In production, the Next.js frontend proxies `/api/*` to the API, so browser clients use the same origin as the portal.

All request and response bodies are JSON unless stated otherwise. Errors use:

```json
{ "error": "Human-readable message", "fields": { "field_name": "Specific message" } }
```

`fields` is present for validation failures. All API responses are sent with `Cache-Control: no-store`.

## Authentication model

Staff endpoints use two cookies:

| Cookie | Purpose | HttpOnly |
| --- | --- | --- |
| `apthex_session` | Opaque server-side session token | Yes |
| `apthex_csrf` | CSRF token, also returned in the login response | No |

Every state-changing staff request (`POST`, `PATCH`, `DELETE`) must send the CSRF token in the `X-CSRF-Token` header. The token must match both the cookie and the server-side session record.

Sessions are revocable, expire after `SESSION_TTL_HOURS` (default 8), and are invalidated by password resets, account deactivation, or explicit revocation.

Roles:

- `owner` — full access, including staff management, audit log, email outbox, and report sending.
- `case_team` — case work only. Administrative endpoints return `404` to avoid confirming their existence.

## Public endpoints

### `GET /api/health`

Liveness/database check. No authentication.

```json
{ "ok": true, "database": "connected", "time": "2026-11-05T12:00:00.000Z" }
```

### `GET /api/config`

Public runtime configuration. Never contains secrets.

```json
{
  "environment": "development",
  "languages": ["en", "hi", "mr"],
  "captcha": { "configured": false, "siteKey": null, "required": false, "devBypass": true },
  "retentionNotice": "Completed case data is deleted after the approved retention period.",
  "emergency": { "police": "112", "cybercrimeHelpline": "1930" }
}
```

### `GET /api/institutes/validate?code=SCHOOL01`

Validates an active institute code. Rate limited per IP.

```json
{ "code": "SCHOOL01", "name": "Demo Public School", "type": "school" }
```

Errors: `400` malformed code, `404` unknown/inactive code, `429` rate limited.

### `POST /api/complaints`

Submit a complaint. `multipart/form-data`.

| Field | Required | Notes |
| --- | --- | --- |
| `institute_code` | Yes | Validated active code |
| `category` | Yes unless urgent | One of the published categories |
| `details_text` | Yes | 10–5000 characters, stored and rendered as plain text |
| `mode` | Yes | `identified` or `anonymous` |
| `urgent` | No | `true` routes to the urgent workflow |
| `captchaToken` | When CAPTCHA is configured | Turnstile token |
| `deviceId` | Recommended | Random client-generated identifier used for abuse limits |
| `name`, `class_label`, `roll_no`, `mobile`, `email` | Identified mode | Identity fields; rejected in anonymous mode |
| `contact` | Alternative to flat fields | JSON object with the same identity fields |
| `images` | No | Up to `MAX_IMAGES`, JPEG/PNG/WebP/GIF |
| `voice` | No | One audio file, maximum `MAX_VOICE_SECONDS` |

Example:

```bash
curl -X POST http://localhost:4000/api/complaints \
  -F institute_code=SCHOOL01 \
  -F category="Online Harassment or Bullying" \
  -F details_text="A student is being harassed in a group chat after school." \
  -F mode=identified \
  -F name="Example Reporter" \
  -F class_label="10-A" \
  -F mobile="+919876543210" \
  -F email="reporter@example.com" \
  -F deviceId="device-abc123" \
  -F images=@evidence.png
```

Success `201`:

```json
{
  "ref_id": "APX-2611-ABC234",
  "message": "Complaint submitted successfully",
  "acknowledgement_email": true,
  "attachments": 1
}
```

Errors: `400` validation/CAPTCHA, `409` duplicate within the duplicate window, `413` uploads too large, `429` rate limited.

**Anonymous mode:** any non-empty identity field, or a `contact` object, causes `400`. No contact document is created and no reporter email is sent or stored.

### `POST /api/status/lookup`

Looks up only the public status. No complaint content is returned.

```json
{ "ref_id": "APX-2611-ABC234" }
```

```json
{ "status": "In Process" }
```

Completed cases return `{ "status": "Completed" }`. Cases deleted under retention return:

```json
{
  "status": "Completed",
  "data_deleted": true,
  "message": "This case is completed and its complaint data has been deleted ..."
}
```

Errors: `404` not found/malformed, `429` rate limited.

### `POST /api/status/followup`

Add a public follow-up message to the case timeline. Rate limited per IP, per reference, and per device; CAPTCHA applies when configured.

```json
{
  "ref_id": "APX-2611-ABC234",
  "text": "I have additional information about this report.",
  "captchaToken": "",
  "deviceId": "device-abc123"
}
```

Success `201`: `{ "ok": true, "message": "Follow-up submitted to the APTHEX case team." }`

Errors: `400`, `404`, `410` case data deleted, `429`.

### `GET /api/attachments/download/:id?expires=...&signature=...`

Signed download endpoint for local and Vercel Blob private storage. The URL is issued by the staff endpoint above. For Vercel Blob, the server proxies the private blob content (token never exposed to the client). Invalid or expired signatures return `404`.

## Staff authentication

### `POST /api/auth/login`

```json
{ "email": "owner@example.org", "password": "...", "code": "123456" }
```

First login (no TOTP yet) returns setup material:

```json
{
  "setupRequired": true,
  "setupToken": "one-time-token",
  "secret": "BASE32SECRET",
  "otpauthUrl": "otpauth://totp/...",
  "member": { "name": "APTHEX Owner", "email": "owner@example.org" },
  "message": "Set up an authenticator app before accessing the Case Desk."
}
```

Subsequent logins require `code` and return `{ "ok": true, "member": {...}, "csrfToken": "..." }` with both cookies set.

Errors: `400` missing code, `401` bad credentials/code, `429` rate limited or temporarily locked.

### `POST /api/auth/setup-2fa`

```json
{ "email": "owner@example.org", "setupToken": "...", "code": "123456" }
```

Enables TOTP, starts a session, and returns `{ "ok": true, "member": {...}, "csrfToken": "..." }`.

### `GET /api/auth/me`

Returns the current member, a fresh/current CSRF token, and session expiry. Requires authentication.

### `POST /api/auth/logout`

Revokes the current session and clears cookies. Requires CSRF.

### `GET /api/auth/sessions`

Lists the member's active sessions with `current: true|false`.

### `POST /api/auth/sessions/:id/revoke` and `POST /api/auth/sessions/revoke-others`

Revoke one session or every other session. Require CSRF.

## Staff case endpoints

All require authentication and return `401` without a valid session.

### `GET /api/complaints`

Query parameters: `page` (default 1), `limit` (default 25, max 100), `institute_code`, `category`, `status` (`in_process`/`completed`), `urgent=true`, `spam=false|true|all`, `search` (reference prefix or exact reference).

```json
{
  "items": [
    {
      "ref_id": "APX-2611-ABC234",
      "institute_code": "SCHOOL01",
      "category": "Online Harassment or Bullying",
      "urgent": false,
      "mode": "identified",
      "status": "in_process",
      "flagged_spam": false,
      "assigned_to": null,
      "created_at": "2026-11-05T12:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 25,
  "total": 1,
  "summary": { "total": 1, "urgent": 0, "in_process": 1, "completed": 0 }
}
```

### `GET /api/complaints/:ref_id`

Returns `complaint`, `contact` (or `null` for anonymous), `contacts`, `attachments`, and `events`. Evidence metadata only; file bytes require a signed URL.

### `PATCH /api/complaints/:ref_id`

Requires CSRF. Body may contain any combination of:

```json
{
  "completed": true,
  "flagged_spam": false,
  "assigned_to": "24-character-member-id-or-null",
  "note": "Internal note, never evidence contents."
}
```

Completing a case sets `delete_after` from `RETENTION_DAYS`. Reopening clears it. Returns `{ "ok": true }`.

### `GET /api/attachments/:id/url`

Issues a short-lived signed URL for private evidence and writes an audit event.

```json
{ "url": "/api/attachments/download/...?...signature=...", "expires": 1762345678 }
```

## Staff administration (owner only)

These endpoints return `404` for `case_team` members.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/staff/members` | List staff accounts |
| `POST` | `/api/staff/members` | Create a staff account (`name`, `email`, `password`, `role`) |
| `PATCH` | `/api/staff/members/:id` | Change name, role, or status |
| `POST` | `/api/staff/members/:id/reset-password` | Reset password, clear 2FA, revoke sessions |
| `POST` | `/api/staff/members/:id/revoke-sessions` | Revoke all sessions for a member |
| `GET` | `/api/staff/audit` | Audit events; filters `action`, `entity`, `outcome`, `page`, `limit` |
| `GET` | `/api/staff/outbox` | Email outbox; filters `status`, `kind`, `page`, `limit` |
| `POST` | `/api/staff/outbox/process` | Process queued email immediately |

`GET /api/staff/assignable` is available to all authenticated staff and returns active members for assignment.

The system prevents deactivating your own account and prevents removing the last active owner.

## Statistics and reports

All require authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/stats/overview` | Summary counts and recent cases |
| `GET` | `/api/stats/institutes` | Active institutes plus institutes seen in complaints |
| `GET` | `/api/stats/institute/:code` | Totals and monthly rows for one institute |
| `GET` | `/api/stats/monthly` | Monthly aggregate rows; optional `institute_code` |
| `GET` | `/api/reports/preview?institute_code=SCHOOL01&month=2026-11` | Inline monthly PDF |
| `GET` | `/api/reports/data?institute_code=SCHOOL01&month=2026-11` | Report data as JSON |
| `POST` | `/api/reports/send` | Owner only; queue a monthly report email |

`POST /api/reports/send` body:

```json
{ "institute_code": "SCHOOL01", "month": "2026-11", "force": false }
```

Statistics exclude spam-flagged cases. Small-number suppression is controlled by `SMALL_NUMBER_THRESHOLD`.

## Status codes

| Code | Meaning |
| --- | --- |
| `200` | Success |
| `201` | Created (complaint, follow-up, staff account) |
| `400` | Validation, CAPTCHA, or bad state change |
| `401` | Authentication required or invalid credentials |
| `403` | CSRF/origin failure |
| `404` | Not found, invalid signature, or hidden administrative route |
| `409` | Duplicate complaint or duplicate staff email |
| `410` | Case data deleted under retention |
| `413` | Upload too large |
| `429` | Rate limited / account temporarily locked |

## Security notes for API clients

- Never cache authenticated responses or evidence.
- Never place reference IDs, evidence URLs, or session tokens in logs or analytics.
- Always send the CSRF header for staff mutations.
- Use HTTPS in production; cookies become `Secure` when `NODE_ENV=production`.
- Public status deliberately reveals only `In Process` or `Completed`.
- Do not attempt to infer identity from anonymous reports; none is stored.
