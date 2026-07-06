# E2E tests

Runnable QA for Clear Bed Recovery. Maps 1:1 to `docs/qa/QA-TEST-CATALOG.md`
(test titles carry the catalog ID, e.g. `AC-P1`, `MATCH-5`).

## Run

```bash
npm run test:e2e            # boots `next dev` and runs against localhost:3000
npm run test:e2e:ui        # Playwright UI mode
PLAYWRIGHT_BASE_URL=https://<vercel-preview>.vercel.app npm run test:e2e   # against a deploy
```

## What runs today (no setup needed) — 51 passing

- `crisis.spec.ts` — **P0** 988 reachable on every key page; 988+911 tappable in homepage footer
- `access-control.spec.ts` — §1a public routes render, §1b anon bounced from app shell
- `api-contract.spec.ts` — cron 401, webhook rejects unsigned, match/intake/handoff/conversations input contract
- `seeker.spec.ts` — homepage promise, hub pages, program profile, link crawl, match loads (match *submit* is preview-only `fixme`)

## Targeting prod vs preview (merged from clearbed-qa-agent)

`QA_TARGET_URL` picks the target; `previewOnly()` auto-skips data-writing tests on prod.

```bash
npm run test:e2e                                            # localhost (boots next dev)
QA_TARGET_URL=https://<preview>.vercel.app npm run test:e2e  # full suite incl. writes
npm run test:e2e:prod                                       # production, READ-ONLY
npm run report:supabase                                     # push run summary → qa_runs table
```

CI: `.github/workflows/qa.yml` runs nightly + on push, uploads the HTML report, and
writes a `qa_runs` row (apply `supabase/project-a/migrations/18_qa_runs.sql` first).

## What needs credentials (self-skips until set)

- `access-control.authed.spec.ts` — §1c role-lane isolation. Seed **non-prod** users and set
  `E2E_<LANE>_EMAIL` / `E2E_<LANE>_PASSWORD` (LANE = SEEKER|FACILITY|PARTNER|REP|ADMIN).
  Best approach: reuse the seed/teardown pattern from `scripts/rls-test.ts` in a
  Playwright global-setup, log in once per lane, and persist `storageState`.

## Never point write/checkout/handoff specs at production PHI (two-Supabase HIPAA seam).

## Excel master

`npm run qa:xlsx` regenerates `~/Downloads/ClearBed-QA-MasterTestCases.xlsx`
(one test per row). Source of truth: `scripts/qa-export-xlsx.mjs`.
