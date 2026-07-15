import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { toFacilitySummary, type FacilityRowForSummary } from '@/lib/facility/summary';
import { sendEmail } from '@/lib/email/send';
import { welcomeEmail, treatmentInfoEmail, seekerAccountEmail } from '@/lib/email/templates';
import {
  createSeekerWithInterest,
  logConsentEvents,
  logEmail,
  setSeekerAuthUser,
} from '@/lib/vault/seekers';
import { upsertConversation } from '@/lib/vault/conversations';

// Seeker "complete & connect" endpoint.
//
// PATH A — we are a CONNECTOR, not a provider. The client posts the answers gathered in
// the conversation; we read ONLY what is needed to make an INTRODUCTION (name, contact,
// insurance carrier, consent) and persist ONLY that. The answers blob is TRANSIENT and
// is never stored. No DOB, no substances/medications/diagnoses, no member IDs, no face
// sheet — the clinical intake belongs to the facility, in the facility's own system.
//
// Do NOT re-add persistence of the raw blob: that rebuilds a clinical record in a
// non-BAA database. Storing PHI requires the project-b preconditions (BAA + HIPAA
// add-on + security review + 42 CFR Part 2 / EKRA sign-off) — not a feature flag.

/** Transient intake answers from the conversation. Read-only; never persisted. */
type IntakeAnswers = Record<string, unknown>;
type ChatMsg = { role: 'user' | 'assistant'; content: string };
type Body = {
  match_id?: string;
  contact_id?: string; // the early lead captured at the start of the conversation
  facility_ids?: string[];
  face_sheet?: IntakeAnswers; // legacy wire name; transient answers blob — never persisted
  consents?: { email?: boolean; share?: boolean };
  // The conversation transcript + matched-program snapshot, sent so an anonymous
  // chat is saved to the seeker's history the moment their account is created.
  messages?: ChatMsg[];
  matched_facilities?: { id: string; name: string; city: string | null; state: string | null }[];
};

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const matchId = typeof body.match_id === 'string' ? body.match_id : '';
  const facilityIds = Array.isArray(body.facility_ids)
    ? body.facility_ids.filter((x): x is string => typeof x === 'string')
    : [];
  if (!matchId || facilityIds.length === 0) {
    return Response.json({ error: 'match_id and facility_ids are required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: facRows } = await supabase
    .from('facilities')
    .select(
      'id, name, city, state, levels_of_care, referral_contact, facility_capacity(beds_available, last_updated), facility_payers(payer_type)'
    )
    .in('id', facilityIds)
    .eq('is_published', true);
  const facilities = facRows ?? [];
  if (facilities.length === 0) {
    return Response.json({ error: 'No matching facilities' }, { status: 404 });
  }

  // The face-sheet auto-send to facilities (a full SUD referral packet emailed to third
  // parties) has been REMOVED outright, not just flag-disabled — there is no longer a
  // face sheet to send. Facilities get contact details in-app and run their own intake.
  const baaInPlace = process.env.HANDOFF_BAA_SIGNED === 'true';

  // ── Fallback (no BAA): no PHI stored or sent — return public contacts only ──
  if (!baaInPlace) {
    return Response.json({
      ok: true,
      mode: 'direct',
      facilities: facilities.map((f) => ({ id: f.id, name: f.name, referral_contact: f.referral_contact })),
    });
  }

  // ── Connect path (contact only — no PHI stored) ─────────────────────────────
  const fs = (body.face_sheet ?? {}) as IntakeAnswers;
  const consents = {
    email: body.consents?.email ?? fs.consent_contact === true,
    share: body.consents?.share ?? fs.consent_share === true,
  };

  // De-identified match details (concern/coverage/region) — these live on `matches`,
  // keyed only by match_id, and are never joined to a person outside this request.
  const { data: match } = await supabase
    .from('matches')
    .select('concern_category, coverage_status, region_zip3')
    .eq('id', matchId)
    .maybeSingle();

  // The ONLY fields we keep: enough to make an introduction. No DOB, no clinical detail,
  // no member IDs. Everything else in `fs` stays transient and dies with this request.
  const identity = {
    name: str(fs.full_name),
    phone: str(fs.phone),
    email: str(fs.email),
    insurance: str(fs.insurance_carrier),
  };

  const seekerId = await createSeekerWithInterest({
    matchId,
    contactId: typeof body.contact_id === 'string' ? body.contact_id : null,
    identity,
    coverageStatus: match?.coverage_status ?? null,
    consents,
    facilityIds,
  });

  // Immutable record of exactly what they answered (yes AND no), and when.
  await logConsentEvents({ seekerId, matchId, consents, source: 'intake_handoff' });

  const summaries = facilities
    .map((f) => toFacilitySummary(f as unknown as FacilityRowForSummary))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // /match is anonymous-start by design — the seeker may have no account here. If
  // they happen to be signed in, link this search to their account (so it shows on
  // /me + their history) and skip creating a duplicate login. Otherwise the branch
  // below creates one ONLY when they consented to email and gave an address.
  const {
    data: { user: sessionUser },
  } = await (await createClient()).auth.getUser();
  // The account this search/transcript ends up attached to (existing session, a
  // freshly-created seeker login, or a matched existing account).
  let authUserId: string | null = sessionUser?.id ?? null;
  // True only when we mint a brand-new login for an anonymous seeker — drives the
  // "we created an account for you, check your email" reassurance in the UI.
  let accountCreated = false;
  if (sessionUser && seekerId) await setSeekerAuthUser(seekerId, sessionUser.id);

  // Seeker account + emails. With consent + an address, email their info + matches.
  // Signed-in seekers already have a login (just send welcome + recommendations);
  // otherwise create one (or link an existing account) and send credentials.
  if (consents.email && identity.email) {
    if (sessionUser) {
      // Already signed in — just send the welcome + recommendations to their inbox.
      const w = welcomeEmail(identity.name);
      const wRes = await sendEmail({ to: identity.email, ...w });
      await logEmail({ seeker_id: seekerId, kind: 'welcome', to_email: identity.email, provider_id: wRes.id });
      const t = treatmentInfoEmail(identity.name, summaries);
      const tRes = await sendEmail({ to: identity.email, ...t });
      await logEmail({ seeker_id: seekerId, kind: 'treatment_info', to_email: identity.email, provider_id: tRes.id });
    } else {
      const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login`;
      const tempPassword = `WC-${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}`;
      const { data: created } = await supabase.auth.admin.createUser({
        email: identity.email,
        password: tempPassword,
        email_confirm: true,
        // They accepted the terms in-chat; force a real password on first sign-in.
        user_metadata: {
          role: 'seeker',
          name: identity.name ?? null,
          must_reset_password: true,
          terms_accepted_at: new Date().toISOString(),
        },
      });

      if (created?.user) {
        authUserId = created.user.id;
        accountCreated = true;
        if (seekerId) await setSeekerAuthUser(seekerId, created.user.id);
        const acct = seekerAccountEmail({
          email: identity.email,
          password: tempPassword,
          loginUrl,
          facilities: summaries,
        });
        const r = await sendEmail({ to: identity.email, ...acct });
        await logEmail({ seeker_id: seekerId, kind: 'welcome', to_email: identity.email, provider_id: r.id });
      } else {
        // Account already exists — link this new search to it so it shows on /me.
        try {
          const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existing = list?.users.find((u) => u.email?.toLowerCase() === identity.email!.toLowerCase());
          if (existing) {
            authUserId = existing.id;
            if (seekerId) await setSeekerAuthUser(seekerId, existing.id);
          }
        } catch {
          /* best-effort */
        }
        const w = welcomeEmail(identity.name);
        const wRes = await sendEmail({ to: identity.email, ...w });
        await logEmail({ seeker_id: seekerId, kind: 'welcome', to_email: identity.email, provider_id: wRes.id });
        const t = treatmentInfoEmail(identity.name, summaries);
        const tRes = await sendEmail({ to: identity.email, ...t });
        await logEmail({ seeker_id: seekerId, kind: 'treatment_info', to_email: identity.email, provider_id: tRes.id });
      }
    }
  }

  // Save the chat transcript to the seeker's private history, linked to their account
  // (only possible once an account exists — i.e. they consented + gave an email).
  const transcript = Array.isArray(body.messages)
    ? body.messages.filter(
        (m): m is ChatMsg =>
          !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
      )
    : [];
  if (authUserId && transcript.length) {
    const firstUser = transcript.find((m) => m.role === 'user');
    try {
      await upsertConversation({
        authUserId,
        title: firstUser ? firstUser.content.slice(0, 80) : null,
        messages: transcript,
        matchId: matchId || null,
        matchedFacilities: Array.isArray(body.matched_facilities) ? body.matched_facilities : [],
      });
    } catch {
      /* best-effort — history save never blocks the hand-off */
    }
  }

  // NOTE: there is deliberately NO outbound send of seeker details to facilities here.
  // Consented contact details are surfaced to the facility in-app (Contacts), where the
  // facility runs its own intake. Emailing a referral packet to third-party inboxes is
  // exactly what 42 CFR Part 2 governs — do not reintroduce it.

  return Response.json({
    ok: true,
    mode: 'forward',
    shared: consents.share,
    accountCreated,
    facilities: facilities.map((f) => ({ id: f.id, name: f.name, referral_contact: f.referral_contact })),
  });
}
