import 'server-only';

import { createVaultClient } from '@/lib/supabase/vault';
import { toFacilitySummary, type FacilityRowForSummary } from '@/lib/facility/summary';
import type { FacilitySummary } from '@/lib/email/templates';
import type { Json } from '@/types/database';

// PHI data-access for the vault. Every call goes through createVaultClient(), which
// throws unless HANDOFF_BAA_SIGNED=true — so nothing here can touch PHI by accident.

export type SeekerIdentity = {
  email?: string;
  name?: string;
  dob?: string;
  insurance?: string;
  phone?: string;
};

export type EmailKind = 'welcome' | 'treatment_info' | 'face_sheet' | 'weekly_reminder';

/** Store a seeker (identity + consent + full face sheet) and their interests. Returns the id. */
export async function createSeekerWithInterest(params: {
  matchId: string | null;
  identity: SeekerIdentity;
  coverageStatus?: string | null;
  consents: { email: boolean; share: boolean };
  facilityIds: string[];
  faceSheet?: Record<string, unknown>;
}): Promise<string | null> {
  const vault = createVaultClient();
  const now = new Date().toISOString();

  const { data: seeker, error } = await vault
    .from('vault_seekers')
    .insert({
      match_id: params.matchId,
      email: params.identity.email ?? null,
      name: params.identity.name ?? null,
      dob: params.identity.dob ?? null,
      insurance: params.identity.insurance ?? null,
      coverage_status: params.coverageStatus ?? null,
      phone: params.identity.phone ?? null,
      consent_email: params.consents.email,
      consent_share: params.consents.share,
      consent_at: now,
      status: 'active',
      face_sheet: (params.faceSheet ?? {}) as Json,
    })
    .select('id')
    .single();
  if (error || !seeker) return null;

  if (params.facilityIds.length) {
    await vault.from('vault_seeker_interest').insert(
      params.facilityIds.map((facility_id) => ({
        seeker_id: seeker.id,
        facility_id,
        match_id: params.matchId,
      }))
    );
  }
  return seeker.id;
}

export async function logEmail(entry: {
  seeker_id?: string | null;
  facility_id?: string | null;
  kind: EmailKind;
  to_email: string;
  provider_id?: string | null;
  meta?: Json;
}): Promise<void> {
  const vault = createVaultClient();
  await vault.from('vault_email_log').insert({
    seeker_id: entry.seeker_id ?? null,
    facility_id: entry.facility_id ?? null,
    kind: entry.kind,
    to_email: entry.to_email,
    provider_id: entry.provider_id ?? null,
    meta: entry.meta ?? {},
  });
}

/** Link a created auth account to the seeker's vault record. */
export async function setSeekerAuthUser(seekerId: string, authUserId: string): Promise<void> {
  const vault = createVaultClient();
  await vault.from('vault_seekers').update({ auth_user_id: authUserId }).eq('id', seekerId);
}

export type SeekerDashboard = {
  name: string | null;
  coverageStatus: string | null;
  faceSheet: Record<string, unknown>;
  facilities: (FacilitySummary & { id: string })[];
};

/** Load a logged-in seeker's saved info + recommended programs (for /me). */
export async function getSeekerByAuthUser(authUserId: string): Promise<SeekerDashboard | null> {
  const vault = createVaultClient();
  const { data: seeker } = await vault
    .from('vault_seekers')
    .select('id, name, coverage_status, face_sheet')
    .eq('auth_user_id', authUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!seeker) return null;

  const { data: interests } = await vault
    .from('vault_seeker_interest')
    .select(
      'facility_id, facilities(name, city, state, levels_of_care, referral_contact, facility_capacity(beds_available, last_updated), facility_payers(payer_type))'
    )
    .eq('seeker_id', seeker.id);

  const facilities = (interests ?? [])
    .map((i) => {
      const summary = toFacilitySummary(i.facilities as unknown as FacilityRowForSummary);
      return summary ? { id: i.facility_id as string, ...summary } : null;
    })
    .filter((f): f is FacilitySummary & { id: string } => f !== null);

  return {
    name: seeker.name,
    coverageStatus: seeker.coverage_status,
    faceSheet: (seeker.face_sheet as Record<string, unknown>) ?? {},
    facilities,
  };
}

