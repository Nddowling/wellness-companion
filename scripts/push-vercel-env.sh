#!/usr/bin/env bash
# Pushes env vars from .env.local to the Vercel project "clearbedrecovery".
# Requires an authenticated, ALREADY-LINKED Vercel project (.vercel/project.json).
#
# SAFETY: never runs `vercel link` or `vercel env pull` (those overwrite
# .env.local). Backs up .env.local first and restores it if anything mutates it.
set -euo pipefail

ENV_FILE=".env.local"
ENVIRONMENTS=(production preview development)

VARS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  ANTHROPIC_API_KEY
  NEXT_PUBLIC_SITE_URL
  HANDOFF_BAA_SIGNED
  HANDOFF_MODE
  EMAIL_FROM
  RESEND_API_KEY
  CRON_SECRET
)

PROD_SITE_URL="https://clearbedrecovery-nicks-projects-0994fdbd.vercel.app"

cd "$(dirname "$0")/.."

if [[ ! -f .vercel/project.json ]]; then
  echo "ERROR: project not linked (.vercel/project.json missing). Link manually first." >&2
  exit 1
fi

# Refuse to run if placeholders are still present.
if grep -q '<PASTE' "$ENV_FILE"; then
  echo "ERROR: $ENV_FILE still has <PASTE ...> placeholders. Fill them in first." >&2
  exit 1
fi

# Back up so any accidental mutation is recoverable.
BACKUP="${ENV_FILE}.backup-before-push"
cp "$ENV_FILE" "$BACKUP"
echo "Backed up $ENV_FILE -> $BACKUP"

get_val() {
  grep -E "^$1=" "$BACKUP" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
}

for VAR in "${VARS[@]}"; do
  for ENV in "${ENVIRONMENTS[@]}"; do
    if [[ "$VAR" == "NEXT_PUBLIC_SITE_URL" && "$ENV" == "production" ]]; then
      VALUE="$PROD_SITE_URL"
    else
      VALUE="$(get_val "$VAR")"
    fi
    if [[ -z "$VALUE" ]]; then
      echo "skip  $VAR ($ENV) — empty"
      continue
    fi
    vercel env rm "$VAR" "$ENV" --yes >/dev/null 2>&1 || true
    printf '%s' "$VALUE" | vercel env add "$VAR" "$ENV" >/dev/null
    echo "set   $VAR ($ENV)"
  done
done

# Restore in case any vercel call rewrote .env.local.
if ! cmp -s "$BACKUP" "$ENV_FILE"; then
  echo "NOTE: $ENV_FILE changed during push — restoring from backup."
  cp "$BACKUP" "$ENV_FILE"
fi
echo "Done. Redeploy with: vercel --prod"
