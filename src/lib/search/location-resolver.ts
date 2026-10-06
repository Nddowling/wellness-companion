import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

import { stateName, toStateCode, US_STATES } from '@/lib/geo';
import { createAdminClient } from '@/lib/supabase/admin';

/** Only a location reaches this module; never pass a treatment narrative here. */
export type SearchLocationInput =
  | { kind: 'zip'; zip: string }
  | { kind: 'city'; city: string; state?: string };

export type SearchOrigin = {
  latitude: number;
  longitude: number;
  label: string;
  kind: 'zip' | 'city';
};

export type LocationResolution =
  | { status: 'resolved'; origin: SearchOrigin }
  | { status: 'ambiguous'; city: string; states: Array<{ code: string; name: string }> }
  | {
      status: 'error';
      code:
        | 'invalid_zip'
        | 'zip_not_found'
        | 'invalid_city'
        | 'city_not_found'
        | 'invalid_state'
        | 'centroid_unavailable';
      message: string;
    };

type ZipCentroid = { zip: string; lat: number; lng: number };

// The checked-in generated Database type predates this existing live reference
// table. Keep the narrow table shape here until generated types are refreshed.
type CentroidDatabase = {
  public: {
    Tables: {
      zip_centroids: {
        Row: ZipCentroid;
        Insert: ZipCentroid;
        Update: Partial<ZipCentroid>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type CityIndex = Map<string, Map<string, Set<string>>>;

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 128;
const resolutionCache = new Map<
  string,
  { expiresAt: number; promise: Promise<LocationResolution> }
>();
let cityIndex: CityIndex | undefined;

function normalizeCity(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bst\.?\b/g, 'saint')
    .replace(/\bmt\.?\b/g, 'mount')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function validCity(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2
    && trimmed.length <= 64
    && /^[\p{L}][\p{L} .'-]*$/u.test(trimmed);
}

function loadCityIndex(): CityIndex {
  if (cityIndex) return cityIndex;

  // This checked-in crosswalk is bundled as a server-side deployment asset.
  // The caller must include data/zip-county.csv in Next output file tracing.
  const csv = readFileSync(join(process.cwd(), 'data', 'zip-county.csv'), 'utf8');
  const index: CityIndex = new Map();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const columns = line.split(',');
    if (columns.length !== 6) continue;
    const state = columns[2]?.trim().toUpperCase();
    const zip = columns[3]?.trim();
    const city = normalizeCity(columns[5] ?? '');
    if (!state || !Object.hasOwn(US_STATES, state) || !zip || !/^\d{5}$/.test(zip) || !city || city.startsWith('zcta ')) continue;
    let byState = index.get(city);
    if (!byState) {
      byState = new Map();
      index.set(city, byState);
    }
    let zips = byState.get(state);
    if (!zips) {
      zips = new Set();
      byState.set(state, zips);
    }
    zips.add(zip);
  }
  cityIndex = index;
  return index;
}

function centroidClient(): SupabaseClient<CentroidDatabase> {
  return createAdminClient() as unknown as SupabaseClient<CentroidDatabase>;
}

function isCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function cacheResolution(key: string, compute: () => Promise<LocationResolution>): Promise<LocationResolution> {
  const now = Date.now();
  const existing = resolutionCache.get(key);
  if (existing && existing.expiresAt > now) return existing.promise;
  if (existing) resolutionCache.delete(key);

  const promise = compute();
  resolutionCache.set(key, { expiresAt: now + CACHE_TTL_MS, promise });
  if (resolutionCache.size > CACHE_MAX) {
    const oldest = resolutionCache.keys().next().value;
    if (oldest) resolutionCache.delete(oldest);
  }
  void promise.then((result) => {
    // Do not cache transient database or deployment failures.
    if (result.status === 'error' && result.code === 'centroid_unavailable') {
      resolutionCache.delete(key);
    }
  });
  return promise;
}

async function resolveZip(zip: string): Promise<LocationResolution> {
  try {
    const { data, error } = await centroidClient()
      .from('zip_centroids')
      .select('zip,lat,lng')
      .eq('zip', zip)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return { status: 'error', code: 'zip_not_found', message: `We could not find ZIP ${zip}. Check the five digits and try again.` };
    }
    if (!isCoordinate(data.lat, -90, 90) || !isCoordinate(data.lng, -180, 180)) {
      return { status: 'error', code: 'centroid_unavailable', message: 'Location data is temporarily unavailable. Please try another city or ZIP.' };
    }
    return {
      status: 'resolved',
      origin: { latitude: data.lat, longitude: data.lng, label: `ZIP ${zip}`, kind: 'zip' },
    };
  } catch {
    return { status: 'error', code: 'centroid_unavailable', message: 'Location data is temporarily unavailable. Please try again.' };
  }
}

async function resolveCity(city: string, state: string, zips: Set<string>): Promise<LocationResolution> {
  try {
    // The largest city in the checked-in crosswalk has fewer than 100 ZIPs.
    // Chunking keeps the request bounded if the crosswalk grows later.
    const zipList = [...zips].sort();
    const client = centroidClient();
    const rows: ZipCentroid[] = [];
    for (let start = 0; start < zipList.length; start += 100) {
      const batch = zipList.slice(start, start + 100);
      const { data, error } = await client
        .from('zip_centroids')
        .select('zip,lat,lng')
        .in('zip', batch)
        .limit(100);
      if (error) throw error;
      rows.push(...(data ?? []));
    }
    const valid = rows.filter((row) => isCoordinate(row.lat, -90, 90) && isCoordinate(row.lng, -180, 180));
    if (valid.length === 0) {
      return { status: 'error', code: 'centroid_unavailable', message: `We found ${city}, ${state}, but cannot estimate its location right now. Try a nearby ZIP.` };
    }
    // This is a ZIP-centre approximation, not a street-address or population-
    // weighted city centroid. The results UI must label distances accordingly.
    const latitude = valid.reduce((sum, row) => sum + row.lat, 0) / valid.length;
    const longitude = valid.reduce((sum, row) => sum + row.lng, 0) / valid.length;
    return {
      status: 'resolved',
      origin: { latitude, longitude, label: `${city}, ${state}`, kind: 'city' },
    };
  } catch {
    return { status: 'error', code: 'centroid_unavailable', message: 'Location data is temporarily unavailable. Please try again.' };
  }
}

/** Resolve a structured US city or ZIP to an approximate, private search origin. */
export async function resolveSearchLocation(input: SearchLocationInput): Promise<LocationResolution> {
  if (input.kind === 'zip') {
    const zip = input.zip.trim();
    if (!/^\d{5}$/.test(zip)) {
      return { status: 'error', code: 'invalid_zip', message: 'Enter a five-digit ZIP code.' };
    }
    return cacheResolution(`zip:${zip}`, () => resolveZip(zip));
  }

  const city = input.city.trim().replace(/\s+/g, ' ');
  if (!validCity(city)) {
    return { status: 'error', code: 'invalid_city', message: 'Enter a city name using letters, spaces, and standard punctuation.' };
  }
  const state = input.state === undefined ? undefined : toStateCode(input.state);
  if (input.state !== undefined && !state) {
    return { status: 'error', code: 'invalid_state', message: 'Choose a valid US state.' };
  }

  let matches: Map<string, Set<string>> | undefined;
  try {
    matches = loadCityIndex().get(normalizeCity(city));
  } catch {
    return { status: 'error', code: 'centroid_unavailable', message: 'Location data is temporarily unavailable. Please try again.' };
  }
  if (!matches || (state && !matches.has(state))) {
    return { status: 'error', code: 'city_not_found', message: `We could not find ${city}${state ? `, ${state}` : ''}. Check the spelling or try a ZIP.` };
  }
  if (!state && matches.size > 1) {
    const states = [...matches.keys()]
      .sort((a, b) => stateName(a).localeCompare(stateName(b)))
      .map((code) => ({ code, name: stateName(code) }));
    return { status: 'ambiguous', city, states };
  }
  const selectedState = state ?? matches.keys().next().value;
  if (!selectedState) {
    return { status: 'error', code: 'city_not_found', message: `We could not find ${city}. Try a ZIP.` };
  }
  const zips = matches.get(selectedState)!;
  return cacheResolution(`city:${normalizeCity(city)}:${selectedState}`, () => resolveCity(city, selectedState, zips));
}
