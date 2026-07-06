# Claude Browser QA Runbook — Clear Bed Recovery

A literal, click-by-click script for an AI browser agent (Claude for Chrome) to walk the
site and report results. Written for a clunky agent: **every step is one action**, you
**navigate by typing the full URL into the address bar** (do NOT hunt for nav links —
the site menu is a floating hamburger that's easy to miss), and you **verify by reading
visible text**, not by guessing.

---

## ⛔ READ THIS FIRST — ground rules

1. **Two possible targets. Know which one you're on:**
   - **PRODUCTION** = `https://clearbedrecovery.com` → **READ-ONLY**. You may click, scroll,
     read, and navigate. **NEVER submit a form, never finish the /match chat, never send a
     claim or upgrade.** Doing so creates real junk data and may email real facilities.
   - **PREVIEW** = a `…vercel.app` URL the human gives you → you MAY submit forms here.
2. **Test classes are tagged `[PROD-OK]` or `[PREVIEW-ONLY]`.** If you're on production,
   **SKIP every `[PREVIEW-ONLY]` step** and write "SKIPPED — prod" in the result.
3. **Any data you ever type into a form must contain the exact tag:** `QA TEST — DO NOT CONTACT`.
   For emails use `qa+something@clearbedrecovery.com`.
4. **One test at a time.** After each test, write a result line (see the template at the
   bottom) BEFORE starting the next. Do not batch.
5. **When a page looks blank or wrong:** wait 3 seconds, then **scroll to the very bottom**
   before deciding it failed — crisis info and footers live at the bottom.
6. **How to record PASS/FAIL:** PASS = the Expected result is visibly true. FAIL = it's not,
   OR the page shows "Application error", "500", "something went wrong", or is blank.
   For any FAIL, **take a screenshot and copy the exact URL and any error text.**

---

## Class 1 — Crisis resources (P0, `[PROD-OK]`)

> If any of these FAIL, stop and flag it as **site-down severity**. A recovery directory
> must always show the 988 line.

**Test C1 — 988 is visible on every key page**

Do this once per URL in the list below. For EACH:
1. Click the browser address bar, type the URL exactly, press Enter.
2. Wait 3 seconds for the page to finish loading.
3. Press `Ctrl+F` (or `Cmd+F`), type `988`, press Enter.
4. Confirm the page highlights/scrolls to a visible `988`.
5. Record PASS (988 found) or FAIL (not found) for that URL.

URLs to check:
- `https://clearbedrecovery.com/`
- `https://clearbedrecovery.com/programs`
- `https://clearbedrecovery.com/match`
- `https://clearbedrecovery.com/for-providers`
- `https://clearbedrecovery.com/about`
- `https://clearbedrecovery.com/privacy`

**Test C2 — homepage crisis links are tappable**
1. Go to `https://clearbedrecovery.com/`.
2. Scroll ALL the way to the bottom of the page.
3. Find the "Crisis" area. Confirm you see a link "Emergency — 911" and a link "Crisis — 988".
4. Hover each; confirm they are links (they point to `tel:911` and `tel:988`).
5. **Do NOT actually place a call.** Record PASS if both links are present, else FAIL.

---

## Class 2 — Seeker public browsing (`[PROD-OK]`, read-only)

**Test S1 — homepage core promise**
1. Go to `https://clearbedrecovery.com/`.
2. Wait for load. Confirm the big heading reads **"You don't have to figure this out alone."**
3. Confirm you can see the words **"No account required"** somewhere near the top.
4. Record PASS/FAIL.

**Test S2 — directory hub pages all load**

For EACH URL below: type it in the address bar, Enter, wait 3s, confirm the page shows
real content and **NOT** "Application error / 500 / something went wrong". Record one
PASS/FAIL per URL.
- `https://clearbedrecovery.com/programs`
- `https://clearbedrecovery.com/insurance`
- `https://clearbedrecovery.com/guides`
- `https://clearbedrecovery.com/library`
- `https://clearbedrecovery.com/pricing`
- `https://clearbedrecovery.com/how-we-make-money`
- `https://clearbedrecovery.com/resources`
- `https://clearbedrecovery.com/treatment`  ← if this shows 404, that's EXPECTED (note it, not a fail)

**Test S3 — open one program and confirm a way to act**
1. Go to `https://clearbedrecovery.com/programs`.
2. Wait for the list. Click the FIRST program card/link in the list.
3. Confirm the detail page shows a program **name (a heading)**.
4. Confirm there is a way to act: a phone link OR a "Contact" button/link.
5. Record PASS/FAIL. (If the programs list is empty, record "SKIPPED — empty list".)

**Test S4 — spot-check for broken links**
1. Go to `https://clearbedrecovery.com/`.
2. Click these one at a time, each time confirming the destination loads (no error), then
   press the browser Back button:
   - the "Browse programs" / programs link
   - the "Library" link
   - the "Pricing" link
   - the "For providers" (or similar) link
3. Record PASS if all four loaded, else list which failed.

---

## Class 3 — Seeker match flow (`[PREVIEW-ONLY]` — writes data)

> On PRODUCTION: do ONLY step 1–2 (loading the page is read-only), then STOP and write
> "SKIPPED remainder — prod". Never complete the chat on prod.

**Test M1 — match page loads with no login wall `[PROD-OK]`**
1. Go to `{TARGET}/match` (prod is fine for this step).
2. Confirm the chat/intake interface appears and it does **NOT** demand you sign in / log in.
3. Record PASS/FAIL.

**Test M2 — complete the intake as a QA seeker `[PREVIEW-ONLY]`**
> Only on a `…vercel.app` preview URL.
1. Go to `{PREVIEW}/match`.
2. Work through the conversation. Whenever it asks for a name, type: `QA TEST — DO NOT CONTACT`.
3. Whenever it asks for contact info / email, type: `qa+seeker@clearbedrecovery.com`.
4. Give plausible answers to the care questions (e.g. location a US ZIP like `30301`,
   level of care "residential", payer "self pay").
5. Continue until you reach a **confirmation / results screen** (matched programs or a
   "we've got it" message).
6. Record PASS (confirmation reached) or FAIL (error / stuck). Note where it got stuck.

---

## Class 4 — Access control, signed OUT (`[PROD-OK]`, read-only)

> Goal: confirm the app locks its private areas. You are NOT logged in for this class.
> If you're currently logged in, open a fresh incognito window first.

**Test A1 — private pages bounce you to login**

For EACH URL: type it in the address bar, Enter, wait 3s. Expected: the URL changes to a
**/login** page (you get redirected). Record PASS if it landed on login, FAIL if the
private page rendered.
- `https://clearbedrecovery.com/me`
- `https://clearbedrecovery.com/conversations`
- `https://clearbedrecovery.com/facility`
- `https://clearbedrecovery.com/partners`
- `https://clearbedrecovery.com/rep`

**Test A2 — admin is locked when signed OUT**
1. Go to `https://clearbedrecovery.com/admin`.
2. Expected: you are redirected to a **plain `/login`** page (URL is just
   `…/login`, with **NO** `error=not_authorized` — that tag only appears when a
   signed-in NON-admin tries `/admin`, which is covered in Test L2).
3. Record PASS/FAIL (note the final URL you landed on).

**Test A3 — login page works structurally `[PROD-OK]` (do not submit real creds)**
1. Go to `https://clearbedrecovery.com/login`.
2. Confirm there is an **Email** field, a **Password** field, and a **Sign in** button.
3. Confirm there is a **"Forgot password"** link.
4. **Do not submit.** Record PASS if all elements are present.

---

## Class 5 — Role lanes, signed IN (`[PROD-OK]` read-only, needs QA login)

> The human must give you a QA login for the lane BEFORE this class. Use only accounts
> named/tagged as QA. Log in at `{TARGET}/login` with the email + password provided, click
> "Sign in", wait for redirect. Then run the matching test below.

**Test L1 — SEEKER lane**
1. Log in with the SEEKER QA account.
2. Expected after login: you land on **/me**.
3. Now type `https://clearbedrecovery.com/partners` in the address bar, Enter.
4. Expected: you are redirected BACK to **/me** (you cannot enter another lane).
5. Record PASS/FAIL for both the landing page and the redirect.

**Test L2 — FACILITY lane**
1. Log in with the FACILITY QA account.
2. Expected after login: you land on a **/facility** page (your facility dashboard).
3. Type `https://clearbedrecovery.com/partners`, Enter → expected: redirected back to your
   /facility page.
4. Type `https://clearbedrecovery.com/admin`, Enter → expected: bounced to login with
   `error=not_authorized`.
5. Record PASS/FAIL for each.

**Test L3 — PARTNER lane**
1. Log in with the PARTNER QA account.
2. Expected landing: **/partners**.
3. Confirm you can see a Search / Saved / Lists area.
4. Type `https://clearbedrecovery.com/me`, Enter → expected: redirected back to /partners.
5. Record PASS/FAIL.

**Test L4 — REP lane**
1. Log in with the REP QA account.
2. Expected landing: **/rep** (your profile).
3. Type `https://clearbedrecovery.com/facility`, Enter → expected: redirected back to /rep.
4. Record PASS/FAIL.

**Test L5 — ADMIN lane**
1. Log in with the ADMIN QA account.
2. Expected landing: **/admin**.
3. Confirm the admin dashboard renders (facilities / seekers / reviews links).
4. Record PASS/FAIL. **Do not delete or edit anything** — just confirm it loads.

> After each lane test, **log out** before testing the next lane (open the account menu →
> Sign out), or use a fresh incognito window.

---

## Class 6 — Facility claim & upgrade (`[PREVIEW-ONLY]` — writes data)

> Requires the seeded **"ZZZ QA Test Facility"** on the preview. Skip entirely on prod.

**Test F1 — claim the QA facility `[PREVIEW-ONLY]`**
1. On the PREVIEW, go to `{PREVIEW}/programs` (or the search) and search for
   `ZZZ QA Test Facility`.
2. Open it, click the **Claim** button/link.
3. In the claim form, use name `QA TEST — DO NOT CONTACT`, email `qa+claim@clearbedrecovery.com`.
4. Submit. Expected: a confirmation message ("claim submitted / pending").
5. Record PASS/FAIL. Never do this against the real `ZZZ` on production.

**Test F2 — upgrade interest form `[PREVIEW-ONLY]`**
1. On the PREVIEW, go to `{PREVIEW}/pricing`.
2. Click an upgrade / "Get started" CTA on a paid tier.
3. Fill any contact fields with the QA tag + `qa+upgrade@clearbedrecovery.com`.
4. Submit. Expected: a success/confirmation state.
5. Record PASS/FAIL.

---

## Class 7 — Responsive & visual spot-check (`[PROD-OK]`)

**Test V1 — mobile viewport**
1. Open the browser's device/mobile emulation (or narrow the window to ~375px wide).
2. Go to `https://clearbedrecovery.com/`.
3. Confirm: the layout isn't broken, text isn't cut off, the menu button is reachable,
   and the hero + a search/start entry are visible.
4. Repeat for `/match` and `/pricing`.
5. Record PASS/FAIL per page; screenshot anything that looks broken.

**Test V2 — no obvious visual breakage**
1. On desktop width, load `/`, `/programs`, `/pricing`, `/about`.
2. Look for overlapping text, missing images (broken-image icons), or huge empty gaps.
3. Record PASS/FAIL with screenshots of anything off.

---

## Result log — fill this in as you go

Copy this table into your report. One row per test you ran.

| Test ID | Target (prod/preview) | Result | Notes / error text / screenshot |
|---------|----------------------|--------|---------------------------------|
| C1 (/) | prod | PASS |  |
| C1 (/programs) | prod |  |  |
| … | | | |

**At the end, give a summary:** total PASS, total FAIL, total SKIPPED, and a bulleted list
of every FAIL with its URL and what you saw. Flag any **Class 1 (crisis)** failure at the
top as urgent.
