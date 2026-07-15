import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createVaultClient, isVaultEnabled } from '@/lib/supabase/vault';

// A facility's contacts = EVERY seeker the matcher routed to it. De-identified by
// default (level/payer/coverage/concern/region — never identity), enriched with
// name/phone/email/face sheet only for seekers who explicitly consented to share
// with this facility. Callers MUST verify facility membership first — this uses
// the service role (matched leads) + the vault (consented identity), bypassing RLS.

export type MatchedContact = {
  matchId: string;
  routeId: string;
  status: string; // sent | viewed | accepted | declined
  matchedAt: string;
  // de-identified (always present)
  level: string | null;
  payer: string | null;
  coverage: string | null;
  concern: string | null;
  region: string | null;
  // identity (only when the seeker consented to share with THIS facility)
  shared: boolean;
  name: string | null;
  phone: string | null;
  email: string | null;
};

type MatchRow = {
  region_zip3: string | null;
  care_level_needed: string | null;
  payer_type: string | null;
  coverage_status: string | null;
  concern_category: string | null;
  created_at: string | null;
};

export async function listFacilityContacts(facilityId: string): Promise<MatchedContact[]> {
  const admin = createAdminClient();
  const { data: routes } = await admin
    .from('match_routes')
    .select(
      'id, status, created_at, match_id, matches(region_zip3, care_level_needed, payer_type, coverage_status, concern_category, created_at)'
    )
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: false });
  if (!routes?.length) return [];

  // Identity for seekers who consented to share with THIS facility, keyed by match.
  const identityByMatch = new Map<
    string,
    { name: string | null; phone: string | null; email: string | null }
  >();
  if (isVaultEnabled()) {
    try {
      const vault = createVaultClient();
      const { data: interests } = await vault
        .from('vault_seeker_interest')
        .select('seeker_id')
        .eq('facility_id', facilityId);
      const seekerIds = [...new Set((interests ?? []).map((i) => i.seeker_id).filter((x): x is string => !!x))];
      if (seekerIds.length) {
        const { data: seekers } = await vault
          .from('vault_seekers')
          .select('match_id, name, phone, email')
          .in('id', seekerIds)
          .eq('consent_share', true);
        for (const s of seekers ?? []) {
          if (!s.match_id) continue;
          identityByMatch.set(s.match_id, {
            name: s.name,
            phone: s.phone,
            email: s.email,
          });
        }
      }
    } catch {
      /* vault unavailable — fall back to de-identified only */
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
      coverage: m?.coverage_status ?? null,
      concern: m?.concern_category ?? null,
      region: m?.region_zip3 ?? null,
      shared: !!id,
      name: id?.name ?? null,
      phone: id?.phone ?? null,
      email: id?.email ?? null,
    };
  });
}
