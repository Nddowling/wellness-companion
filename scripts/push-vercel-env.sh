#!/usr/bin/env bash
# Pushes env vars from .env.local to the Vercel project "clearbedrecovery".
# Requires an authenticated Vercel CLI (run `vercel login` first).
set -euo pipefail

PROJECT="clearbedrecovery"
TEAM="nicks-projects-0994fdbd"
ENV_FILE=".env.local"
ENVIRONMENTS=(production preview development)

# Vars to push. NEXT_PUBLIC_SITE_URL is overridden below for production.
VARS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  ANTHROPIC_API_KEY
  NEXT_PUBLIC_SITE_URL
)

PROD_SITE_URL="https://clearbedrecovery-nicks-projects-0994fdbd.vercel.app"

cd "$(dirname "$0")/.."

# Link the local dir to the Vercel project (no-op if already linked).
vercel link --yes --project "$PROJECT" --scope "$TEAM"

get_val() {
  # Extract RHS of `KEY=value` from .env.local, trimming optional quotes.
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
}

for VAR in "${VARS[@]}"; do
  for ENV in "${ENVIRONMENTS[@]}"; do
    if [[ "$VAR" == "NEXT_PUBLIC_SITE_URL" && "$ENV" == "production" ]]; then
      VALUE="$PROD_SITE_URL"
    else
      VALUE="$(get_val "$VAR")"
    fi
    if [[ -z "$VALUE" ]]; then
      echo "skip  $VAR ($ENV) — empty in $ENV_FILE"
      continue
    fi
    # Remove any existing value first so this is idempotent.
    vercel env rm "$VAR" "$ENV" --yes >/dev/null 2>&1 || true
    printf '%s' "$VALUE" | vercel env add "$VAR" "$ENV" >/dev/null
    echo "set   $VAR ($ENV)"
  done
done

echo "Done. Redeploy with: vercel --prod"
