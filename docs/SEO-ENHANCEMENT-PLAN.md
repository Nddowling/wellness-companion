# ClearBed Recovery — SEO & AI-Search Operating Plan

**File:** `docs/SEO-ENHANCEMENT-PLAN.md` · **Version:** 1.1 · **Date:** 2026-07-06
**Changelog v1.1:** Added §0 agent operating instructions · §16 P0 acceptance criteria · §17 execution specs (internal linking, pagination, alt text, coverage-audit spec, title-iteration loop) · §18 paid tooling (budget constraint lifted by founder 2026-07-06).
**Companion:** `docs/SEO-BASELINE.md` (implemented standard). This doc is the enhancement scope built on top of it.
**Owners legend:** `[AGENT]` = VS Code agent · `[NICK]` = founder · `[BOTH]` = agent builds, Nick supplies/approves content.
**Verification note:** All "Verified 2026-07-06" items were confirmed via live research on that date (Google Search Status Dashboard timeline via SEJ/industry trackers; BrightEdge AIO coverage data; web.dev CWV thresholds; Google Search Central AI guidance; behavioral-health vertical SEO sources). Items marked "High-confidence, not re-verified" are from model knowledge and should be spot-checked if load-bearing.

---

## 0. How To Work This File (VS Code agent instructions)

1. Execute top-down within a tier: all P0 → P1 → P2. Never open a new state's sitemap shards until the prior state passes its ≥70% indexation gate.
2. Before the first Pass-1 enrichment batch, generate and run the coverage audit per §17.4 against the live Supabase schema; commit output to `docs/qa/`.
3. A checkbox may only be ticked when its §16 acceptance criteria pass (or, for tasks without listed criteria, when the named measurement in §10/§11 is observable).
4. Tasks tagged `[NICK]` (reviewer, GBP, PR, purchases, GSC toggle screenshot): flag in the task list and continue — do not block adjacent `[AGENT]` work on them.
5. **Invariants that must never regress in any commit:** PII-free analytics (booleans/categories only) · aggregateRating only with real moderated reviews · slug canonical + 301 behavior · thin-combo noindex rules · robots AI-crawler allowlist · GSC AI-exclusion toggle OFF · Verified badge never purchasable · crisis surfaces never monetized. Add/keep Playwright assertions for each.
6. After every deploy touching templates: run the Playwright SEO suite; sample 5 profile / 3 hub / 2 guide URLs through a schema validator; confirm sitemap URL count moved as expected (fail the deploy review if it drops >5% unexpectedly).
7. During any confirmed Google update rollout: freeze SEO-affecting merges; follow §15.

---

## 1. Executive Summary

ClearBed's technical SEO baseline (slug URLs, 301s, schema suite, sharded-ready sitemap, canonical discipline, privacy-safe analytics) is genuinely strong for a pre-traffic site. The three things standing between "technically clean" and "SEO-driven growth" are:

1. **Indexation earned page-by-page, not assumed** — 29,447 URLs on a fresh domain in a vertical Google explicitly polices for scaled-content abuse (March 2026 core update named it; template-variable sites lost 60–90%). Survival = data differentiation per page + staged, gated rollout.
2. **YMYL trust infrastructure** — medical reviewer, bylines, review dates, entity signals (contact/NAP/GBP). Healthcare took the hardest hits in Dec 2025/Mar 2026; recovery windows run 6–12 months. Trust is a prerequisite, not polish.
3. **AI-answer citability** — AI Overviews trigger on ~88–89% of healthcare queries; being *cited* is the growth surface. Requires answer-block formatting + original statistics from our own 13,501-facility dataset (the moat nobody can copy).

**Health score (hypothetical construct, per protocol):** ~35–40% of what serious SEO-driven growth requires today → realistically ~55% at 90 days, ~65–70% at 6 months, ~80% at 12 months IF P0s execute and the maintenance loop holds. Caps: domain authority and E-E-A-T cannot be rushed; YMYL maturity is a 12–18 month curve. Fastest raisers: ISR + staged GA indexation + Pass-1 enrichment + reviewer bylines. Moat builders: enrichment depth (availability, verification, payer data), original statistics, review corpus, brand citations.