export type SeekerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  insurance: string | null;
  coverage_status: string | null;
  status: string;
  created_at: string;
  face_sheet: Record<string, unknown>;
};

const SEEKER_COLS = 'id, name, email, phone, dob, insurance, coverage_status, status, created_at, face_sheet';

async function facilitiesForSeeker(
  vault: ReturnType<typeof createVaultClient>,
  seekerId: string
): Promise<(FacilitySummary & { id: string })[]> {
  const { data: interests } = await vault
    .from('vault_seeker_interest')
    .select(
      'facility_id, facilities(name, city, state, levels_of_care, referral_contact, facility_capacity(beds_available, last_updated), facility_payers(payer_type))'
    )
    .eq('seeker_id', seekerId);
  return (interests ?? [])
    .map((i) => {
      const summary = toFacilitySummary(i.facilities as unknown as FacilityRowForSummary);
      return summary ? { id: i.facility_id as string, ...summary } : null;
    })
    .filter((f): f is FacilitySummary & { id: string } => f !== null);
}

/** Admin: list all seeker records (PHI). */
export async function listSeekers(): Promise<SeekerRow[]> {
  const vault = createVaultClient();
  const { data } = await vault.from('vault_seekers').select(SEEKER_COLS).order('created_at', { ascending: false });
  return (data ?? []) as SeekerRow[];
}

/** Admin: one seeker + their matched programs. */
export async function getSeekerById(
  id: string
): Promise<{ seeker: SeekerRow; facilities: (FacilitySummary & { id: string })[] } | null> {
  const vault = createVaultClient();
  const { data: seeker } = await vault.from('vault_seekers').select(SEEKER_COLS).eq('id', id).maybeSingle();
  if (!seeker) return null;
  return { seeker: seeker as SeekerRow, facilities: await facilitiesForSeeker(vault, id) };
}

/** Seeker dashboard: every past search for this account, newest first. */
export async function getSearchesByAuthUser(
  authUserId: string
): Promise<{ search: SeekerRow; facilities: (FacilitySummary & { id: string })[] }[]> {
  const vault = createVaultClient();
  const { data: seekers } = await vault
    .from('vault_seekers')
    .select(SEEKER_COLS)
    .eq('auth_user_id', authUserId)
    .order('created_at', { ascending: false });
  const out: { search: SeekerRow; facilities: (FacilitySummary & { id: string })[] }[] = [];
  for (const s of (seekers ?? []) as SeekerRow[]) {
    out.push({ search: s, facilities: await facilitiesForSeeker(vault, s.id) });
  }
  return out;
}

export type FacilityContact = {
  interestId: string;
  seekerId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  coverageStatus: string | null;
  status: string; // vault_seekers.status: active | connected | unsubscribed
  faceSheet: Record<string, unknown>;
  sharedAt: string; // when the face sheet was sent to this facility (falls back to interest creation)
};

/**
 * Facility "Contacts": the seekers who explicitly consented to share their details
 * with THIS facility (consent_share=true). Same PHI the facility already receives by
 * email on hand-off — surfaced in-app, scoped to one facility. Callers MUST verify
 * facility membership before calling (this bypasses RLS via the service-role client).
 */
