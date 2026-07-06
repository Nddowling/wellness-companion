import { cache } from 'react';
import type { Metadata } from 'next';

import { createAdminClient } from '@/lib/supabase/admin';
import { LEVEL_LABELS, LEVELS_OF_CARE, type LevelOfCare } from '@/lib/constants';
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl } from '@/lib/seo';
import { profileIndexable, robotsFor } from '@/lib/indexable';
import { stateName } from '@/lib/geo';
import { computeAreaStats, type ContextInput } from '@/lib/facility/context';

// Re-exported for server callers; the implementation is the client-safe pure helper.
export { facilityPath as facilityCanonicalPath } from '@/lib/facility/href';

const CONTEXT_SELECT = 'city, levels_of_care, accreditations, facility_payers(payer_type)';

/**
 * Load the peer facilities + aggregates needed for a profile's computed-differentiation
 * block (city → county → state tier). One county-scoped query (county is a superset of
 * the city); a state-level count is only run for the rural fallback. Cached per request.
 */
export const loadFacilityContext = cache(
  async (f: {
    city: string | null;
    county: string | null;
    state: string | null;
    levels_of_care: string[] | null;
  }): Promise<ContextInput | null> => {
    if (!f.city || !f.state) return null;
    const code = f.state.toUpperCase();
    const supabase = createAdminClient();

    const scope = supabase.from('facilities').select(CONTEXT_SELECT).eq('is_published', true).ilike('state', code);
    const { data } = f.county ? await scope.eq('county', f.county) : await scope.eq('city', f.city);
    const peers = (data ?? []) as { city: string | null; levels_of_care: string[] | null; accreditations: string[] | null; facility_payers: { payer_type: string }[] }[];

    const city = computeAreaStats(peers.filter((p) => p.city === f.city));
    const county = f.county ? computeAreaStats(peers) : null;

    let stateLevelCount = 0;
    const primary = LEVELS_OF_CARE.find((l) => (f.levels_of_care ?? []).includes(l));
    if (city.total < 3 && (!county || county.total < 3) && primary) {
      const { count } = await supabase
        .from('facilities')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true)
        .ilike('state', code)
        .contains('levels_of_care', [primary]);
      stateLevelCount = count ?? 0;
    }

    return { cityName: f.city, countyName: f.county, stateCode: code, stateName: stateName(code), city, county, stateLevelCount };
  }
);

// Shared facility loaders + canonical-URL helper. Facility profiles are reachable
// by UUID (legacy /programs/[id]) and by slug (/treatment/[state]/[city]/[slug]);
// both entry points load the same row shape and render the same view. Wrapped in
// React `cache()` so generateMetadata and the page body share a single query per
// request instead of hitting Postgres twice.

const PROFILE_SELECT =
  '*, facility_capacity(level_of_care, beds_available, last_updated), facility_payers(payer_type, in_network)';

export const loadFacilityById = cache(async (id: string) => {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facilities')
    .select(PROFILE_SELECT)
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();
  return data;
});

export const loadFacilityBySlug = cache(async (slug: string) => {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facilities')
    .select(PROFILE_SELECT)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  return data;
});

// The full facility row shared by the loaders and the profile view component.
export type FacilityFull = NonNullable<Awaited<ReturnType<typeof loadFacilityById>>>;

/** Shared <head> metadata for a facility profile, with the canonical set to the slug URL. */
export function buildFacilityMetadata(f: FacilityFull, canonicalPath: string): Metadata {
  const loc = [f.city, f.state].filter(Boolean).join(', ');
  const levels = ((f.levels_of_care ?? []) as string[])
    .map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l)
    .join(', ');
  const title = `${f.name}${loc ? ` — ${loc}` : ''}`;
  const description =
    (f.description && f.description.trim().slice(0, 200)) ||
    `${f.name}${loc ? ` in ${loc}` : ''} offers ${levels || 'addiction and mental-health treatment'}. ` +
      `See levels of care, accepted insurance, bed availability, reviews, and how to reach their intake team.`;
  const image = ((f.images ?? []) as string[])[0] || DEFAULT_OG_IMAGE.url;
  return {
    title,
    description,
    // Stub profiles (no contact or no level of care) stay out of the index until enriched.
    robots: robotsFor(profileIndexable(f)),
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'article',
      title: `${title} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(canonicalPath),
      images: [{ url: image }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
