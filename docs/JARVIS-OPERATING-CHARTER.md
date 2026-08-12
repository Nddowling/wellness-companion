# Clear Bed Recovery — Operating Charter (Jarvis)

**Owner:** Nick (Nddowling) · **Operator:** Jarvis (AI) · **Granted:** 2026-08-12

Nick granted full autonomy to **optimize, market, develop, and publish** Clear Bed
Recovery (`clearbedrecovery.com`). This charter records the mandate, the hard limits,
and a changelog so any future session (and Nick) can see the state of play.

## 🚫 Hard red lines (never cross without an explicit, in-person OK from Nick)
1. **No payments.** Do not take, enable, or collect any payment. Billing stays OFF
   (`NEXT_PUBLIC_BILLING_ENABLED` unset/false). The Stripe plumbing stays intact but
   dormant. Re-enabling requires Nick's go-ahead in conversation.
2. **No PII / PHI storage — ever.** The site must not store any seeker/patient personal
   or health data. Enforced three ways: (a) prod has no Vault project wired, (b)
   `HANDOFF_BAA_SIGNED` gate, (c) a hard code lock `PII_VAULT_HARD_LOCK = true` in
   `src/lib/supabase/vault.ts`. Facility/provider **business** contacts (from public
   SAMHSA data + web enrichment) are B2B and allowed — they are not patient PII.

## Self-imposed guardrails (even under full autonomy)
- Never spend money or sign Nick up for paid services without asking.
- Nothing outward-facing sends from Nick's identity (cold email, public posts) until
  the sending infra + Nick's business mailing address (CAN-SPAM) are in place and Nick
  has said "send."
- Stage + verify before any production deploy; keep prod deploys clean (never bundle
  unrelated half-finished WIP).
- Marketing stays EKRA-safe (no per-referral / per-lead / per-admission language) and
  compliant (addiction-treatment ToS, LegitScript for any paid ads — organic only for now).
- Log every material change in the changelog below and report to Nick.

## Status snapshot (2026-08-12)
- Live on Vercel (`clearbedrecovery`), Next.js 16 / Supabase / Stripe (dormant).
- 13,501 facilities nationwide; 422 in Georgia (beachhead). Directory + de-identified
  matcher work; ~0 real traffic, 0 revenue, 0 stored PII.
- Billing flipped to free-for-everyone (reversible flag). PII vault hard-locked.

## Changelog
- **2026-08-12** — Charter created. Made billing free-for-everyone behind
  `NEXT_PUBLIC_BILLING_ENABLED` (default off): `effectivePlan` returns top tier,
  upgrade CTAs hidden, `/api/checkout` closed, `/pricing` shows founding-member banner.
  Added `PII_VAULT_HARD_LOCK` in `vault.ts`. Verified prod stores zero seeker PII.
  Built GA target list + founding-facility outreach kit (in owner workspace).
  NOT deployed yet (owner WIP tree needs review first).

## Business NAP (received 2026-08-12)
- **Clear Bed Recovery · 122 Franklins Walk, Rincon, GA 31326 · (904) 548-8047**
- Phone already hardcoded in `src/lib/seo.ts` (matches). By design the **street stays private** —
  schema exposes phone + US service area only, NO PostalAddress. Street is used for private GBP
  verification + the CAN-SPAM email footer only.
- OPEN: recommend a PO box / UPS Store address for the email footer so the home address isn't
  exposed to ~400 outreach recipients. Nick to confirm which address goes in the footer.

## Still needs Nick
- Google Business Profile setup + verification (uses the private street address).
- A named, credentialed medical reviewer (SEO E-E-A-T).
- Green light to deploy the free/PII-lock changes, and to send GA outreach batch one.
- A named, credentialed medical reviewer (SEO E-E-A-T).
- Green light to deploy the free/PII-lock changes, and to send GA outreach batch one.
