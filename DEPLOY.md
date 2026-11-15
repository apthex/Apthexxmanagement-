# APTHEX site — deploy notes

## Why git-push deployments get blocked on Vercel

Every `git push` to `main` triggers a Vercel deployment that ends in **BLOCKED**:

```
The deployment was blocked because the commit author doesn't have
permission to create deployments for this project.   (TEAM_ACCESS_REQUIRED)
```

Root cause:

- The Vercel team **apthex** is on the **Hobby plan**. Hobby teams allow **no
  members** (API error: `invites_not_allowed`) — only the team owner
  (`apthexx-4811`, apthexx@gmail.com) has a seat.
- Git deployments are attributed to the **commit author's** Vercel account.
  Commits are authored by GitHub `5hu6h4m`, which is linked to Vercel account
  `shubhamja9863-5554` — that account is **not** on the team and cannot be
  added on Hobby.
- Manual/API/CLI deployments created **by the team owner** are never blocked.

## How deploys actually ship (current, free)

Run from the repo root:

```bash
./deploy.sh
```

It copies the working tree to a temp dir **without `.git`** and deploys it as
the team owner (`apthexx-4811`), so attribution never blocks. Deploys the
static main site (project `apethex` → www.apthex.com).

The portal client has a matching flow:

```bash
cd complaint-portal/client-next
rsync -a --exclude node_modules ./ /tmp/portal-stage/
cd /tmp/portal-stage
npx vercel link --yes --project apthex-complaint --scope apthex   # once
npx vercel deploy --prod --yes
```

## Permanent fixes (pick one)

1. **Upgrade the apthex team to Pro** (~$20/mo), then invite
   `shubhamja9863-5554` at vercel.com/apthex/~/settings/members. Git pushes
   deploy automatically again.
2. **Push from the owner's GitHub account** (the GitHub account linked to
   `apthexx-4811`) — commits it authors are attributed to the owner.
3. **GitHub Action + owner token**: create a long-lived token at
   vercel.com/account/settings/tokens, add it as the repo secret
   `VERCEL_TOKEN`, and run `npx vercel deploy --prod --yes --token=$VERCEL_TOKEN`
   on push. Deploys are then attributed to the owner, never blocked.

## Production topology (current)

| Piece | Where |
| --- | --- |
| Marketing site + careers | Vercel project `apethex` (static, repo root) — www.apthex.com |
| Complaint portal frontend | Vercel project `apthex-complaint` (Next.js, `complaint-portal/client-next`) — apthex-complaint.vercel.app |
| Main-site routing | `vercel.json` rewrites proxy `/complaint` `/admin` `/desk` `/status` `/category` `/details` `/thanks` `/staff/*` `/api/*` `/_next/*` to the portal |
| Complaint API (Express) | **not hosted yet** — plan says AWS Lightsail Mumbai; needs `MONGODB_URI`, Resend, Turnstile, session secrets |
| Evidence storage | MongoDB (Attachment.data), per commit `286ca6f` |

## Pending production inputs (owner)

- `MONGODB_URI` for `cluster0.ye8dpbm.mongodb.net` (Atlas → Connect → Drivers)
- Resend domain `mail.apthex.com` + API key, Turnstile site/secret keys
- `SESSION_SECRET`, `TOTP_ENCRYPTION_KEY` (each: `openssl rand -base64 48`)
- Backend hosting (Lightsail) or a decision to run the API on Vercel functions
- Real institute CSV (replaces SCHOOL01/COLLEGE01 seeds)
