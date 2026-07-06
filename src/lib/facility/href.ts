import { stateSlug, slugify } from '@/lib/geo';

// Pure (client-safe) canonical-path helper — no server-only imports, so it can be
// used in both server and client components for internal <Link>s.
export type FacilityRef = { id: string; slug?: string | null; city?: string | null; state?: string | null };

/**
 * Canonical, SEO-friendly path for a facility profile:
 *   /treatment/<state-slug>/<city-slug>/<facility-slug>
 * Falls back to the legacy /programs/<id> (which 301s) only when slug/city/state
 * are missing, so callers can link safely even on rows that didn't select slug.
 */
export function facilityPath(f: FacilityRef): string {
  if (f.slug && f.city && f.state) {
    return `/treatment/${stateSlug(f.state.toUpperCase())}/${slugify(f.city)}/${f.slug}`;
  }
  return `/programs/${f.id}`;
}