export async function listSeekerContactsForFacility(facilityId: string): Promise<FacilityContact[]> {
  const vault = createVaultClient();

  const { data: interests } = await vault
    .from('vault_seeker_interest')
    .select('id, seeker_id, created_at, info_sent_at')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false });
  if (!interests?.length) return [];

  const seekerIds = [...new Set(interests.map((i) => i.seeker_id).filter((x): x is string => !!x))];
  if (!seekerIds.length) return [];

  // Only the consented seekers — defensive, even though interest rows are only
  // created on a consented hand-off.
  const { data: seekers } = await vault
    .from('vault_seekers')
    .select('id, name, email, phone, coverage_status, status, face_sheet')
    .in('id', seekerIds)
    .eq('consent_share', true);
  const byId = new Map((seekers ?? []).map((s) => [s.id, s]));

  const out: FacilityContact[] = [];
  for (const i of interests) {
    const s = i.seeker_id ? byId.get(i.seeker_id) : null;
    if (!s) continue; // not consented / not found — never surface
    out.push({
      interestId: i.id,
      seekerId: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      coverageStatus: s.coverage_status,
      status: s.status,
      faceSheet: (s.face_sheet as Record<string, unknown>) ?? {},
      sharedAt: i.info_sent_at ?? i.created_at,
    });
  }
  return out;
}

/** Seeker self-edit: update their own identity fields (scoped to their account). */
export async function updateMyInfo(
  authUserId: string,
  seekerId: string,
  patch: { name?: string; email?: string; phone?: string; dob?: string; insurance?: string }
): Promise<void> {
  const vault = createVaultClient();
  await vault
    .from('vault_seekers')
    .update({
      name: patch.name ?? null,
      email: patch.email ?? null,
      phone: patch.phone ?? null,
      dob: patch.dob ?? null,
      insurance: patch.insurance ?? null,
    })
    .eq('id', seekerId)
    .eq('auth_user_id', authUserId);
}

export async function markInterestInfoSent(seekerId: string, facilityId: string): Promise<void> {
  const vault = createVaultClient();
  await vault
    .from('vault_seeker_interest')
    .update({ info_sent_at: new Date().toISOString() })
    .eq('seeker_id', seekerId)
    .eq('facility_id', facilityId);
}

/** Mark a seeker converted (stop reminding) — keyed by their de-identified match. */
export async function markSeekerConnectedByMatch(matchId: string): Promise<void> {
  const vault = createVaultClient();
  await vault.from('vault_seekers').update({ status: 'connected' }).eq('match_id', matchId);
}

export type ReminderCandidate = {
  seekerId: string;
  email: string;
  name: string | null;
  facilities: FacilitySummary[];
};

/** Active seekers who consented to email, haven't converted, and are due a nudge. */
export async function getReminderCandidates(daysSince = 7): Promise<ReminderCandidate[]> {
  const vault = createVaultClient();
  const cutoff = new Date(Date.now() - daysSince * 86_400_000).toISOString();

  const { data: seekers } = await vault
    .from('vault_seekers')
    .select('id, email, name, last_reminded_at')
    .eq('status', 'active')
    .eq('consent_email', true)
    .not('email', 'is', null)
    .lte('created_at', cutoff);

  const candidates: ReminderCandidate[] = [];
  for (const s of seekers ?? []) {
    if (!s.email) continue;
    if (s.last_reminded_at && s.last_reminded_at > cutoff) continue; // already nudged this window

    const { data: interests } = await vault
      .from('vault_seeker_interest')
      .select(
        'facilities(name, city, state, levels_of_care, referral_contact, facility_capacity(beds_available, last_updated), facility_payers(payer_type))'
      )
      .eq('seeker_id', s.id);

    const facilities = (interests ?? [])
      .map((i) => toFacilitySummary(i.facilities as unknown as FacilityRowForSummary))
      .filter((f): f is FacilitySummary => f !== null);

    if (facilities.length) {
      candidates.push({ seekerId: s.id, email: s.email, name: s.name, facilities });
    }
  }
  return candidates;
}

export async function markReminded(seekerId: string): Promise<void> {
  const vault = createVaultClient();
  await vault
    .from('vault_seekers')
    .update({ last_reminded_at: new Date().toISOString() })
    .eq('id', seekerId);
}