---

## 2. Verified 2026 Reality (basis for every decision below)

- [x] Verified 2026-07-06 — 2026 update cadence: Feb Discover update · Mar 24–25 spam update · Mar 27–Apr 8 core (record volatility; scaled content abuse explicitly targeted) · May 21–Jun 2 core · Jun 24–26 spam. Cadence has ~doubled → episodic SEO is dead; run the loop in §13.
- [x] Verified — March 2026 enforcement patterns: mass AI pages without editorial review; template-with-variable substitution at scale; aggregators adding nothing beyond source data. Survivors: directories/marketplaces with unique verified data per page ("live inventory" pattern). **ClearBed's availability + verification + reviews = the survivor pattern, if surfaced.**
- [x] Verified — AI Overviews on ~88–89% of healthcare queries (BrightEdge); AIO presence cuts #1-result CTR ~60%; ~92% of AIO citations come from page-one results; AI Mode ~1B MAU (I/O 2026). Strategy = rank page one AND be extractable.
- [x] Verified — Google official guidance: no special schema, no llms.txt required for AI surfaces; query fan-out is documented; answer-first blocks (20–40 word direct answers under question headings) are the extraction pattern; original statistics lift AI visibility ~30–40%.
- [x] Verified — GSC generative-AI performance reports rolling out (June 2026, staggered). GSC now has a toggle to EXCLUDE content from AI Overviews/AI Mode — **must remain OFF**.
- [x] Verified — CWV: confirmed thresholds LCP ≤2.5s / INP ≤200ms / CLS ≤0.1 at p75 (web.dev). Multiple post-March reports claim tightened LCP enforcement (~2.0s); uncorroborated by Google docs → **engineer to LCP ≤2.0s** as the safe bar. INP is the most-failed vital (~43% of sites).
- [x] Verified — ChatGPT search retrieves via Bing's index → Bing WMT + IndexNow = outsized AI visibility. Reddit = #1 most-cited domain across AI engines (Mar 2026); YouTube top-5.
- [x] Verified — FAQ rich results restricted to authoritative gov/health sites (since Aug 2023); ClearBed won't earn the SERP feature — schema kept only for machine comprehension, and only where answers are facility-specific.
- [x] Verified — Dec 2025 core hit ~67% of health sites; behavioral-health link building: vertical pubs (Behavioral Health Business, Addiction Professional, STAT), state agency / recovery-community resource lists; guest-post + reciprocal schemes are actively harmful in YMYL; scholarship link building = spam pattern, banned here.
- High-confidence, not re-verified this session: HARO/Connectively shut down (late 2024) → use Source of Sources / Qwoted / Featured. Sitelinks SearchBox (SearchAction) deprecated (Oct 2024).

---

## 3. Validation of Prior Plan (Keep / Modify / Demote / Remove / Add)

