import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';

import { createAdminClient } from '@/lib/supabase/admin';
import { LEVEL_LABELS, LEVELS_OF_CARE, type LevelOfCare } from '@/lib/constants';
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl } from '@/lib/seo';
import { profileIndexable, robotsFor } from '@/lib/indexable';
import { stateName } from '@/lib/geo';
import { computeAreaStats, type ContextInput } from '@/lib/facility/context';
import { throwOnPublicReadError } from '@/lib/public-read-error';

// Re-exported for server callers; the implementation is the client-safe pure helper.
export { facilityPath as facilityCanonicalPath } from '@/lib/facility/href';

const CONTEXT_SELECT = 'levels_of_care, accreditations, facility_payers(payer_type)';

/**
 * Peer aggregates for a profile's computed-differentiation block (city → county →
 * state tier). City stats are queried BY CITY (a city can span counties — e.g. Atlanta
 * is Fulton + DeKalb — so a county-scoped query would undercount it); county is only
 * queried for the fallback when the city is thin. unstable_cache so the reads don't
 * force dynamic rendering (supabase-js sends no-store) and the profile can be ISR.
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
    const cityName = f.city;
    const county = f.county;
    const primary = LEVELS_OF_CARE.find((l) => (f.levels_of_care ?? []).includes(l)) ?? null;

    const run = unstable_cache(
      async (): Promise<ContextInput> => {
        const supabase = createAdminClient();
        const areaSel = () => supabase.from('facilities').select(CONTEXT_SELECT).eq('is_published', true).ilike('state', code);

        const { data: cityData, error: cityError } = await areaSel().eq('city', cityName);
        throwOnPublicReadError('facility context city', cityError);
        const cityStats = computeAreaStats((cityData ?? []) as never[]);

        let countyStats = null;
        if (cityStats.total < 3 && county) {
          const { data: countyData, error: countyError } = await areaSel().eq('county', county);
          throwOnPublicReadError('facility context county', countyError);
          countyStats = computeAreaStats((countyData ?? []) as never[]);
        }

        let stateLevelCount = 0;
        if (cityStats.total < 3 && (!countyStats || countyStats.total < 3) && primary) {
          const { count, error: stateError } = await supabase
            .from('facilities')
            .select('id', { count: 'exact', head: true })
            .eq('is_published', true)
            .ilike('state', code)
            .contains('levels_of_care', [primary]);
          throwOnPublicReadError('facility context state', stateError);
          stateLevelCount = count ?? 0;
        }

        return { cityName, countyName: county, stateCode: code, stateName: stateName(code), city: cityStats, county: countyStats, stateLevelCount };
      },
      ['facility-context', code, cityName, county ?? '', primary ?? ''],
      { revalidate: 3600, tags: [`facilities:${code}:${cityName}`] }
    );
    return run();
  }
);

// Shared facility loaders + canonical-URL helper. Facility profiles are reachable
// by UUID (legacy /programs/[id]) and by slug (/treatment/[state]/[city]/[slug]);
// both entry points load the same row shape and render the same view. Wrapped in
// React `cache()` so generateMetadata and the page body share a single query per
// request instead of hitting Postgres twice.

const PROFILE_SELECT =
  '*, facility_capacity(level_of_care, beds_available, last_updated, updated_by), facility_payers(payer_type), facility_claims(status)';

export const loadFacilityById = cache(async (id: string) => {
  const run = unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.from('facilities').select(PROFILE_SELECT).eq('id', id).eq('is_published', true).maybeSingle();
      throwOnPublicReadError('facility by id', error);
      return data;
    },
    ['facility-by-id', id],
    { revalidate: 3600, tags: [`facility:${id}`] }
  );
  return run();
});

export const loadFacilityBySlug = cache(async (slug: string) => {
  const run = unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.from('facilities').select(PROFILE_SELECT).eq('slug', slug).eq('is_published', true).maybeSingle();
      throwOnPublicReadError('facility by slug', error);
      return data;
    },
    ['facility-by-slug', slug],
    { revalidate: 3600, tags: [`facility-slug:${slug}`] }
  );
  return run();
});

// The full facility row shared by the loaders and the profile view component.
export type FacilityFull = NonNullable<Awaited<ReturnType<typeof loadFacilityById>>>;

export type FacilityReview = {
  id: string;
  author_name: string | null;
  rating: number | null;
  body: string;
  created_at: string;
};

/** Approved reviews for a facility — cached (tag facility:<id>) so it doesn't force the profile dynamic. */
export const loadFacilityReviews = cache(async (id: string): Promise<FacilityReview[]> => {
  const run = unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('facility_reviews')
        .select('id, author_name, rating, body, created_at')
        .eq('facility_id', id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      throwOnPublicReadError('facility reviews', error);
      return (data ?? []) as FacilityReview[];
    },
    ['facility-reviews', id],
    { revalidate: 3600, tags: [`facility:${id}`] }
  );
  return run();
});

/** Shared <head> metadata for a facility profile, with the canonical set to the slug URL. */
export function buildFacilityMetadata(f: FacilityFull, canonicalPath: string): Metadata {
  const loc = [f.city, f.state].filter(Boolean).join(', ');
  const levels = ((f.levels_of_care ?? []) as string[])
    .map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l)
    .join(', ');
  const title = `${f.name}${loc ? ` — ${loc}` : ''}`;
  const description =
    (f.description && f.description.trim().slice(0, 200)) ||
    `${f.name}${loc ? ` in ${loc}` : ''} lists ${levels || 'addiction-treatment services'}. ` +
      `See listed levels of care, reported payment options, dated availability, reviews, and how to reach their intake team.`;
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
