# Clear Bed Recovery — QA Test Catalog

**Status:** living document. **Owner:** Nick. **Last synced to code:** 2026-07-03.

This is the master test-case catalog for the whole site. It is organized by risk,
not by page order, because the highest-value tests are: (1) role/tenant isolation
(HIPAA / 42 CFR Part 2), (2) money paths (Stripe), (3) the seeker match → handoff
flow. Everything else is smoke coverage.

How this maps to automation:

| Layer | Lives in | Runs | Proves |
|---|---|---|---|
| **L1 — RLS / tenant isolation** | `scripts/rls-test.ts` (`npm run rls-test`) | CI + pre-deploy | The **database** rejects cross-tenant access even if the app has a bug |
| **L2 — E2E critical paths** | `tests/e2e/*.spec.ts` (`npm run test:e2e`) | CI on every push | The real routes redirect/gate/checkout correctly in a browser |
| **L3 — Manual smoke** | §7 of this doc | Before each release | Visual, content, PDF, email — things not worth automating |

A test case here is `ID · Route/flow · Role · Action · Expected`. IDs are stable —
reference them in Playwright `test()` titles (e.g. `AC-12`) so the doc and the code
never drift.

---

## 0. Roles under test

| Role | How it's established | Home base (`homePathFor`) |
|---|---|---|
| **Anon** | no session | — |
| **Seeker** | `user_metadata.role = 'seeker'` | `/me` |
| **Facility** | a `facility_members` row | `/facility/{id}` (or `/facility` if >1) |
| **Partner** | a `bd_users` row (or `role='partner'`) | `/partners` |
| **Rep** | a `rep_profiles` row (or `role='rep'`) | `/rep` |
| **Admin** | a `platform_admins` row | `/admin` |
| **Roleless** | signed in, no lane | `/get-started` |

**Canonical rule (`profileType`):** admin > facility > partner > rep > seeker > none.
A user only ever sees ONE lane. Out-of-lane URL hits are **redirected to the user's
own home base, never shown an error** — this is the anti-cross-profile guarantee and
is the single most important thing to test.

---

## 1. Access-control matrix (L2 — the core of the suite)

Legend: **200** = renders · **→login** = redirect to `/login` · **→home** = redirect to
the user's own lane home · **→err** = `/login?error=not_authorized` · **→X** = redirect
to route X.

### 1a. Public routes — must be 200 for EVERY role (incl. anon)

`AC-P1` … one case per route. Also assert no auth cookie is required.

| ID | Route | Anon | Signed-in (any lane) |
|---|---|---|---|
| AC-P1 | `/` (home hero) | 200 | 200 |
| AC-P2 | `/about` | 200 | 200 |
| AC-P3 | `/pricing` | 200 | 200 |
| AC-P4 | `/how-we-make-money` | 200 | 200 |
| AC-P5 | `/for-providers` | 200 | 200 |
| AC-P6 | `/for-partners` | 200 | 200 |
| AC-P7 | `/for-reps` | 200 | 200 |
| AC-P8 | `/claim` | 200 | 200 |
| AC-P9 | `/data` | 200 | 200 |
| AC-P10 | `/guides` + `/guides/[slug]` | 200 | 200 |
| AC-P11 | `/library` | 200 | 200 |
| AC-P12 | `/resources` | 200 | 200 |
| AC-P13 | `/insurance` + `/insurance/[payer]` + `/[payer]/[state]` | 200 | 200 |
| AC-P14 | `/programs` + `/programs/[id]` | 200 | 200 |
| AC-P15 | `/treatment/[state]/[seg]/[level]` (all depths) | 200 | 200 |
| AC-P16 | `/match` + `/match/nearby` | 200 | 200 (seeker AI is **anonymous-start BY DESIGN** — do not gate) |
| AC-P17 | `/privacy`, `/terms` | 200 | 200 |
| AC-P18 | `/login`, `/reset` | 200 | 200 |
| AC-P19 | `/p/[slug]` (rep public profile) | 200 | 200 |
| AC-P20 | `/share/[token]` | 200 (valid token) / 404 (bad) | same |

