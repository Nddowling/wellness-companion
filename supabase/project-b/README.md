# Project B — "Vault" (PHI) — DO NOT APPLY AT BETA

This directory holds the **authored-but-dormant** schema for seeker identity and
insurance detail. It exists so the compliance seam is designed and reviewable
from day one — **not** so it can be turned on.

## 🔴 Hard preconditions before a single real PHI record lands here

All of these must be true first:

1. **Supabase Team plan** (~$599/mo) on a **separate** project from Project A.
2. **Signed BAA** with Supabase + HIPAA add-on enabled.
3. **Completed security risk assessment.**
4. **Healthcare-attorney sign-off** covering **HIPAA + 42 CFR Part 2** (substance-use
   records carry extra protection) **+ EKRA** (keep pricing flat-subscription, never
   per-referral).

Trigger to begin: design-partner facilities are actively testing **and** revenue is real.

## What stays true regardless

- Project A (`matches`) is and remains **de-identified**. The ONLY join between a
  real person and a `match_id` is `seeker_match_link` in this project, and it is
  **only ever resolved server-side** — never exposed to any client.
- At beta, seeker PHI is collected client-side and forwarded straight to the matched
  facility (`/api/handoff`) and **persisted nowhere on our side**. See the build plan.
- `src/lib/supabase/vault.ts` throws if called, and a CI guard asserts nothing under
  `src/app` imports it.

## Files

- `migrations/01_vault.sql` — `seekers`, `seeker_insurance`, `seeker_match_link`.
  **Reviewed, not applied.** Apply only after the preconditions above are met, against
  the dedicated Team-plan project.
