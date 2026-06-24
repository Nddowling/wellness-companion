import { createAdminClient } from '@/lib/supabase/admin';
import type { NearbyFacility } from '@/lib/matching/nearby';

// "Search this area": published facilities whose coordinates fall inside the map's
// visible frame, capped (default 20) and ordered by distance to the seeker's origin.
// Distance-only; no ranking or favoritism.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const u = new URL(request.url);
  const num = (k: string) => {
    const v = Number(u.searchParams.get(k));
    return Number.isFinite(v) ? v : null;
  };
  const minLat = num('minLat');
  const minLng = num('minLng');
  const maxLat = num('maxLat');
  const maxLng = num('maxLng');
  const oLat = num('oLat');
  const oLng = num('oLng');
  const limit = Math.min(Math.max(Number(u.searchParams.get('limit')) || 20, 1), 50);

  if (minLat == null || minLng == null || maxLat == null || maxLng == null) {
    return Response.json({ facilities: [] }, { status: 400 });
  }

  const admin = createAdminClient();
  // The RPC isn't in the generated types — cast the client (receiver intact).
  const client = admin as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: NearbyFacility[] | null }>;
  };
  const { data } = await client.rpc('facilities_in_bounds', {
    p_min_lat: minLat,
    p_min_lng: minLng,
    p_max_lat: maxLat,
    p_max_lng: maxLng,
    p_olat: oLat ?? (minLat + maxLat) / 2,
    p_olng: oLng ?? (minLng + maxLng) / 2,
    p_limit: limit,
  });

  return Response.json({
    facilities: (data ?? []).filter((f) => f.latitude != null && f.longitude != null),
  });
}
