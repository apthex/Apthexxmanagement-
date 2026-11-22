#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# APTHEX apt-root.apthex.com deploy script.
# Deploys the internal Next.js operations portal & LiveWeb Analytics to Vercel.
#
# USAGE:
#   ./deploy-apt-root.sh
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v npx >/dev/null 2>&1; then echo "node/npx required" >&2; exit 1; fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Copy Next.js portal application files, excluding static marketing site files
rsync -a \
  --exclude '.git' \
  --exclude '.vercel' \
  --exclude '*.log' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'complaint-portal' \
  --exclude 'nextjs-site' \
  --exclude 'design' \
  --exclude 'team' \
  --exclude 'partners' \
  --exclude 'vercel.json' \
  --exclude 'index.html' \
  --exclude 'careers.html' \
  ./ "$STAGE"/

mkdir -p "$STAGE/.vercel"
echo '{"projectId":"prj_IgXDVl5c0QD9SZg3gAR3G2RZMrZw","orgId":"team_6wBVEhEaAdIQh9Zm6hr6pa0N","projectName":"apt-root"}' > "$STAGE/.vercel/project.json"

ARGS=(deploy --prod --yes)
[ -n "${VERCEL_TOKEN:-}" ] && ARGS+=(--token="$VERCEL_TOKEN")

echo "→ deploying apt-root to production (project: apt-root)…"
( cd "$STAGE" && npx --yes vercel@latest "${ARGS[@]}" )
echo "✓ live: https://apt-root.apthex.com"
