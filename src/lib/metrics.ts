import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { collectPublicRows } from '@/lib/supabase/public-pagination';

export type AdminMetrics = {
  facilitiesActive: number;
  facilitiesInactive: number;
  facilitiesTotal: number;
  openBeds: number;
  seekersTotal: number;
  seekersActive: number;
  matchesTotal: number;
  matchesRouted: number;
  matchesConnected: number;
  claimsPending: number;
};

type ExactCountResult = {
  count: number | null;
  error: { code?: string | null } | null;
};

function exactCount(context: string, result: ExactCountResult): number {
  if (result.error || result.count === null) {
    console.error('[admin-metrics] query failed', {
      context,
      code: result.error?.code ?? 'missing_count',
    });
    throw new Error('Admin metrics are temporarily unavailable.');
  }
  return result.count;
}

/** Platform-wide metrics for the Global Admin dashboard (service-role). */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const a = createAdminClient();
  const now = Date.now();
  const freshnessCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const futureSkewCutoff = new Date(now + 5 * 60 * 1000).toISOString();

  const [
    facilitiesResult,
    activeFacilitiesResult,
    matchesResult,
    routedMatchesResult,
    connectedMatchesResult,
    pendingClaimsResult,
    seekersResult,
    activeSeekersResult,
    openCapacity,
  ] = await Promise.all([
    a.from('facilities').select('id', { count: 'exact', head: true }),
    a.from('facilities').select('id', { count: 'exact', head: true }).eq('is_published', true),
    a.from('matches').select('id', { count: 'exact', head: true }),
    a.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'routed'),
    a.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'connected'),
    a.from('facility_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    a.from('vault_seekers').select('id', { count: 'exact', head: true }),
    a.from('vault_seekers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    collectPublicRows('admin open residential capacity', (from, to) =>
      a
        .from('facility_capacity')
        .select('id, beds_available, facilities!inner(is_published)')
        .eq('level_of_care', 'residential')
        .gt('beds_available', 0)
        .gte('last_updated', freshnessCutoff)
        .lte('last_updated', futureSkewCutoff)
        .eq('facilities.is_published', true)
        .order('id')
        .range(from, to),
    ),
  ]);

  const facilitiesTotal = exactCount('facilities total', facilitiesResult);
  const facilitiesActive = exactCount('facilities active', activeFacilitiesResult);

  return {
    facilitiesActive,
    facilitiesInactive: facilitiesTotal - facilitiesActive,
    facilitiesTotal,
    openBeds: openCapacity.reduce((sum, row) => sum + row.beds_available, 0),
    seekersTotal: exactCount('seekers total', seekersResult),
    seekersActive: exactCount('seekers active', activeSeekersResult),
    matchesTotal: exactCount('matches total', matchesResult),
    matchesRouted: exactCount('matches routed', routedMatchesResult),
    matchesConnected: exactCount('matches connected', connectedMatchesResult),
    claimsPending: exactCount('claims pending', pendingClaimsResult),
  };
}
