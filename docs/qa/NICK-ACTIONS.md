# [NICK] Actions — SEO P0 (things that need your accounts / identity / card)

_The agent built everything around these so they're drop-in. Do them in parallel — none block agent work._

## 0. Two real-world facts the agent needs (it will NOT invent them — YMYL)
- [ ] **Business NAP** — the exact street address + phone to publish on `/contact`, in `Organization` schema, and in GBP (must be byte-identical across all three). Reply with:
  - Street, City, ST, ZIP:
  - Public phone:
- [ ] **Medical reviewer** — a real, named, credentialed person (MD/DO/LCSW/LPC/etc.) who will be the site's clinical reviewer. Needed: full name, credential(s), license # + issuing state (for `sameAs`), 2-sentence bio, headshot. The byline/`Person`/`MedicalWebPage` schema is built and flag-gated — it renders the moment you supply a real person. (Draft recruitment email below.)

## 1. Google Search Console (5 min)
- [ ] Property for `clearbedrecovery.com` already verified (meta tag live). Go to **Indexing → Sitemaps**.
- [ ] Once the agent ships state-sharded sitemaps: submit **only the GA shards** (e.g. `sitemap/ga-facilities.xml`, `sitemap/ga-hubs.xml`) — NOT the national index yet (staged rollout, §4/§11).
- [ ] **Settings → check the "AI features" / generative-AI exclusion toggle is OFF** → screenshot → drop into `docs/qa/` (invariant §0.5). This is the one item the agent literally cannot see.
- [ ] Adopt the generative-AI performance report when it appears in your account.

## 2. Bing Webmaster Tools (5 min)
- [ ] Add `clearbedrecovery.com` (use "Import from GSC" to skip re-verification).
- [ ] Sitemaps → submit the same GA shard URLs.
- [ ] IndexNow: the key file is already served at
  `https://clearbedrecovery.com/f717ab98f4e3b6caa862cbc394eacb7e.txt`. Nothing to do — Bing/Copilot auto-detect it; the agent will wire the update-ping (P2).

## 3. Google Business Profile (15 min + verification wait)
- [ ] Create the GBP for Clear Bed Recovery using the **same NAP** from §0. Category: "Addiction treatment center" or "Mental health service" as fits the connector model.
- [ ] Complete verification (postcard/phone/video per Google). Reply when verified so the agent can point `Organization.sameAs` at the GBP URL.

## 4. Purchases (§18 — budget lifted)
- [ ] **Screaming Frog** license (~$259/yr) — needed now for the 29k-URL monthly crawl (orphans/redirects/canonicals). Export CSVs → agent consumes.
- [ ] **Ahrefs Lite or Semrush Pro** (~$100–130/mo) — unlocks the keyword map (§17.6) + competitor gap vs Recovery.com/Rehabs.com. Start month 1.
- [ ] CallRail + AI-visibility tracker: later (with first claims / month 4+).

---

## Draft A — Medical reviewer recruitment email (edit + send)

> **Subject:** Clinical reviewer for Clear Bed Recovery (paid/credited, low time)
>
> Hi [Name],
>
> I'm building Clear Bed Recovery, a free, need-first directory that helps people find addiction and mental-health treatment that actually fits their situation, insurance, and region. We're a connector — we don't provide treatment, and we never sell ranking or take per-referral fees.
>
> I'm looking for a licensed clinician to serve as our medical reviewer: review our educational content for clinical accuracy, and let us publish your name, credential, and review date on the pages you've checked (standard YMYL practice). Time commitment is light and batched. In return I can offer [honorarium / credited byline + a free enhanced Anchor listing for your program / etc.].
>
> Would you be open to a 15-minute call this week?
>
> Thanks,
> Nick — Clear Bed Recovery

## Draft B — PR / resource-link pitch list (vertical + gov, YMYL-safe; no guest-post/scholarship schemes)
1. Behavioral Health Business — data-story pitch from our GA availability dataset
2. Addiction Professional — same
3. STAT News (health data desk) — original stat angle
4. Filter Magazine — harm-reduction / access angle
5. Georgia DBHDD provider/resource list — request inclusion (state agency .gov)
6. SAMHSA / findtreatment.gov partner resources — inclusion
7. Local GA recovery community orgs (GA Council on Substance Abuse) resource pages
8. University of Georgia / Emory public-health resource lists (.edu)
9. Source of Sources / Qwoted / Featured — standing queries as a data source
10. r/REDDITrecovery-adjacent subs — genuine participation only (not link drops)

## Draft C — the exact sitemap URLs to submit (agent will finalize on shard ship)
Pending Phase B sitemap sharding. Agent will replace this line with the literal GA shard URLs to paste into GSC + Bing.