| Recommendation | Verdict | Reason / Evidence | Priority | Owner | First step |
|---|---|---|---|---|---|
| ISR/PPR cacheable profiles (client-island the auth check) | **Keep** | Biggest crawl + CWV lever; uncached 13.5K pages throttle both | P0 | AGENT | Extract `getRoles()` consumer into client island; `export const revalidate=86400` |
| Staged indexation + sitemap sharding + 70% gates | **Keep** | Direct answer to Mar-2026 enforcement + "Discovered–not indexed" failure mode | P0 | AGENT | Shard sitemap by state+type; submit GA shards only |
| Noindex thin combos | **Keep (hardened)** | Rule: **<3 facilities OR <60% unique content ⇒ noindex** | P0 | AGENT | Add facility-count check to landing templates |
| Per-page data differentiation (availability, verified dates, computed stats) | **Keep** | The survival criterion, verbatim from enforcement analysis | P0 | BOTH | Hub intro data-block component fed from Supabase aggregates |
| Medical reviewer + bylines + dates + MedicalWebPage | **Keep** | YMYL table stakes; Dec-2025 evidence | P0 | NICK recruit / AGENT build | Draft reviewer offer (free Anchor listing) |
| Bing WMT + IndexNow + AI-crawler allowlist | **Keep** | ChatGPT=Bing index; 1-hour task | P0 | AGENT | Verify robots allows GPTBot/ClaudeBot/PerplexityBot/Bingbot; add IndexNow key |
| Answer-block (BLUF) rebuild of hubs/guides | **Keep** | Extraction pattern for AIO/AI Mode fan-out | P1 | BOTH | Template: H2-question → 20–40w answer → context → list |
| Original statistics from own dataset | **Keep** | +30–40% AI visibility; uncopyable moat | P1 | AGENT compute / NICK publish | Monthly stat-block generator from Supabase |
| Free / Medicaid / state-funded cluster | **Keep** | Incumbent blind spot; SAMHSA seed covers it; high demand, on-mission | P1 | BOTH | "Free rehab in Georgia" pillar first |
| Maps iframe → static facade; next/image; INP budget | **Keep** | Largest LCP/INP liability; INP most-failed vital | P1 | AGENT | Static map thumb + click-to-load on profiles |
| Remaining internal 301 links (directory RPC, match/nearby/rep) | **Keep** | Finish `facilityPath()` threading | P1 | AGENT | Thread RPC results through helper |
| /contact + GBP + NAP + Organization sameAs | **Keep** | Entity trust; mailto-only is a rater-visible gap | P1 | NICK (GBP) / AGENT (page) | Build /contact w/ address+phone |
| FAQPage schema sitewide | **Modify** | No rich results for us (Aug-2023 restriction); templated FAQs = near-dup risk | P1 | AGENT | Keep ONLY facility-specific FAQs; strip identical blocks |
| Enrichment "run the pipeline" | **Modify → formal 6-pass architecture (§6)** | Needed grounding rules + confidence/source fields | P0/P1 | BOTH | Add `last_verified`, `verification_confidence`, `source_url` columns |
| Availability display | **Modify** | Must show timestamp + "call to confirm" — a family arriving to a phantom bed is a catastrophic trust failure | P0 | AGENT | Add `availability_updated_at` render + disclaimer |
| PR outlets | **Modify** | HARO dead; use SOS/Qwoted/Featured + vertical pubs + state resource lists | P2 | NICK | Pitch list of 10 |
| Dynamic OG images | **Demote P1→P2** | Real but modest CTR for this vertical's share patterns; below CWV/trust | P2 | AGENT | Profile `opengraph-image` route |
| YouTube presence | **Demote → P2/Experimental** | Top-5 AI-cited domain but real production cost; Reels repurposing only | P2 | NICK | Cross-post existing Reels as Shorts |
| llms.txt | **Demote → optional 5-min** | Google: not used; other engines: unproven. Zero-cost add, zero expectation | P3 | AGENT | Static file, done |
| SearchAction schema expectations | **Remove** | Sitelinks searchbox deprecated; harmless residue only | — | — | Stop tracking it |
| `meta keywords` tag | **Remove** | Ignored 15+ yrs; template cruft | — | AGENT | Delete from layout |
| Scholarship link building | **Remove (banned)** | Known rehab-vertical spam pattern | — | — | Never |
| Literal "near me" pages | **Remove (do not build)** | Doorway pattern; city hubs + GBP serve the intent | — | — | — |
| County pages | **Remove for now** | Thin-content risk below city level at current density | — | — | Revisit at metro saturation |
| Facility "X vs Y" comparison pages | **Remove (do not build)** | YMYL fairness/defamation optics; provider-relations landmine | — | — | Category comparison guides only |
| **Add:** verification schema fields (`last_verified`, `verification_confidence`, `source_url`, `verified_by`) | **Add** | Backbone of enrichment, trust, freshness | P0 | AGENT | Migration + backfill defaults |
| **Add:** insurance-data accuracy protocol | **Add** | Wrong "accepts Medicaid" harms vulnerable users; display "as of {date}", confidence-tiered, sourced; never AI-guessed | P0 | BOTH | Payer fields require source_url or claim-confirmation |
| **Add:** "Verified" badge is earned, never sold; distinct from "Claimed" | **Add** | Badge-for-money kills the moat | P0 policy | NICK | Write into placement-policy page |
| **Add:** IndexNow ping on facility update | **Add** | Freshness automation to Bing/Copilot | P2 | AGENT | Webhook on facility `updated_at` |
| **Add:** provider monthly visibility report (auto-email) | **Add** | Analytics→monetization bridge; the sales weapon | P1 | AGENT | Template from existing event data |
| **Add:** interim CWV measurement plan | **Add** | CrUX field data won't exist pre-traffic; use lab (PSI) + Vercel Speed Insights until p75 data populates | P1 | AGENT | Add Speed Insights; document in QA |
| **Add:** Wikidata/knowledge-graph entity push | **Experimental — later** | Notability not yet earned; premature = deletion | P3 | — | Revisit after press coverage |

