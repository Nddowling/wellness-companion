import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createVaultClient } from '@/lib/supabase/vault';

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

/** Platform-wide metrics for the Global Admin dashboard (service-role). */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const a = createAdminClient();
  const [facs, caps, matches, claims] = await Promise.all([
    a.from('facilities').select('id, is_published'),
    a.from('facility_capacity').select('facility_id, beds_available'),
    a.from('matches').select('status'),
    a.from('facility_claims').select('status'),
  ]);

  const f = facs.data ?? [];
  const active = new Set(f.filter((x) => x.is_published).map((x) => x.id));
  const openBeds = (caps.data ?? [])
    .filter((c) => active.has(c.facility_id))
    .reduce((s, c) => s + (c.beds_available || 0), 0);
  const m = matches.data ?? [];

  let seekersTotal = 0;
  let seekersActive = 0;
  try {
    const v = createVaultClient();
    const { data: seekers } = await v.from('vault_seekers').select('status');
    seekersTotal = (seekers ?? []).length;
    seekersActive = (seekers ?? []).filter((s) => s.status === 'active').length;
  } catch {
    /* vault disabled (no BAA flag) — seeker metrics stay 0 */
  }

  return {
    facilitiesActive: active.size,
    facilitiesInactive: f.length - active.size,
    facilitiesTotal: f.length,
    openBeds,
    seekersTotal,
    seekersActive,
    matchesTotal: m.length,
    matchesRouted: m.filter((x) => x.status === 'routed').length,
    matchesConnected: m.filter((x) => x.status === 'connected').length,
    claimsPending: (claims.data ?? []).filter((c) => c.status === 'pending').length,
  };
}
