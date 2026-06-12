import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

// Neutral, distance-only discovery: every published facility within a radius of the
// seeker's ZIP, sorted purely by miles. No ranking, no favoritism — the basis for the
// map + list results page. Coordinates are ZIP-centroid level (good to a few miles).
export type NearbyFacility = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  levels_of_care: string[];
  latitude: number;
  longitude: number;
  miles: number;
};

export async function getNearby(
  zip: string,
  radiusMi = 25,
  limit = 20
): Promise<{ origin: { lat: number; lng: number } | null; facilities: NearbyFacility[] }> {
  const z = (String(zip ?? '').match(/\d{5}/) || [])[0];
  if (!z) return { origin: null, facilities: [] };

  const admin = createAdminClient();
  // The RPC isn't in the generated types — call it through a narrow cast.
  const rpc = admin.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: NearbyFacility[] | null }>;

  const [{ data: centroid }, { data: rows }] = await Promise.all([
    admin.from('zip_centroids').select('lat, lng').eq('zip', z).maybeSingle(),
    rpc('facilities_near_zip', { p_zip: z, p_radius_mi: radiusMi, p_limit: limit }),
  ]);

  const origin = centroid ? { lat: Number(centroid.lat), lng: Number(centroid.lng) } : null;
  const facilities = (rows ?? []).filter((f) => f.latitude != null && f.longitude != null);
  return { origin, facilities };
}
