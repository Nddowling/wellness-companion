# DRAFT — Part 2-aligned consent: copy + fields to log

**Drafted 2026-06-23 · FOR LEGAL REVIEW — do NOT ship the wording live until counsel approves it.**
Companion to [privacy-compliance-memo.md](./privacy-compliance-memo.md). Maps to 42 CFR § 2.31(a)
required consent elements. Counsel to confirm Part 2 applicability and finalize the language.

---

## A. Seeker-facing consent copy (draft)

Shown at the share step of `/match` (and/or linked as "full consent"). Plain-language, element-tagged.
Bracketed `[…]` = configurable/merge values.

> **Share your information with the programs you chose**
>
> By choosing **"Share my details,"** you authorize **Clear Bed Recovery** ⟶ *[#2 discloser]* to share
> **your name, phone number, email address, and the intake summary you provided** (the level of care
> you need, your insurance/coverage, and the concern you described) ⟶ *[#3 specific description of the
> information]* with **the specific treatment program(s) you selected from your matches:
> [Program A, Program B…]** ⟶ *[#4 named recipients]* **so their intake team can contact you and help
> you get into care** ⟶ *[#5 purpose].*
>
> You can **withdraw this consent at any time** — [from your account settings / by emailing
> privacy@clearbedrecovery.com] — except where a program has already acted on it ⟶ *[#6 right to
> revoke + how].* This consent **expires one year from today, when you withdraw it, or when your
> referral request is fulfilled — whichever comes first** ⟶ *[#7 expiration event].*
>
> These records are protected by **federal law (42 CFR Part 2)**. The program that receives them
> **may not re-disclose them** without your consent except as the law allows, and your records
> **may not be used to investigate or prosecute you** without your written consent or a court order
> ⟶ *[#10 required statements / redisclosure + legal-use notice].* **You are not required to share**,
> and declining will not affect your ability to browse programs or contact them yourself ⟶ *[#10
> consequences of refusal].*
>
> Tapping **"Share my details"** is your **electronic signature**, dated now ⟶ *[#8 signature, #9 date].*

**Contact (separate, keep distinct):**
> **May we also reach out to you?** — [Email me] / [Call or text me] / [No, don't contact me].
> (If phone/SMS is selected, add the TCPA-style line: "You agree we may call/text you at the number
> you gave, including by automated means; consent isn't a condition of any service; msg/data rates
> may apply; reply STOP to opt out.")

Present as: a concise affirmation button + the full statement visible or one tap away (an expandable
"What am I agreeing to?"). The four "Share + email me / Share only / Email me only / Neither" chips can
remain the control, but the **full consent text must be presented**, not just the chip label.

## B. Fields to log (consent record)

Recorded at the moment of consent (server-side, in the identity vault — Project B — alongside the
existing `consent_share` / `consent_contact` booleans). Proposed `consent_records` shape:

| Field | Type | Example / notes |
|---|---|---|
| `id` | uuid | consent record id |
| `seeker_id` | uuid | FK to vault_seekers |
| `match_id` | uuid | the match this consent was given against |
| `kind` | text | `share` \| `contact` (one row each — they're separate consents) |
| `granted` | boolean | true = consented, false = declined |
| `patient_name` | text | #1 |
| `discloser` | text | `"Clear Bed Recovery"` (#2) |
| `info_disclosed` | jsonb | #3 — e.g. `["name","phone","email","intake_summary"]` + the description string shown |
| `recipients` | jsonb | #4 — `[{facility_id, facility_name}]` the consent actually covers |
| `purpose` | text | #5 — `"intake outreach to connect to care"` |
| `revocation_method` | text | #6 — how they can revoke (matches the copy) |
| `expires_at` | timestamptz | #7 — now + 1yr (or null + `expiration_event`) |
| `expiration_event` | text | #7 — `"withdrawal or referral fulfilled, whichever first"` |
| `signature_method` | text | #8 — `"electronic: tap/checkbox"` |
| `signed_at` | timestamptz | #9 — server timestamp |
| `ip_address` | text | evidence of signing (best-effort) |
| `user_agent` | text | evidence of signing (best-effort) |
| `consent_text_version` | text | which wording they agreed to (e.g. `"2026-06-23"`) — bump on any copy change |
| `statements_shown` | jsonb | `{redisclosure:true, legal_use:true, no_condition:true, tcpa:true|false}` |
| `revoked_at` | timestamptz | set when withdrawn; sharing stops going forward |
| `created_at` | timestamptz | default now() |

Notes:
- **Versioned wording**: `consent_text_version` ties each logged consent to the exact text shown, so a
  later copy change never retroactively misrepresents what someone agreed to.
- **Recipients are explicit**: store the actual `facility_id`s the consent covers, so a disclosure can
  be proven in-scope (don't share with programs not on this list).
- **Revocation is honored forward-only** (Part 2 allows reliance already acted upon).
- Keep `share` and `contact` as **separate rows** so each can be independently granted/revoked/proven.

## C. Where it plugs in (implementation outline — after counsel signs off)

1. **Copy**: render the approved statement at the `/match` share step (`src/lib/intake/prompt.ts`
   chip flow + a visible/expandable consent block); add `CONSENT_TEXT_VERSION` constant.
2. **Recording**: in `src/app/api/handoff/route.ts` (`record_identity`), write a `consent_records`
   row per kind with the fields above (capture IP/UA from the request).
3. **Schema**: new `consent_records` table in the **Project B vault** (migration under
   `supabase/project-b/migrations/`). NOTE: Project B is the HIPAA vault and is **not** connected to
   the assistant's tooling — this migration must be applied by the team, not the assistant.
4. **Revocation UI**: a control in the Seeker account (`/me`) + an email path; setting `revoked_at`
   excludes the seeker from `listFacilityContacts` going forward.
5. **Display**: facilities continue to see identity only when a *share* consent is granted and not
   revoked (already enforced via `consent_share`); this just makes the record audit-grade.

## D. Open items for counsel
- Confirm Part 2 applicability (program vs lawful holder) → which elements are mandatory vs best-practice.
- Approve the **exact consent wording** (Section A) before it ships.
- Confirm the **expiration period** (1 year vs other) and revocation mechanics.
- Confirm TCPA language for phone/SMS contact.
- Confirm retention of consent records and revoked records.