---

## 4. Programmatic Architecture — index/noindex/do-not-build matrix

**Index (with per-page data gates):** facility profiles (Pass-1 complete only) · state hubs · city hubs (≥3 facilities) · state×level (≥3) · city×level (≥3) · insurance×state (≥3 + payer data confidence ≥ medium) · Medicaid/state-funded/free-treatment pages · guides/pillars · /data + stat pages.
**Noindex:** combos <3 facilities · any page failing 60%-unique check · filtered/paginated states beyond canonical page patterns · search-result states with query params · dashboards/claim/rep (already disallowed) · profiles missing Pass-1 fields (temporary noindex until enriched).
**Do not build yet:** county pages · facility-vs-facility comparisons · literal "near me" URLs · per-facility video pages.
**Geographic staging:** GA → (70% indexation gate, ~6 weeks) → FL panhandle + coastal SC → Southeast → national. Sitemap shards per state per type; each shard is a GSC diagnostic unit.
**Closed facilities:** status page ("Permanently closed" + nearby alternatives), schema updated, kept 200 — never 404 (equity + user service). Detection signals in Pass-6.

---

## 5. Health Score Detail (Phase 3)

Weighting: Technical 25% · Content/Data uniqueness 30% · Authority/Trust 30% · Measurement/Ops 15%.
Today ≈ (Tech 68 · Content 25 · Authority 10 · Ops 70) → **~38%**. 90-day target ≈ 55% (P0s done, GA enriched+indexing, reviewer live, first links). 6-mo ≈ 65–70% (clusters ranking long-tail, first AI citations, 2–3 states). 12-mo ≈ ~80% (authority compounding, review corpus, multi-state).
Assumptions: solo-founder + agent capacity holds; no core-update casualty; GA indexation behaves. Score-cappers if ignored: no reviewer (trust ceiling ~50%), no links/citations (authority ceiling), profiles left uncached (crawl ceiling), stale payer data (trust collapse). Moat value: enrichment depth + availability freshness + review corpus + original stats — none copyable by a static competitor.

---

## 6. 13,501-Facility Enrichment Strategy

**Iron rules:** (1) AI may *draft prose* grounded in first-party crawled sources; AI must **never originate facts** for payer acceptance, clinical services, licensing, accreditation, availability, or phone numbers — those are source-or-nothing. (2) Every enriched field carries `source_url`, `last_verified`, `verification_confidence` (high=claimed/registry · medium=site-crawl match · low=SAMHSA-only). (3) No page indexes without Pass-1. (4) 10% human spot-audit per enrichment batch.

