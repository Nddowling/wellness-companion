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
