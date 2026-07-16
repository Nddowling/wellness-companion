import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

// Lead data-access. PATH A: we are a CONNECTOR, not a provider — we store only what is
// needed to make an INTRODUCTION: the person's consented name, email, and phone. We do
// not store a home address, DOB, insurance/member identifiers, clinical detail
// (substances/medications/diagnoses), or a face sheet. The clinical record belongs to
// the facility, in the facility's own system.
// Re-enabling PHI storage requires the project-b preconditions (BAA + HIPAA add-on +
// security review + 42 CFR Part 2 / EKRA sign-off) — not a feature flag.

export type SeekerIdentity = {
  name?: string;
  email?: string;
  phone?: string;
};

export type EmailKind = 'treatment_info';

// These legacy `vault_*` table names now hold connector lead records only. They
// contain minimal contact and consent data, never clinical intake or transcripts.
const createLeadClient = createAdminClient;

export type ConnectorHandoffResult = {
  seekerId: string | null;
  consentEmail: boolean;
  consentShare: boolean;
  sharedFacilityCount: number;
  alreadyCompleted: boolean;
};

type ConnectorRpcClient = {
  rpc: (
    name: 'complete_connector_handoff_v2' | 'reserve_treatment_email' | 'finish_treatment_email' | 'revoke_connector_contact',
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string } | null }>;
};

/** Atomically persist the current contact permission, interests, and consent receipts. */
export async function completeConnectorHandoff(params: {
  matchId: string;
  recipientFacilityIds: string[];
  identity: SeekerIdentity;
  consents: { email: boolean; share: boolean };
}): Promise<ConnectorHandoffResult> {
  const vault = createLeadClient() as unknown as ConnectorRpcClient;
  const { data, error } = await vault.rpc('complete_connector_handoff_v2', {
    p_match_id: params.matchId,
    p_recipient_facility_ids: params.recipientFacilityIds,
    p_name: params.identity.name ?? null,
    p_email: params.identity.email ?? null,
    p_phone: params.identity.phone ?? null,
    p_consent_email: params.consents.email,
    p_consent_share: params.consents.share,
  });
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
  if (error || !row) throw new Error('Could not complete the connector handoff safely.');
  return {
    seekerId: typeof row.seeker_id === 'string' ? row.seeker_id : null,
    consentEmail: row.consent_email === true,
    consentShare: row.consent_share === true,
    sharedFacilityCount: Number(row.shared_facility_count ?? 0),
    alreadyCompleted: row.already_completed === true,
  };
}