| Field cluster | SEO value | User value | Provider value | Monetize | AI-gen? | Human verify? | Source | Difficulty | Priority |
|---|---|---|---|---|---|---|---|---|---|
| Verified website/phone/address/geo | High (entity, local) | Critical | High | Gate for claims | No | Spot-check | NPI/NPPES + crawl + call | Med | **Pass 1** |
| Levels of care (detox/res/PHP/IOP/OP/MAT) | Very high (facet mesh) | Critical | High | Filter exposure | Extract-only | Spot-check | SAMHSA flags + site crawl | Med | **Pass 1** |
| Payer booleans (Medicaid/Medicare/self-pay/sliding) | Very high (insurance mesh) | Critical | High | High | Extract-only | Yes (dated) | SAMHSA + site + claim | Med-High | **Pass 1** |
| Unique summary + differentiators + local context | Very high (dedup survival) | High | Med | Enhanced profiles | Draft-from-source | 10% audit | Crawl corpus | Med | **Pass 2** |
| Populations served / co-occurring / trauma / faith | High (population pages) | High | Med | Filter exposure | Extract-only | Spot-check | Site + SAMHSA | Med | **Pass 2** |
| Computed comparison signals ("1 of 4 detox providers in Chatham Co.") | High (uniqueness + citations) | Med | Med | — | Computed | No | Own DB | Low | **Pass 2** |
| Licensing source link · accreditation (CARF/JCAHO) | High (E-E-A-T) | High | High | Trust badge (earned) | No | Yes | State DB + accreditor directories | Med | **Pass 3** |
| Review moderation status · closed status | Med | High | Med | — | No | Yes | Ops + signals | Low | **Pass 3** |
| Intake phone · admissions email · team · media | Med | High | Very high | Core paid tiers | No | Claim-verified | Provider claim | Low | **Pass 4** |
| Named carriers (Aetna/BCBS/…) | Very high (payer pages) | Very high | Very high | High | No | Claim/doc-verified only | Provider claim + payer docs | High | **Pass 5** |
| Bed availability + timestamp | High (freshness) | Critical | Very high | Anchor-tier feature | No | Self-reported, dated, disclaimed | Claimed providers | Med | **Pass 5** |
| Stat-sentences / dataset rows | Very high (AI citations, links) | Med | Low | — | Computed | Review | Own DB | Low | **Pass 5** |
| Freshness loop (re-verify, SAMHSA diff, closure detection) | High (YMYL freshness weighting) | High | Med | Retention | Partial | Quarterly | All above | Med | **Pass 6** |

**Pass sequencing:** Pass 1 GA-complete before GA shard submission → Pass 2 GA within 30 days → Pass 3 rolling → Pass 4 rides the claim funnel → Pass 5 claimed-facility exclusive (also the upgrade pitch) → Pass 6 quarterly forever.

---

## 7. Trust & Compliance Requirements (non-negotiable set)

- [ ] Placement Integrity Policy live (match-first · labeled · one slot · flat-fee/EKRA · BedGuide + crisis surfaces never sponsored) — per approved copy set
- [ ] "Verified ≠ Claimed ≠ Sponsored" — three distinct, documented states; Verified is earned only
- [ ] Medical reviewer program: named credentialed reviewer, bio page + Person schema + license `sameAs`, `reviewedBy`/`lastReviewed` on all editorial; medical disclaimer above first H2; published + updated dates sitewide
- [ ] No treatment guarantees, no outcome claims, no deceptive hotline framing anywhere (including ads/social); crisis surfaces carry 988/911 only
- [ ] Insurance accuracy protocol (§6 iron rule 2) + on-page "as of {date}" rendering
- [ ] /contact with address + phone = GBP = Organization schema (NAP identical)
- [ ] Review moderation documented; provider complaint/correction workflow (SLA: acknowledge 48h, correct 7d)
- [ ] Analytics remain PII-free (booleans/categories only — already shipped; never regress)
- [ ] aggregateRating only with real moderated reviews (already enforced — never regress)

---

## 8. AI-Search Playbook (tagged)

**Evergreen:** answer-first structure · original statistics · entity consistency · E-E-A-T substance · fast server-rendered pages · genuine Reddit participation · real reviews.
**Change-sensitive:** GSC generative-AI reports (adopt on arrival) · AI-crawler bot list in robots (re-check quarterly) · citation-pattern chasing per engine · Bing/IndexNow weighting.
**Experimental edge:** per-metro "availability index" stat pages engineered for citation · BedGuide-answer transcripts as indexable Q&A (privacy-scrubbed, pattern-level only) · Wikidata entity (post-press) · provider-data API/embeds that earn attribution links.

