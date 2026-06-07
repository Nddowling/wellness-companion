import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { toFacilitySummary, type FacilityRowForSummary } from '@/lib/facility/summary';
import { sendEmail } from '@/lib/email/send';
import {
  welcomeEmail,
  treatmentInfoEmail,
  faceSheetEmail,
  seekerAccountEmail,
  type SeekerFaceSheet,
} from '@/lib/email/templates';
import {
  createSeekerWithInterest,
  logConsentEvents,
  logEmail,
  markInterestInfoSent,
  setSeekerAuthUser,
} from '@/lib/vault/seekers';

// Seeker "complete & connect" endpoint.
//
// The Companion gathers a full referral face sheet in the conversation; the client
// sends it here with the recommended facilities. When HANDOFF_BAA_SIGNED=true (BAA +
// HIPAA add-on + 42 CFR Part 2 / EKRA review in place): the face sheet is stored in
// the PHI vault, the seeker gets a welcome + treatment-info email, and each facility
// the seeker consented to share with gets the face sheet so their intake team has it
// in hand. Otherwise: nothing is stored or emailed — we return public contacts only.

type FaceSheet = Record<string, unknown>;
type Body = {
  match_id?: string;
  facility_ids?: string[];
  face_sheet?: FaceSheet;
  consents?: { email?: boolean; share?: boolean };
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

  const baaInPlace = process.env.HANDOFF_BAA_SIGNED === 'true';

  // ── Fallback (no BAA): no PHI stored or sent — return public contacts only ──
  if (!baaInPlace) {
    return Response.json({
      ok: true,
      mode: 'direct',
      facilities: facilities.map((f) => ({ id: f.id, name: f.name, referral_contact: f.referral_contact })),
    });
  }

  // ── Compliant PHI path ─────────────────────────────────────────────────────
  const fs = (body.face_sheet ?? {}) as FaceSheet;
  const consents = {
    email: body.consents?.email ?? fs.consent_contact === true,
    share: body.consents?.share ?? fs.consent_share === true,
  };

  // De-identified match details complete the face sheet (concern/coverage/region).
  const { data: match } = await supabase
    .from('matches')
    .select('concern_category, coverage_status, region_zip3')
    .eq('id', matchId)
    .maybeSingle();

  const identity = {
    name: str(fs.full_name),
    dob: str(fs.dob),
    phone: str(fs.phone),
    email: str(fs.email),
    insurance: str(fs.insurance_carrier),
  };

  const seekerId = await createSeekerWithInterest({
    matchId,
    identity,
    coverageStatus: match?.coverage_status ?? null,
    consents,
    facilityIds,
    faceSheet: fs,
  });

  // Immutable record of exactly what they answered (yes AND no), and when.
  await logConsentEvents({ seekerId, matchId, consents, source: 'intake_handoff' });

  const summaries = facilities
    .map((f) => toFacilitySummary(f as unknown as FacilityRowForSummary))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // The full face sheet sent to each facility the seeker consented to share with.
  const sheet: SeekerFaceSheet = {
    name: str(fs.full_name),
    preferred_name: str(fs.preferred_name),
    dob: str(fs.dob),
    phone: str(fs.phone),
    contact_pref: str(fs.contact_pref),
    email: str(fs.email),
    city: str(fs.city),
    state: str(fs.state),
    zip: str(fs.zip),
    language: str(fs.language),
    insurance_carrier: str(fs.insurance_carrier),
    insurance_member_id: str(fs.insurance_member_id),
    insurance_group: str(fs.insurance_group),
    subscriber_name: str(fs.subscriber_name),
    subscriber_relationship: str(fs.subscriber_relationship),
    secondary_insurance: str(fs.secondary_insurance),
    coverage_status: match?.coverage_status ?? undefined,
    concern_category: match?.concern_category ?? undefined,
    region_zip3: match?.region_zip3 ?? undefined,
    other_substances: str(fs.other_substances),
    last_use: str(fs.last_use),
    co_occurring_mh: str(fs.co_occurring_mh),
    prior_treatment: str(fs.prior_treatment),
    medications: str(fs.medications),
    allergies: str(fs.allergies),
    emergency_contact_name: str(fs.emergency_contact_name),
    emergency_contact_relationship: str(fs.emergency_contact_relationship),
    emergency_contact_phone: str(fs.emergency_contact_phone),
    court_ordered: str(fs.court_ordered),
    urgency: str(fs.urgency),
    transportation_needs: str(fs.transportation_needs),
  };

  // The chat now requires a login, so the seeker is normally already signed in:
  // link this search to their account (it then shows on /me + their history) and
  // skip creating a duplicate login. The no-session branch below is kept for the
  // legacy/anonymous path.
  const {
    data: { user: sessionUser },
  } = await (await createClient()).auth.getUser();
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
        user_metadata: { role: 'seeker', name: identity.name ?? null },
      });

      if (created?.user) {
        if (seekerId) await setSeekerAuthUser(seekerId, created.user.id);
        const acct = seekerAccountEmail({
          email: identity.email,
          password: tempPassword,
          loginUrl,
          faceSheet: sheet,
          facilities: summaries,
        });
        const r = await sendEmail({ to: identity.email, ...acct });
        await logEmail({ seeker_id: seekerId, kind: 'welcome', to_email: identity.email, provider_id: r.id });
      } else {
        // Account already exists — link this new search to it so it shows on /me.
        try {
          const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existing = list?.users.find((u) => u.email?.toLowerCase() === identity.email!.toLowerCase());
          if (existing && seekerId) await setSeekerAuthUser(seekerId, existing.id);
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

  if (consents.share) {
    for (const f of facilities) {
      const contact = (f.referral_contact ?? {}) as { email?: string };
      if (!contact.email) continue;
      const fsEmail = faceSheetEmail(f.name, sheet);
      const res = await sendEmail({ to: contact.email, ...fsEmail });
      await logEmail({
        seeker_id: seekerId,
        facility_id: f.id,
        kind: 'face_sheet',
        to_email: contact.email,
        provider_id: res.id,
      });
      if (seekerId) await markInterestInfoSent(seekerId, f.id);
    }
  }

  return Response.json({
    ok: true,
    mode: 'forward',
    shared: consents.share,
    facilities: facilities.map((f) => ({ id: f.id, name: f.name, referral_contact: f.referral_contact })),
  });
}