/** Store a minimal, consented connector lead and the programs they chose. */
export async function createSeekerWithInterest(params: {
  matchId: string;
  identity: SeekerIdentity;
  coverageStatus?: string | null;
  consents: { email: boolean; share: boolean };
  facilityIds: string[];
}): Promise<string> {
  const vault = createLeadClient();
  const now = new Date().toISOString();

  const fields = {
    match_id: params.matchId,
    name: params.identity.name ?? null,
    email: params.identity.email ?? null,
    coverage_status: params.coverageStatus ?? null,
    phone: params.identity.phone ?? null,
    consent_email: params.consents.email,
    consent_share: params.consents.share,
    consent_at: now,
    status: 'active',
  };

  // The browser may retry after a network interruption. Reuse an existing row for
  // this server-issued match so the same consent action cannot duplicate a lead.
  const { data: existing, error: lookupError } = await vault
    .from('vault_seekers')
    .select('id')
    .eq('match_id', params.matchId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new Error(`Could not check connector lead: ${lookupError.message}`);

  let seekerId = existing?.id ?? null;
  if (seekerId) {
    const { error } = await vault.from('vault_seekers').update(fields).eq('id', seekerId);
    if (error) throw new Error(`Could not update connector lead: ${error.message}`);
  } else {
    const { data, error } = await vault.from('vault_seekers').insert(fields).select('id').single();
    if (error || !data) throw new Error(`Could not create connector lead: ${error?.message ?? 'unknown error'}`);
    seekerId = data.id;
  }

  // The latest decision is authoritative for future in-app access. Remove prior
  // interests first, then restore only the server-derived programs in this match.
  const { error: clearError } = await vault.from('vault_seeker_interest').delete().eq('seeker_id', seekerId);
  if (clearError) throw new Error(`Could not update connector interests: ${clearError.message}`);
  if (params.facilityIds.length) {
    const { error: interestError } = await vault.from('vault_seeker_interest').insert(
      params.facilityIds.map((facility_id) => ({
        seeker_id: seekerId,
        facility_id,
        match_id: params.matchId,
      }))
    );
    if (interestError) throw new Error(`Could not store connector interests: ${interestError.message}`);
  }
  return seekerId;
}

export type ConsentChannel = 'share' | 'email';

/**
 * Append-only consent ledger. One immutable row per decision (share + email) with
 * its yes/no value and the moment it was answered — the durable "you said yes on
 * this date" record, separate from the mutable consent_* columns on vault_seekers.
 */
export async function logConsentEvents(params: {
  seekerId: string | null;
  matchId: string | null;
  consents: { email: boolean; share: boolean };
  source?: string;
}): Promise<void> {
  const vault = createLeadClient();
  const now = new Date().toISOString();
  const source = params.source ?? 'intake';
  const rows: { channel: ConsentChannel; granted: boolean }[] = [
    { channel: 'share', granted: params.consents.share },
    { channel: 'email', granted: params.consents.email },
  ];
  const { error } = await vault.from('vault_consent_events').insert(
    rows.map((r) => ({
      seeker_id: params.seekerId,
      match_id: params.matchId,
      channel: r.channel,
      granted: r.granted,
      source,
      occurred_at: now,
    }))
  );
  if (error) throw new Error(`Could not record consent event: ${error.message}`);
}

export type ConsentEvent = {
  id: string;
  channel: string;
  granted: boolean;
  source: string;
  occurred_at: string;
};

/** Full consent history for a seeker, newest first (admin/compliance view). */
export async function getConsentEvents(seekerId: string): Promise<ConsentEvent[]> {
  const vault = createLeadClient();
  const { data } = await vault
    .from('vault_consent_events')
    .select('id, channel, granted, source, occurred_at')
    .eq('seeker_id', seekerId)
    .order('occurred_at', { ascending: false });
  return (data ?? []) as ConsentEvent[];
}

export type TreatmentEmailReservation = {
  logId: string;
  status: 'pending' | 'sent' | 'failed' | 'legacy_unknown' | 'recipient_mismatch';
  shouldSend: boolean;
};

/** Reserve the single requested match email before touching the mail provider. */
export async function reserveTreatmentEmail(
  seekerId: string,
  email: string,
): Promise<TreatmentEmailReservation> {
  const vault = createLeadClient() as unknown as ConnectorRpcClient;
  const { data, error } = await vault.rpc('reserve_treatment_email', {
    p_seeker_id: seekerId,
    p_to_email: email,
  });
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
  const status = row?.delivery_status;
  if (
    error ||
    !row ||
    typeof row.email_log_id !== 'string' ||
    status !== 'pending' &&
    status !== 'sent' &&
    status !== 'failed' &&
    status !== 'legacy_unknown' &&
    status !== 'recipient_mismatch'
  ) {
    throw new Error('Could not reserve the requested email safely.');
  }
  return { logId: row.email_log_id, status, shouldSend: row.should_send === true };
}

export async function finishTreatmentEmail(
  logId: string,
  status: 'sent' | 'failed',
  providerId: string | null,
): Promise<void> {
  const vault = createLeadClient() as unknown as ConnectorRpcClient;
  const { error } = await vault.rpc('finish_treatment_email', {
    p_email_log_id: logId,
    p_delivery_status: status,
    p_provider_id: providerId,
  });
  if (error) throw new Error('Could not finalize the email delivery record.');
}

export async function revokeConnectorContact(seekerId: string, source = 'admin_revocation'): Promise<void> {
  const vault = createLeadClient() as unknown as ConnectorRpcClient;
  const { error } = await vault.rpc('revoke_connector_contact', {
    p_seeker_id: seekerId,
    p_source: source,
  });
  if (error) throw new Error('Could not revoke the connector contact safely.');
}

/** Link a created auth account to the seeker's vault record. */
export async function setSeekerAuthUser(seekerId: string, authUserId: string): Promise<void> {
  const vault = createLeadClient();
  // Compare-and-set: a retry in a shared browser must never transfer a saved
  // connector record from one account to another.
  const { data: linked, error } = await vault
    .from('vault_seekers')
    .update({ auth_user_id: authUserId })
    .eq('id', seekerId)
    .is('auth_user_id', null)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`Could not link seeker account: ${error.message}`);
  if (linked) return;

  const { data: current, error: currentError } = await vault
    .from('vault_seekers')
    .select('auth_user_id')
    .eq('id', seekerId)
    .maybeSingle();
  if (currentError || current?.auth_user_id !== authUserId) {
    throw new Error('This connector record is already linked to a different account.');
  }
}

export type SeekerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  coverage_status: string | null;
  consent_share: boolean;
  consent_email: boolean;
  match_id: string | null;
  status: string;
  created_at: string;
};

const SEEKER_COLS =
  'id, name, email, phone, coverage_status, consent_share, consent_email, match_id, status, created_at';