---

## 9. Monetization Guardrails (SEO ↔ revenue)

**Safe to sell (flat-fee only):** claimed/enhanced profiles · media upgrades · dashboards + monthly visibility reports · profile-completeness tools · Featured Partner slot (eligibility = organic top-20 match; labeled; one per result set; 6-mo rate locks; ladder $1.5–2.5K pilot → $5K → $7.5–10K by metro volume) · featured *educational* placements (labeled) · response/reputation tooling.
**Never sell:** organic ranking order · the Verified badge · BedGuide recommendations · crisis surfaces · review outcomes · user data (never, to anyone) · per-lead/per-admission anything (EKRA, 18 U.S.C. § 220).
**Proof providers need before paying:** profile views, tracked calls/forms/directions with metro segmentation (shipped), month-over-month trend, and the auto-emailed monthly report (P1 add).

---

## 10. Analytics & Measurement Deltas (most already shipped)

- [x] 19 intent events + slug/metro props + claim funnel — LIVE (do not regress; verify post-deploy by hand-firing each money event)
- [ ] Provider monthly visibility report generator `[AGENT]`
- [ ] GSC: shard-level coverage dashboards; adopt generative-AI report when it appears; **AI-exclusion toggle stays OFF**
- [ ] Bing WMT parity + IndexNow delivery monitoring
- [ ] Interim CWV: PSI lab runs on 3 template types monthly + Vercel Speed Insights RUM until CrUX p75 populates
- [ ] Playwright SEO assertions: canonical · title pattern · MedicalBusiness/MedicalWebPage presence · noindex rules · robots AI-bot allowlist
- [ ] Post-core-update protocol: freeze changes during rollout; 28-day pre/post GSC diff; sort losers; audit E-E-A-T/differentiation on losers only

---

## 11. Roadmap

**First 48 hours `[AGENT unless noted]`** — P0: sitemap sharding + GA-only submission (GSC+Bing) · IndexNow key · robots AI-bot allowlist + GSC AI toggle check `[NICK verifies]` · delete meta-keywords · enrichment schema migration (`last_verified`,`verification_confidence`,`source_url`) · /contact page scaffold.
**First 7 days** — P0: ISR/PPR profile split + revalidate webhook · thin-combo noindex rule live · availability timestamp + disclaimer render · Pass-1 GA batch run + 10% audit `[BOTH]` · reviewer outreach sent `[NICK]` · GBP created `[NICK]`.
**30 days** — P0/P1: GA hubs data-blocks · answer-block rebuild of top 10 guides/hubs `[BOTH]` · Maps facade + next/image + INP pass on search surfaces · Pass-2 GA · free/Medicaid GA pillar · first GA data study published + 10 vertical/gov pitches `[NICK]` · provider report v1 · Playwright SEO tests.
**90 days** — indexation gate check (GA ≥70% → open FL/SC shards) · Pass-3 rolling · reviewer bylines sitewide · 2 more clusters · SOS/Qwoted cadence · first Featured pilot conversation (proof-backed) · dynamic OG images (P2 window).
**6 months** — 3–4 states enriched+indexed · monthly stat refresh automated · Pass-5 on claimed cohort · case study #1 from call-tracking · AI-citation tracking (manual weekly sampling: ChatGPT/Perplexity/AIO for 20 target queries).
**12 months** — Southeast saturation → staged national · quarterly prune #4 · authority review (aim: 30+ referring domains incl. 3+ .gov/edu resource lists) · revisit county pages/Wikidata/API-embeds experiments.
*(Every task: risk-if-ignored = the cap listed in §5; measurement = the KPI named in §10/§12.)*

## 12. Definition of Done ("every free measure exhausted")