> ⚠️ Content edge cases for parameterized routes → §4 (bad/unknown params must 404, not 500).

### 1b. Authed shell — anon is always bounced

`AC-A0`: Anon → ANY `/(app)` route → **→login**. Parametrize over the full app-route list.

### 1c. Role lane matrix — the anti-cross-profile guarantee

For each route, the ✅ role renders; every other signed-in role must **→home** (their own
lane), and anon must **→login**. Admin is intentionally excluded from `isProviderSide`
but is NOT auto-granted seeker/facility/partner pages — verify the redirect target.

| ID | Route | ✅ Renders | Seeker | Facility | Partner | Rep | Admin | Guard |
|---|---|---|---|---|---|---|---|---|
| AC-1 | `/me` | Seeker | 200 | →home | →home | →home | →home | `requireSeeker` |
| AC-2 | `/conversations` | Seeker | 200 | →home | →home | →home | →home | `requireSeeker` |
| AC-3 | `/conversations/[id]` | Seeker (owner) | 200 own / →home others' | →home | →home | →home | →home | `requireSeeker` + RLS |
| AC-4 | `/facility` | Facility | →home | 200 | →home | →home | →home | `requireFacilityMember` |
| AC-5 | `/facility/[id]` | Facility **member of [id]** | →home | 200 own / **→home other facility** | →home | →home | →home | guard + RLS |
| AC-6 | `/facility/[id]/contacts` | Facility member | →home | 200 own | →home | →home | →home | `requireFacilityMember` |
| AC-7 | `/facility/[id]/invite` | Facility member | →home | 200 own | →home | →home | →home | `requireFacilityMember` |
| AC-8 | `/partners` | Partner | →home | →home | 200 | →home | →home | `requirePartner` |
| AC-9 | `/partners/search` | Partner | →home | →home | 200 | →home | →home | `requirePartner` |
| AC-10 | `/partners/saved` | Partner | →home | →home | 200 | →home | →home | `requirePartner` |
| AC-11 | `/partners/lists` + `/lists/[id]` | Partner | →home | →home | 200 own | →home | →home | guard + RLS |
| AC-12 | `/partners/history` | Partner | →home | →home | 200 | →home | →home | `requirePartner` |
| AC-13 | `/partners/settings` | Partner | →home | →home | 200 | →home | →home | `requirePartner` |
| AC-14 | `/partners/facility/[id]` | Partner | →home | →home | 200 | →home | →home | `requirePartner` |
| AC-15 | `/rep` | Rep | →home | →home | →home | 200 | →home | `requireRep` |
| AC-16 | `/admin` (+ all `/admin/*`) | Admin | **→err** | →err | →err | →err | 200 | `requireAdmin` (layout) |
| AC-17 | `/get-started` | Roleless | 200 | (seeker has lane→its rules) | — | — | — | `requireUser` |
| AC-18 | `/home` | any signed-in | →`/me` | →`/facility/{id}` | →`/partners` | →`/rep` | →`/admin` | redirects to lane |
| AC-19 | `/bd`, `/bd/[id]` | **retired** | →home | →home | →home | →home | →home | dormant lane, always redirect |

> **AC-16 nuance:** `/admin/*` uses `requireAdmin` which sends non-admins to
> `/login?error=not_authorized` (an ERROR redirect), NOT to their home base like the
> other lanes. This asymmetry is intentional but is a real test case — assert the exact
> target, incl. the `error` query param.

> **AC-5 / AC-3 / AC-11 are the crown jewels:** a *correct-lane* user reaching *another
> tenant's* record. The guard passes (right lane) but RLS must return zero rows → the page
> should 404/empty, never render another facility's data. This is the HIPAA line. These
> cannot be fully proven at L2 alone — pair each with an L1 `rls-test.ts` assertion.

---

## 2. Money paths (Stripe) — L2 + webhook contract

