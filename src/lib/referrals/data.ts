import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Referral history for a Partner/Rep who SUBMITS referrals. A referral is a
 * de-identified `matches` row with source='bd' + bd_user_id = the submitter, plus
 * one `match_routes` row per facility it was sent to. Reads go through the admin
 * client but are ALWAYS filtered by the caller's user id (the server has already
 * authenticated them), so this never leaks another user's referrals.
 */

export type ReferralFacility = { id: string; name: string; routeStatus: string };

export type Referral = {
  id: string;
  createdAt: string;
  careLevel: string | null;
  payerType: string | null;
  region: string | null;
  status: string; // match status: open | routed | connected | closed
  facilities: ReferralFacility[];
};

export type ReferralStats = {
  total: number;
  connected: number; // reached care
  accepted: number; // a facility accepted the route
  open: number; // still in flight
};

/** Every referral this user has submitted, newest first, with the facilities it went to. */
export async function getMyReferrals(userId: string, limit = 100): Promise<Referral[]> {
  const admin = createAdminClient();
  const { data: matches } = await admin
    .from('matches')
    .select('id, created_at, care_level_needed, payer_type, region_zip3, status')
    .eq('bd_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!matches || matches.length === 0) return [];

  const ids = matches.map((m) => m.id);
  const { data: routes } = await admin
    .from('match_routes')
    .select('match_id, status, facilities(id, name)')
    .in('match_id', ids);

  const byMatch = new Map<string, ReferralFacility[]>();
  for (const r of routes ?? []) {
    // supabase types the joined row as an object; guard defensively.
    const fac = r.facilities as unknown as { id: string; name: string } | null;
    if (!fac) continue;
    const list = byMatch.get(r.match_id) ?? [];
    list.push({ id: fac.id, name: fac.name, routeStatus: r.status });
    byMatch.set(r.match_id, list);
  }

  return matches.map((m) => ({
    id: m.id,
    createdAt: m.created_at,
    careLevel: m.care_level_needed,
    payerType: m.payer_type,
    region: m.region_zip3,
    status: m.status,
    facilities: byMatch.get(m.id) ?? [],
  }));
}

// ── inbound (facility-side, for Reps/BDMs) ────────────────────────────────────

export type InboundReferral = {
  facilityId: string;
  facilityName: string;
  routeStatus: string;
  createdAt: string;
  careLevel: string | null;
  payerType: string | null;
};

/** Referrals routed TO a set of facilities (a Rep's verified affiliations), newest first. */
export async function getInboundReferrals(facilityIds: string[], limit = 50): Promise<InboundReferral[]> {
  if (facilityIds.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from('match_routes')
    .select('facility_id, status, created_at, facilities(name), matches(care_level_needed, payer_type)')
    .in('facility_id', facilityIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => {
    const fac = r.facilities as unknown as { name: string } | null;
    const m = r.matches as unknown as { care_level_needed: string | null; payer_type: string | null } | null;
    return {
      facilityId: r.facility_id,
      facilityName: fac?.name ?? 'Your facility',
      routeStatus: r.status,
      createdAt: r.created_at,
      careLevel: m?.care_level_needed ?? null,
      payerType: m?.payer_type ?? null,
    };
  });
}

export async function getInboundReferralStats(
  facilityIds: string[],
): Promise<{ total: number; accepted: number; pending: number }> {
  if (facilityIds.length === 0) return { total: 0, accepted: 0, pending: 0 };
  const admin = createAdminClient();
  const { data } = await admin.from('match_routes').select('status').in('facility_id', facilityIds);
  const total = data?.length ?? 0;
  const accepted = data?.filter((r) => r.status === 'accepted').length ?? 0;
  const pending = data?.filter((r) => r.status === 'sent' || r.status === 'viewed').length ?? 0;
  return { total, accepted, pending };
}

/** Headline counts for the dashboard analytics tiles. */
export async function getMyReferralStats(userId: string): Promise<ReferralStats> {
  const admin = createAdminClient();
  const { data: matches } = await admin
    .from('matches')
    .select('id, status')
    .eq('bd_user_id', userId);

  const total = matches?.length ?? 0;
  const connected = matches?.filter((m) => m.status === 'connected').length ?? 0;
  const open = matches?.filter((m) => m.status === 'open' || m.status === 'routed').length ?? 0;

  let accepted = 0;
  if (matches && matches.length > 0) {
    const { count } = await admin
      .from('match_routes')
      .select('id', { count: 'exact', head: true })
      .in(
        'match_id',
        matches.map((m) => m.id),
      )
      .eq('status', 'accepted');
    accepted = count ?? 0;
  }

  return { total, connected, accepted, open };
}