Technical: ISR live · shards + gates · zero internal 301 hops · CWV green (LCP≤2.0/INP≤200/CLS≤0.1 lab, then field) on 3 template types · AI crawlers allowed · IndexNow live · CI SEO assertions.
Content/Data: 100% indexed pages Pass-1+2 complete · thin combos noindexed · answer-blocks on all hubs/guides · monthly stat refresh · free/Medicaid cluster live · facility-specific-only FAQs.
Trust: reviewer + bylines + dates sitewide · MedicalWebPage/Person schema · NAP=GBP=schema · closed-facility policy · placement-policy live · payer-data protocol enforced.
Authority: 1 data study/mo · ≥5 vertical/gov placements · SOS/Qwoted cadence · Reddit presence · GBP reviews ≥5.
Measurement: GSC+Bing+AI reports · provider reports auto · post-update protocol documented · quarterly loop executed on schedule.

## 13. Maintenance Loop (quarterly, calendar-blocked)

Prune/consolidate thin pages · refresh stat blocks · re-verify rolling 25% of enriched facilities · SAMHSA diff import · closure detection sweep · CWV re-panel · schema validator pass · robots/bot-list re-check · backlink/mention audit · post-update diffs as they occur.

## 14. Risks & Assumptions (pressure test)

**Top risks:** (1) Founder bandwidth — single operator + W-2; mitigation: agent owns ~70% of tasks, this doc is the contract. (2) Stale/wrong payer or availability data — worst-case trust failure with vulnerable users; mitigation: §6 iron rules, timestamps, disclaimers. (3) Scaled-content classification — mitigation: gates, differentiation, staged rollout. (4) Core-update casualty despite compliance — mitigation: §10 protocol, no panic changes mid-rollout. (5) AI-drafted prose drifting into fabrication — mitigation: grounding + 10% audits. (6) Featured-slot pressure eroding match-integrity — mitigation: eligibility hard-coded, policy public. (7) Zero-click reality — even cited, clicks shrink; mitigation: brand + on-site conversion focus (BedGuide, availability) so captured clicks convert.
**Assumptions to verify live:** GA facility count + field-coverage %s (Supabase query) · GSC coverage after first shard (2–3 wks) · robots.txt as-deployed · Rich Results Test on profile + hub + guide · Bing indexation · competitor GA-city-page gap crawl (Recovery.com/Rehabs.com) · CrUX absence confirmed (expected) · event flow hand-verified in prod.
**Known unknowns:** LCP 2.0 tightening (uncorroborated — engineered-around) · AI-engine citation-weight shifts · GSC AI-report rollout timing.

## 15. Post-update quick reference

Rollout announced → freeze SEO-affecting deploys → wait for "complete" → +7 days for GSC lag → 28-day pre/post diff → losers-only audit (differentiation, E-E-A-T, intent match) → fix → wait for recrawl/next update. Never mass-delete during volatility.

---

## 16. P0 Acceptance Criteria (tick the box only when these pass)

- **ISR/PPR profiles:** second request to a public profile returns edge-cache HIT/STALE (`x-vercel-cache`); build output marks the route static/PPR; logged-in vs logged-out claim UI both render correctly (client island working); on-demand revalidation fires on facility `updated_at` webhook (verify: update a test row → page reflects within 60s); sampled profile TTFB p50 < 200ms.
- **Sitemap shards + staged submission:** sitemap index lists per-state, per-type shards; only GA shards submitted in GSC + Bing; GSC coverage shows shard-level rows; non-GA shards return 200 but are unsubmitted.
- **Thin-combo noindex:** any landing combo with <3 facilities renders `<meta name="robots" content="noindex,follow">` AND is absent from shards; Playwright asserts both; spot-check 5 known-thin combos.
- **Enrichment schema migration:** `last_verified`, `verification_confidence` (`high|medium|low`), `source_url`, `verified_by` exist; backfill defaults = `low` / SAMHSA source URL / import date; §17.4 coverage report generates cleanly.
- **Availability rendering:** wherever availability shows: timestamp + "Call to confirm current availability" visible; availability older than 30 days auto-hides the badge (renders "Availability not recently verified").
- **Robots/AI surface:** live robots.txt allows Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot; IndexNow key file served; `[NICK]` GSC AI-exclusion toggle confirmed OFF (screenshot in docs/qa/).
- **Entity trust:** /contact live with street address + phone; values byte-identical across page, Organization JSON-LD, and GBP; `[NICK]` GBP verified.
- **Reviewer layer (build side):** byline + reviewer components render name, credential, `lastReviewed` date; MedicalWebPage + Person JSON-LD validate; disclaimer block sits above first H2 on all guide templates.