| ID | Flow | Setup | Expected |
|---|---|---|---|
| PAY-1 | `/api/checkout` GET | facility user, chosen plan | 303 redirect to a Stripe Checkout URL; unauth → →login |
| PAY-2 | Checkout success returns | complete test-mode payment | facility `plan` updated to purchased tier (via webhook, not the redirect) |
| PAY-3 | `/api/stripe/webhook` — unsigned | POST with no/invalid `stripe-signature` | Rejected, no DB write: **400** if `STRIPE_WEBHOOK_SECRET` set, **503** if not configured (local/CI). Prod MUST be 400. |
| PAY-4 | `/api/stripe/webhook` — valid `checkout.session.completed` | signed test event | facility entitlement upgraded; idempotent on replay |
| PAY-5 | Free→paid nav | facility on `free` | "⬆ Upgrade" pill visible; disappears after PAY-4 |
| PAY-6 | EKRA guard | any | pricing is **flat-fee per tier**, never per-referral/volume — assert no per-lead line items exist |
| PAY-7 | Downgrade / cancel | active sub | plan reverts to `free`; gated features (seeker contact visibility) re-lock |

> Stripe tests need **test-mode keys** + the Stripe CLI to forward/sign webhooks. Mark
> PAY-2/4/7 `skip` in CI unless `STRIPE_TEST_SECRET_KEY` is present.

---

## 3. Seeker match → handoff (the product's spine) — L2

| ID | Flow | Expected |
|---|---|---|
| MATCH-1 | `/match` loads for anon | chat renders, no login wall |
| MATCH-2 | `/api/match` POST | **Invalid JSON → 400**; sparse/empty *valid* JSON → **200** (`normalizeIntake` fills coarse defaults so a completed conversation never fails on a missing field — resilient by design, do not "fix" to 400) |
| MATCH-3 | `/api/intake` POST valid | 200 persists intake; malformed → **400** |
| MATCH-4 | `/match/nearby` + `/api/facilities/in-bounds` | returns facilities within map bounds; missing bounds → **400** |
| MATCH-5 | `/api/handoff` **without consent** | **400** — `consent_share` is mandatory (HIPAA / 42 CFR Part 2). This is a hard gate, test it explicitly. |
| MATCH-6 | `/api/handoff` **with consent** | 200, referral recorded, facility notified |
| MATCH-7 | Seeker contact visibility | contact PII only visible to Growth+ facilities **AND** with `consent_share=true`. Both conditions required — test the matrix (plan × consent). |
| MATCH-8 | `/api/conversations` POST unauth | **401**; authed seeker → 200 |

> MATCH-5/7 are the compliance crown jewels alongside AC-3/5. Never let a handoff or a
> contact reveal happen without consent, regardless of plan.

---

## 4. Parameterized-route robustness — L2/L3

For every `[param]` route, a bad value must **404, never 500**:

| ID | Route | Bad input | Expected |
|---|---|---|---|
| PARAM-1 | `/programs/[id]` | non-existent / non-uuid id | 404 |
| PARAM-2 | `/facility/[id]` | garbage id | 404 (after guard) |
| PARAM-3 | `/insurance/[payer]/[state]` | unknown payer / state | 404 |
| PARAM-4 | `/treatment/[state]/[seg]/[level]` | unknown seg/level | 404 |
| PARAM-5 | `/guides/[slug]` | unknown slug | 404 |
| PARAM-6 | `/p/[slug]` | unknown rep | 404 |
| PARAM-7 | `/share/[token]` | expired/invalid token | 404 or friendly "expired" page (not 500) |
| PARAM-8 | `/go/[id]` | unknown redirect id | 404 / safe fallback |

---

## 5. API contract quick-reference (L2)

| Route | Method | Auth | Bad-input | Notes |
|---|---|---|---|---|
| `/api/match` | POST | none | 400 | seeker AI |
| `/api/intake` | POST | none | 400 | |
| `/api/handoff` | POST | none | 400 + **consent required** | |
| `/api/conversations` | POST | **401 if unauth** | 400 | |
| `/api/checkout` | GET | facility | →login | Stripe |
| `/api/stripe/webhook` | POST | **signature** | 400 | idempotent |
| `/api/contact` | POST | none | 400 | rate-limit / spam guard? verify |
| `/api/facilities/search` | GET | none | — | public directory |
| `/api/facilities/in-bounds` | GET | none | 400 | map |
| `/api/geo` | GET | none | — | |
| `/api/track` | POST | none | — | analytics; assert it never 500s on junk |
| `/api/cron/weekly-reminders` | GET | **CRON_SECRET → 401** | — | must reject public calls |

