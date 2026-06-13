#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "ClearBedRecovery Excel → Supabase import"
echo "Project URL is already set in the script:"
echo "https://uxykrvungmfzmpzrvebh.supabase.co"
echo

echo "Installing needed Node packages..."
npm install @supabase/supabase-js xlsx

if [ ! -f "./clearbed_recovery_samhsa_2025_enriched.xlsx" ]; then
  echo "ERROR: Missing ./clearbed_recovery_samhsa_2025_enriched.xlsx"
  echo "Re-unzip the package into this folder."
  exit 1
fi

if [ ! -f "./clearbed_import_samhsa_excel.mjs" ]; then
  echo "ERROR: Missing ./clearbed_import_samhsa_excel.mjs"
  echo "Re-unzip the package into this folder."
  exit 1
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo
  echo "Paste the ClearBed Supabase service_role key."
  echo "Terminal hides your typing/paste. That is normal."
  echo "Use the service_role key, not the publishable key and not anon."
  read -rsp "Service role key: " SUPABASE_SERVICE_ROLE_KEY
  echo
  export SUPABASE_SERVICE_ROLE_KEY
fi

node ./clearbed_import_samhsa_excel.mjs ./clearbed_recovery_samhsa_2025_enriched.xlsx
