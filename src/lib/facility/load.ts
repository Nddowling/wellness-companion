import { cache } from 'react';
import type { Metadata } from 'next';

import { createAdminClient } from '@/lib/supabase/admin';
import { stateSlug, slugify } from '@/lib/geo';
import { LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl } from '@/lib/seo';

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

/**
 * Canonical, SEO-friendly path for a facility:
 *   /treatment/<state-slug>/<city-slug>/<facility-slug>
 * Falls back to the legacy /programs/<id> only if slug/city/state are missing
 * (shouldn't happen — every published row has all three).
 */
export function facilityCanonicalPath(f: {
  id: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  if (f.slug && f.city && f.state) {
    return `/treatment/${stateSlug(f.state.toUpperCase())}/${slugify(f.city)}/${f.slug}`;
  }
  return `/programs/${f.id}`;
}

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