`API-CRON-1`: hitting `/api/cron/weekly-reminders` without the `CRON_SECRET` header → **401**.

---

## 6. RLS / tenant isolation (L1 — `scripts/rls-test.ts`)

These run against the DB directly and are the real safety net. Extend the existing
suite to cover, per table: SELECT (cross-tenant → 0 rows), INSERT (cross-tenant →
error 42501), UPDATE (cross-tenant → 0 rows matched).

| ID | Table / relation | Assertion |
|---|---|---|
| RLS-1 | `platform_admins` | non-admin SELECT → 0 rows (this is what `isAdmin()` relies on) |
| RLS-2 | `facilities` (unpublished) | anon/seeker cannot read unpublished; other facility cannot update |
| RLS-3 | `facility_members` | facility A cannot read facility B's members |
| RLS-4 | `conversations` / vault | seeker A cannot read seeker B's conversation |
| RLS-5 | seeker contact PII | only Growth+ facility with `consent_share` can read; enforce in DB, not just UI |
| RLS-6 | `bd_users` / partner lists | partner A cannot read partner B's saved lists |
| RLS-7 | `rep_profiles` | a rep cannot escalate to facility management (display-only) |
| RLS-8 | two-Supabase HIPAA seam | Project A cannot reach Project B PHI without the vault path |

---

## 7. Manual smoke checklist (L3 — per release)

- [ ] Home hero + **mobile search overlay** (recent bug: portal to body, not the transformed hero — regression-check on mobile viewport)
- [ ] Every public nav link resolves (no dead links)
- [ ] Library PDF downloads open (e.g. "The First 24 Hours" pocket guide)
- [ ] Guides render markdown correctly
- [ ] Login → magic link / reset email actually arrives (nodemailer)
- [ ] Post-login lands each role on the right home base
- [ ] Facility invite email arrives and the invite link works
- [ ] Insurance/treatment SEO pages render with correct payer/state content
- [ ] Responsive: 375px, 768px, 1280px on home, /match, /pricing, a facility page
- [ ] No console errors on the top 10 routes
- [ ] Analytics (Vercel) fires without blocking render

---

## 8. Environments

- **Local:** `npm run dev` → `http://localhost:3000`. Fastest for authoring.
- **Preview:** every push creates a Vercel Preview deploy — run E2E against its URL via
  `PLAYWRIGHT_BASE_URL`.
- **Prod:** `clearbedrecovery.com` — smoke only, **never** run write/handoff/checkout
  tests against prod PHI. Read-only + synthetic accounts only.

> ⚠️ Two Supabase projects (HIPAA seam). Point tests at a **non-prod** Supabase, or use
> throwaway seeded users the way `rls-test.ts` already does (seed → assert → teardown in
> `finally`). Never seed test PHI into the prod PHI project.

---

## 9. Coverage tracker

| Area | L1 RLS | L2 E2E | L3 manual |
|---|---|---|---|
| **Crisis 988/911 (P0)** | — | **✓ passing** (`crisis.spec.ts`) | ✓ |
| Seeker journeys | — | **✓ passing** (`seeker.spec.ts`, match-write=fixme) | ✓ |
| Access-control matrix (§1) | partial | **✓ passing** (`access-control.spec.ts`) | — |
| Public smoke (§1a) | — | **scaffolded** (`public-pages.spec.ts`) | ✓ |
| Stripe (§2) | — | todo | ✓ |
| Match/handoff (§3) | RLS-4/5 | **scaffolded** (`api-contract.spec.ts`) | ✓ |
| Params (§4) | — | scaffolded | ✓ |
| API contract (§5) | — | **scaffolded** (`api-contract.spec.ts`) | — |
| RLS (§6) | ✓ existing + todo | — | — |

Update this table as tests land.