## 17. Execution Specs

**17.1 Internal-linking algorithm (no orphans):** Profile → breadcrumb (state, city) + parent city hub + 3 nearest same-level facilities (geo query) + 1 mapped guide. City hub → all child profiles ordered by completeness score (Pass-1 field count + has_review + claimed) + 5 nearest sibling city hubs + child level pages (≥3 facilities) + relevant insurance page. State hub → city hubs by facility count, level pages, insurance×state pages, guides, /data. Guides → their cluster pillar + 2 hubs + 3 exemplar profiles. **CI check:** crawl script asserts every indexable URL has ≥3 internal in-links; violations fail the report.
**17.2 Pagination & params:** `?page=n` states are self-canonical; pages ≥2 carry `noindex,follow`. All filter-param states on /programs (`?pay=`, `?level=`, `?q=`, etc.) = `noindex,follow` via meta (NOT robots.txt blocks — a blocked URL can't be seen as noindex); the canonical indexable surface for any filter intent is its mesh landing page.
**17.3 Media:** image alt pattern `"{Facility} – {City}, {ST} {photo_type}"`; static-map alt `"Map of {Facility} location in {City}, {ST}"`; hero/LCP image preloaded; all imagery through next/image.
**17.4 Coverage-audit spec (agent generates SQL against real schema, per state):** total facilities · % verified phone · % verified website · % with ≥1 level-of-care flag · % with ≥1 payer boolean · % with unique description (fail = any normalized 8-gram shingle set overlapping >30% with another row) · slug collision count · closed count. Output: `docs/qa/enrichment-coverage-{date}.md`. Run before every Pass batch and at each quarterly loop.
**17.5 Title/CTR iteration loop (day 90+):** GSC top-200 queries; pages at position ≤8 with CTR below the expected curve for that position → title/meta rewrite queue (one variable per rewrite; re-measure at 28 days).
**17.6 Keyword map (blocker for cluster targeting):** `[NICK + paid tool]` produce `docs/KEYWORD-MAP.md` mapping each mesh template + cluster pillar to target queries w/ volume + intent; `[AGENT]` consumes it for titles, H1s, and answer-block questions. Until it exists, use GSC query data + autocomplete/People-Also-Ask harvesting as the interim source.

## 18. Paid Tooling (budget constraint lifted 2026-07-06)

| Tool | Cost | Why it's worth paying for | When | Owner |
|---|---|---|---|---|
| Screaming Frog license | ~$259/yr | **Required at our scale** — free tier caps at 500 URLs vs our 29,447; monthly full crawl = orphan/redirect/canonical/duplicate QA that nothing free replaces | Now | NICK buys · AGENT consumes exports |
| Ahrefs Lite or Semrush Pro | ~$100–130/mo | Unlocks the keyword map (§17.6), competitor gap vs Recovery.com/Rehabs.com, backlink monitoring — the free plan's single biggest blind spot | Month 1–2 | NICK |
| CallRail | ~$45/mo | Already in GTM plan — the provider ROI proof layer | With first claims | NICK |
| AI-visibility tracker (Otterly / Profound / Semrush AI toolkit) | varies | Only when manual weekly sampling of 20 queries across ChatGPT/Perplexity/AIO outgrows a spreadsheet | Month 4+ | NICK |
| **Explicit non-buys** | — | llms.txt generator subscriptions (mythbusted by Google) · directory-submission services (spam) · link marketplaces & scholarship schemes (banned, §2) · standalone rank trackers (covered above) | Never | — |
