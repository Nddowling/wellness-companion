import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

const SAFE_DATABASE_CODE = /^[a-z0-9_-]{1,32}$/i;

type ContactReadStage = 'routes' | 'interests' | 'seekers';
type ContactReadError = { code?: unknown } | null | undefined;

function contactReadFailure(stage: ContactReadStage, error: ContactReadError): never {
  const rawCode = error?.code;
  console.error('[facility-contacts] database read failed', {
    stage,
    code: typeof rawCode === 'string' && SAFE_DATABASE_CODE.test(rawCode) ? rawCode : 'unknown',
  });
  throw new Error('Could not load facility contacts. Please try again.');
}

// A facility's contacts = EVERY seeker the matcher routed to it. De-identified by
// default (level/payer/coarse concern/region — never identity), enriched with
// phone or email only for seekers who explicitly consented to share
// with this facility. Callers MUST verify facility membership first — this uses
// the service role for deny-all connector tables and therefore bypasses RLS.

export type MatchedContact = {
  matchId: string;
  routeId: string;
  status: string; // sent | viewed | accepted | declined
  matchedAt: string;
  // de-identified (always present)
  level: string | null;
  payer: string | null;
  concern: string | null;
  region: string | null;
  // identity (only when the seeker consented to share with THIS facility)
  shared: boolean;
  phone: string | null;
  email: string | null;
};

type MatchRow = {
  region_zip3: string | null;
  care_level_needed: string | null;
  payer_type: string | null;
  concern_category: string | null;
  created_at: string | null;
};

export async function listFacilityContacts(facilityId: string): Promise<MatchedContact[]> {
  const admin = createAdminClient();
  const { data: routes, error: routesError } = await admin
    .from('match_routes')
    .select(
      'id, status, created_at, match_id, matches(region_zip3, care_level_needed, payer_type, concern_category, created_at)'
    )
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false });
  if (routesError) contactReadFailure('routes', routesError);
  if (!routes?.length) return [];

  // Identity for seekers who consented to share with THIS facility, keyed by match.
  const identityByMatch = new Map<
    string,
    { phone: string | null; email: string | null }
  >();
  const { data: interests, error: interestsError } = await admin
    .from('vault_seeker_interest')
    .select('seeker_id')
    .eq('facility_id', facilityId);
  if (interestsError) contactReadFailure('interests', interestsError);

  const seekerIds = [...new Set((interests ?? []).map((i) => i.seeker_id).filter((x): x is string => !!x))];
  if (seekerIds.length) {
    const { data: seekers, error: seekersError } = await admin
      .from('vault_seekers')
      .select('match_id, phone, email')
      .in('id', seekerIds)
      .eq('consent_share', true)
      .in('status', ['active', 'connected']);
    if (seekersError) contactReadFailure('seekers', seekersError);

    for (const s of seekers ?? []) {
      if (!s.match_id) continue;
      identityByMatch.set(s.match_id, {
        phone: s.phone,
        email: s.email,
      });
    }
  }

  return routes.map((r) => {
    const m = (r.matches ?? null) as MatchRow | null;
    const id = r.match_id ? identityByMatch.get(r.match_id) : undefined;
    return {
      matchId: (r.match_id as string) ?? '',
      routeId: r.id as string,
      status: r.status as string,
      matchedAt: m?.created_at ?? (r.created_at as string),
      level: m?.care_level_needed ?? null,
      payer: m?.payer_type ?? null,
      concern: m?.concern_category ?? null,
      region: m?.region_zip3 ?? null,
      shared: !!id,
      phone: id?.phone ?? null,
      email: id?.email ?? null,
    };
  });
}
