import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { US_STATES } from '@/lib/geo';

// Normalize a 2-letter code or full state name → 2-letter code ('' if unknown).
// Self-contained so this feature doesn't depend on helpers added elsewhere.
function normStateCode(input?: string | null): string {
  const s = String(input ?? '').trim();
  if (!s) return '';
  if (US_STATES[s.toUpperCase()]) return s.toUpperCase();
  for (const [code, name] of Object.entries(US_STATES)) {
    if (name.toLowerCase() === s.toLowerCase()) return code;
  }
  return '';
}

// Neutral, distance-only discovery: every published facility within a radius of the
// seeker's location, sorted purely by miles. No ranking, no favoritism. Origin comes
// from a ZIP (exact, via the centroid table) or a city/state (geocoded). Facility
// coordinates are ZIP-centroid level (good to a few miles).
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

export type LocationInput = { zip?: string; city?: string; state?: string };

// zip_centroids isn't in the generated Database types — narrow cast for its reads.
function zipCentroidQuery(admin: ReturnType<typeof createAdminClient>) {
  // Cast the CLIENT (not the extracted method) so `from` keeps its receiver —
  // extracting admin.from and calling it loses `this` and crashes on this.rest.
  const client = admin as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { lat: number; lng: number } | null }>;
        };
      };
    };
  };
  return client.from('zip_centroids');
}

/** Geocode "City, ST" → coordinates via Google (server-side key, unrestricted). */
async function geocodeCity(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${city}, ${state}`)}` +
      `&components=country:US&key=${key}`;
    const res = await fetch(url);
    const j = (await res.json()) as { results?: { geometry?: { location?: { lat: number; lng: number } } }[] };
    const loc = j.results?.[0]?.geometry?.location;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) return { lat: loc.lat, lng: loc.lng };
  } catch {
    /* geocoding is best-effort — caller falls back */
  }
  return null;
}

/** Resolve a seeker location to coordinates: ZIP centroid first, then geocoded
 *  city/state, then (if geocoding is unavailable) a facility's ZIP in that city. */
export async function resolveOrigin(loc: LocationInput): Promise<{ lat: number; lng: number } | null> {
  const admin = createAdminClient();

  const z = (String(loc.zip ?? '').match(/\d{5}/) || [])[0];
  if (z) {
    const { data } = await zipCentroidQuery(admin).select('lat, lng').eq('zip', z).maybeSingle();
    if (data) return { lat: Number(data.lat), lng: Number(data.lng) };
  }

  const stateCode = normStateCode(loc.state);
  if (loc.city && stateCode) {
    const geo = await geocodeCity(loc.city, stateCode);
    if (geo) return geo;
    // Fallback: a published facility's ZIP in that city → its centroid.
    const { data: fac } = await admin
      .from('facilities')
      .select('zip')
      .ilike('city', loc.city)
      .eq('state', stateCode)
      .not('zip', 'is', null)
      .limit(1)
      .maybeSingle();
    const fz = fac?.zip ? (String(fac.zip).match(/\d{5}/) || [])[0] : null;
    if (fz) {
      const { data } = await zipCentroidQuery(admin).select('lat, lng').eq('zip', fz).maybeSingle();
      if (data) return { lat: Number(data.lat), lng: Number(data.lng) };
    }
  }
  return null;
}

async function facilitiesNearPoint(
  origin: { lat: number; lng: number },
  radiusMi: number,
  limit: number
): Promise<NearbyFacility[]> {
  const admin = createAdminClient();
  // Cast the client (receiver intact); the RPC isn't in the generated types.
  const client = admin as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: NearbyFacility[] | null }>;
  };
  const { data } = await client.rpc('facilities_near_point', {
    p_lat: origin.lat,
    p_lng: origin.lng,
    p_radius_mi: radiusMi,
    p_limit: limit,
  });
  return (data ?? []).filter((f) => f.latitude != null && f.longitude != null);
}

export async function getNearby(
  loc: LocationInput,
  radiusMi = 25,
  limit = 20
): Promise<{ origin: { lat: number; lng: number } | null; facilities: NearbyFacility[] }> {
  const origin = await resolveOrigin(loc);
  if (!origin) return { origin: null, facilities: [] };
  return { origin, facilities: await facilitiesNearPoint(origin, radiusMi, limit) };
}