async function facilitiesForSeeker(
  vault: ReturnType<typeof createLeadClient>,
  seekerId: string
): Promise<({ id: string; name: string; city: string | null; state: string | null; levels: string[] })[]> {
  const { data: interests } = await vault
    .from('vault_seeker_interest')
    .select(
      'facility_id, facilities(name, city, state, levels_of_care)'
    )
    .eq('seeker_id', seekerId);
  return (interests ?? [])
    .map((i) => {
      const facility = i.facilities as unknown as {
        name?: string;
        city?: string | null;
        state?: string | null;
        levels_of_care?: string[] | null;
      } | null;
      return facility?.name
        ? {
            id: i.facility_id as string,
            name: facility.name,
            city: facility.city ?? null,
            state: facility.state ?? null,
            levels: facility.levels_of_care ?? [],
          }
        : null;
    })
    .filter((f): f is { id: string; name: string; city: string | null; state: string | null; levels: string[] } => f !== null);
}

/** Admin: list restricted connector contact records. */
export async function listSeekers(): Promise<SeekerRow[]> {
  const vault = createLeadClient();
  const { data } = await vault.from('vault_seekers').select(SEEKER_COLS).order('created_at', { ascending: false });
  return (data ?? []) as SeekerRow[];
}

/** Admin: one seeker + their matched programs. */
export async function getSeekerById(
  id: string
): Promise<{
  seeker: SeekerRow;
  facilities: { id: string; name: string; city: string | null; state: string | null; levels: string[] }[];
} | null> {
  const vault = createLeadClient();
  const { data: seeker } = await vault.from('vault_seekers').select(SEEKER_COLS).eq('id', id).maybeSingle();
  if (!seeker) return null;
  return { seeker: seeker as SeekerRow, facilities: await facilitiesForSeeker(vault, id) };
}

/** Seeker dashboard: every past search for this account, newest first. */
export async function getSearchesByAuthUser(
  authUserId: string
): Promise<{
  search: SeekerRow;
  facilities: { id: string; name: string; city: string | null; state: string | null; levels: string[] }[];
}[]> {
  const vault = createLeadClient();
  const { data: seekers } = await vault
    .from('vault_seekers')
    .select(SEEKER_COLS)
    .eq('auth_user_id', authUserId)
    .order('created_at', { ascending: false });
  const out: {
    search: SeekerRow;
    facilities: { id: string; name: string; city: string | null; state: string | null; levels: string[] }[];
  }[] = [];
  for (const s of (seekers ?? []) as SeekerRow[]) {
    out.push({ search: s, facilities: await facilitiesForSeeker(vault, s.id) });
  }
  return out;
}

/**
 * Seeker self-edit: update the same consented connector identity. Program-sharing
 * consent covers the retained name, email, and phone; email-copy-only consent keeps
 * only name and email. This path cannot broaden either permission.
 */
export async function updateMyInfo(
  authUserId: string,
  seekerId: string,
  patch: { name: string; email: string; phone?: string }
): Promise<void> {
  const vault = createLeadClient();
  const { data: current, error: currentError } = await vault
    .from('vault_seekers')
    .select('id, consent_share, consent_email, match_id, status')
    .eq('id', seekerId)
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (currentError || !current) throw new Error('Connector contact not found.');
  if (current.status === 'unsubscribed' || (!current.consent_share && !current.consent_email)) {
    throw new Error('Start a new connection before saving contact details.');
  }

  const name = patch.name.trim().replace(/\s+/g, ' ');
  const email = patch.email.trim().toLowerCase();
  const phone = patch.phone?.trim() ?? '';
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('Enter a valid name.');
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }
  const digits = phone.replace(/\D/g, '');
  if (current.consent_share && (phone.length > 50 || digits.length < 7 || digits.length > 15)) {
    throw new Error('Enter a valid phone number.');
  }
  if (!current.consent_share && phone) {
    throw new Error('Phone sharing requires a new connection choice.');
  }

  const { data: updated, error } = await vault
    .from('vault_seekers')
    .update({
      name,
      email,
      phone: current.consent_share ? phone : null,
      consent_at: new Date().toISOString(),
    })
    .eq('id', seekerId)
    .eq('auth_user_id', authUserId)
    .select('id')
    .maybeSingle();
  if (error || !updated) throw new Error(`Could not update contact information: ${error?.message ?? 'not found'}`);

  // The account form requires an explicit confirmation, so append a fresh receipt
  // for the same permission choices instead of mutating consent without an audit.
  await logConsentEvents({
    seekerId,
    matchId: current.match_id,
    consents: { share: current.consent_share, email: current.consent_email },
    source: 'seeker_contact_update',
  });
}

/** Mark a seeker converted (stop reminding) — keyed by their de-identified match. */
export async function markSeekerConnectedByMatch(matchId: string): Promise<void> {
  const vault = createLeadClient();
  await vault.from('vault_seekers').update({ status: 'connected' }).eq('match_id', matchId);
}
