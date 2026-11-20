#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# APTHEX main site deploy — publishes the current working tree to production.
#
# WHY THIS SCRIPT EXISTS
#   Vercel blocks git-push deployments ("commit author doesn't have permission
#   to create deployments") because the apthex team is on the Hobby plan and
#   the commit author's Vercel account is not the team owner. Manual deploys
#   created by the team owner work fine.
#
#   This script deploys the CURRENT TREE as the team owner, without the git
#   commit context, so it is never blocked.
#
# USAGE
#   ./deploy.sh          # deploy the main site (repo root, static)
#
# Requires: Vercel CLI logged in on this machine (vercel whoami → apthexx-4811),
#   or set VERCEL_TOKEN env var to a dashboard token.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v npx >/dev/null 2>&1; then echo "node/npx required" >&2; exit 1; fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Copy only the static site files (excluding node_modules, build caches, and
# internal portal Next.js files so Vercel serves index.html directly).
rsync -a \
  --exclude '.git' \
  --exclude '.vercel' \
  --exclude '*.log' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'public' \
  --exclude 'src' \
  --exclude 'package.json' \
  --exclude 'package-lock.json' \
  --exclude 'next.config.*' \
  --exclude 'nextjs-site' \
  --exclude 'complaint-portal' \
  ./ "$STAGE"/
cp -f .vercel/project.json "$STAGE/.vercel-project.json" 2>/dev/null || true
mkdir -p "$STAGE/.vercel" && mv "$STAGE/.vercel-project.json" "$STAGE/.vercel/project.json" 2>/dev/null || true

ARGS=(deploy --prod --yes)
[ -n "${VERCEL_TOKEN:-}" ] && ARGS+=(--token="$VERCEL_TOKEN")

echo "→ deploying main site to production (project: apethex)…"
( cd "$STAGE" && npx --yes vercel@latest "${ARGS[@]}" )
echo "✓ live: https://www.apthex.com"
