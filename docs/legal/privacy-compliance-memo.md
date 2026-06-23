# Clear Bed Recovery — Privacy & Data-Sharing Compliance Memo

**Prepared for legal review · Drafted 2026-06-23**
**NOT LEGAL ADVICE.** This is an internal information-gathering document summarizing primary
sources and the platform's current data flows, to be reviewed and corrected by a licensed
Georgia healthcare-privacy attorney before relied upon. Statutory effective dates and
applicability conclusions below must be independently verified by counsel.

---

## 1. What the platform is and does

Clear Bed Recovery is an **addiction-treatment referral directory / connector** (not a treatment
provider). A person seeking care ("Seeker"/"Recovery Friend") completes a guided intake; the
platform matches them to treatment programs ("Providers"/"Facilities") and, **with consent**, hands
their details to the chosen program(s) so the program's intake team can reach out. Facilities pay
flat subscription fees; Seekers never pay.

## 2. Data flows (as built)

1. **Anonymous browsing** — the public directory can be browsed with no account or name.
2. **De-identified match routing (always, no identity):** when a Seeker is matched, a
   **de-identified** summary is routed to matched programs — partial ZIP region (e.g. "787xx"),
   level of care, payer type, coarse concern category. **No name, contact, DOB, or address.**
   (Stored in `matches` / `match_routes`, Project A.)
3. **Identity sharing (consent-gated):** name, phone, email, and the structured intake "face sheet"
   are shared with a specific Provider **only when the Seeker set `consent_share = true`** for that
   Provider. Identity lives in a **separate, access-controlled vault (Project B)**, reachable only by
   authorized server-side processes.
