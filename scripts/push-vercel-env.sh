#!/usr/bin/env bash
# Push variables from .env.production.local to Vercel (production scope).
# Requires: vercel CLI installed and authenticated (`npm i -g vercel && vercel login`).
# Usage: ./scripts/push-vercel-env.sh [production|preview|development]
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production.local}"
SCOPE="${1:-production}"

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI not found. Install with: npm i -g vercel" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

# Skip comments, blanks, and commented-out (disabled) lines.
while IFS= read -r line || [[ -n "$line" ]]; do
  # trim leading/trailing whitespace
  trimmed="${line#"${line%%[![:space:]]*}"}"
  trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
  [[ -z "$trimmed" ]] && continue
  [[ "$trimmed" == \#* ]] && continue
  # key=value (value may contain spaces if quoted)
  key="${trimmed%%=*}"
  value="${trimmed#*=}"
  # strip surrounding quotes from value
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  [[ -z "$key" ]] && continue
  echo "Setting $key ($SCOPE)..."
  printf '%s' "$value" | vercel env add "$key" "$SCOPE" --force >/dev/null 2>&1 || \
    printf '%s' "$value" | vercel env add "$key" "$SCOPE"
done < "$ENV_FILE"

echo "Done. Verify with: vercel env ls $SCOPE"
