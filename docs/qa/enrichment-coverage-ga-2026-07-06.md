# Enrichment coverage — GA — 2026-07-06

_§17.4 coverage audit. Percentages are of PUBLISHED facilities in the state._

- Total GA facilities (all): **422**
- Total GA published: **422**
- Verified phone (has phone; no verification field yet — see note): **419** (99.3%)
- Verified website (has website; no verification field yet): **392** (92.9%)
- ≥1 level-of-care flag: **422** (100.0%)
- ≥1 payer boolean: **292** (69.2%)
- Has description: **289** (68.5%)
- Unique description (has desc AND not >30% 8-gram overlap): **46** (10.9% of all)
- Exact-duplicate descriptions (facilities sharing an identical normalized description): **0**
- Near-duplicate descriptions (>30% 8-gram shingle overlap): **243**
- has verified_at (existing legacy flag): **1** (0.2%)
- Slug collisions (GA): **0**
- Closed facilities: **N/A** (no closed/status column yet — Pass-6 adds detection)

**Notes / caveats:**
- "Verified" phone/website cannot be measured yet: the `last_verified` / `verification_confidence` / `source_url` / `verified_by` columns do not exist (P0 enrichment-schema migration adds them). Numbers above are PRESENCE, not verification.
- Closed-facility count needs a status column (Pass-6).