4. **Contact (separately consent-gated):** `consent_contact` governs whether Clear Bed Recovery may
   reach out (e.g., by email). **Share and contact are independent opt-ins** ("Share + email me /
   Share only / Email me only / Neither").
5. **Consent logging:** each consent decision (granted/declined) is recorded with a timestamp.

## 3. Applicable frameworks (primary sources, as of 2026-06-23)

### 42 CFR Part 2 — Confidentiality of SUD Patient Records (the strictest; controls here)
- 2024 Final Rule (HHS/SAMHSA + OCR). **Compliance deadline February 16, 2026 — now in force;**
  OCR civil enforcement / complaint intake began that date.
- Key standards: a patient may give a **single consent** for future TPO uses/disclosures; SUD
  records **cannot be used to investigate or prosecute the patient without written consent or a
  court order**; HIPAA-regulated recipients may redisclose consistent with the HIPAA Privacy Rule.
- Part 2 **written consent elements** (to confirm our record captures): name of patient; specific
  name(s) or general designation of who may disclose and who may receive; **how much / what kind of
  information**; **purpose** of disclosure; **right to revoke** + how; **date/event/condition on
  which it expires**; signature + date.
- Sources: HHS fact sheet (hhs.gov/hipaa/for-professionals/regulatory-initiatives/fact-sheet-42-cfr-part-2-final-rule);
  eCFR Title 42 Part 2 (ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2).

### FTC Health Breach Notification Rule (HBNR)
- Amended rule **effective July 29, 2024**; **expressly covers health apps / similar tech NOT covered
  by HIPAA** that handle identifiable health information.
- On a breach of unsecured identifiable health info: notify affected consumers + the FTC (and media
  for large breaches); for ≥500 records, notify FTC without undue delay and **no later than 60 days**;
  the notice must **name third parties** that acquired the data and describe the health info involved.
- Source: ftc.gov/news-events/news/press-releases/2024/04/ftc-finalizes-changes-health-breach-notification-rule.

### EKRA (18 U.S.C. § 220) — already a core constraint
- Bars paying/receiving remuneration to induce referrals to recovery homes / clinical treatment
  facilities / labs; applies to **all payers**. Our model is **flat-fee, decoupled from referral
  volume/outcomes**; matching is need-based; any future paid placement must be flat-fee, clearly
  labeled advertising, and kept out of the need-based match engine.

### HIPAA — applicability question for counsel
- A pure directory/connector is often **not** a covered entity or business associate. Confirm
  whether any Provider relationship makes us a business associate, which would change obligations.

### Georgia
- **Georgia Consumer Privacy Protection Act (SB 111 / Act 462): signed by Gov. Kemp May 11, 2026.**
  - Applicability: conducts business in / targets GA **AND > $25M annual gross revenue AND**
    (≥ 175,000 GA residents' data, **or** ≥ 25,000 residents + > 50% revenue from selling data).
  - Exemptions: **HIPAA covered entities/business associates; FCRA data.**
  - **Effective date unresolved in sources (July 1, 2026 vs July 1, 2027) — VERIFY with counsel / LegiScan.**
  - **Likely conclusion:** at current scale Clear Bed Recovery is **under the $25M threshold**, so this
    law most likely does **not** yet apply — independent of effective date. Re-test as revenue grows.
- **Georgia breach-notification law applies regardless of size:** Ga. Code Ann. §§ 10-1-910 et seq.
  (notify without unreasonable delay; processors notify the data owner within 24 hours).
- Sources: recordinglaw.com/us-laws/data-privacy-laws/georgia-data-privacy-laws; LegiScan GA SB111/2025.

### Other state consumer-health-data laws (out-of-state reach) — for counsel
- **Washington My Health My Data Act** can apply to a company **anywhere** that handles a Washington
  consumer's "consumer health data." Relevant because Seekers may be nationwide. Notable features to
  assess: **separate consent for collection vs. sharing**, and a higher bar (a signed "valid
  authorization") to **sell** health data (we do not sell). Similar laws: Nevada SB 370, others.

### TCPA — the "contact" side
- Calls/texts to Seekers implicate TCPA consent (distinct from the share consent). Our `consent_contact`
  separation supports this; confirm channel-specific consent language for any phone/SMS outreach.

## 4. The core questions (factual analysis — confirm with counsel)

**Q: Are we in violation by sharing a person's submitted info if we have their consent — or are we
fine as long as we have consent?**
Consent is the **lawful basis** for disclosure under Part 2 and health-privacy laws — sharing with the
program(s) the Seeker chose, for the purpose of connecting them to care, is the **intended, permitted
use** the consent authorizes. Having consent is generally sufficient **provided**:
1. the consent is the **right kind** — for SUD data, it meets Part 2's required written-consent
   elements (§3 above), not just a vague "I agree";
2. the disclosure **stays within scope** — only the chosen program(s), only the stated purpose;
3. the consent was **voluntary and informed** (not coerced or buried);
4. **re-disclosure** by recipients is constrained per Part 2/HIPAA;
5. **independent rules** (e.g., EKRA) are satisfied — consent does not cure an unlawful referral payment.
So: *with valid, specific, properly-scoped, documented consent, sharing with the chosen programs is the
permitted path.* The residual risk is consent that fails the legal bar or sharing beyond scope —
hence the recommendation to align the consent record to the Part 2 elements.

**Q: Is this where a "double opt-in" is required — or is double opt-in only for marketing?**
"Double opt-in" (the confirm-your-email-twice pattern) is a **marketing / email-deliverability** concept
(CAN-SPAM/TCPA hygiene; proof of subscription). It is **not** the legal standard for disclosing health
records. For health-data sharing the standard is **specific, informed, affirmative (opt-in) consent**
meeting the framework's elements. Health-privacy law does use a **two-consent** idea — but it's
**separate consents for distinct actions** (collect vs. share vs. contact; and, under WA MHMD, a higher
"valid authorization" to *sell*), **not** the marketing email double opt-in. We already separate **share**
vs **contact**, which is the meaningful version. A marketing-style double opt-in would only matter for our
**email/marketing** subscription program, not for the act of sharing with a facility.

## 5. Current controls (already implemented)
- Anonymous browsing; de-identified routing with no identifiers.
- Separate, explicit `consent_share` / `consent_contact` opt-ins; consents logged with timestamps.
- Two-database vault separation for identity (Project B), access-controlled, never public.
- "We do not sell personal information; do not share for cross-context behavioral advertising."
- Need-based, non-pay-to-rank matching (EKRA posture).
- Privacy Policy §4 (sensitive health info / HIPAA + Part 2) and §5 (de-identified routing + consented
  identity sharing, now disclosed explicitly).

## 6. Recommended actions for counsel to confirm / direct
1. Confirm Part 2 status (Part 2 program vs lawful holder vs neither) and exact obligations.
2. Upgrade the recorded consent to capture the **Part 2 written-consent elements** (recipient, scope,
   purpose, revocation, expiration/event).
3. Confirm HIPAA covered-entity / business-associate status.
4. Assess **WA My Health My Data** and peer state laws given nationwide Seekers.
5. Confirm **FTC HBNR** breach-response readiness and GA §10-1-910 procedures.
6. Re-test **GA SB 111** applicability as revenue grows; verify its effective date.
7. EKRA review before any paid-placement / featured-listing revenue line.
