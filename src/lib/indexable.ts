// Single source of truth for what may be indexed — consumed by page metadata, the
// sitemap, and the Playwright SEO suite so all three can never disagree.
//
// This is the real staging/quality gate (more reliable than sitemap segmentation):
// thin programmatic combos and un-enriched stub profiles carry noindex,follow and are
// kept out of the sitemap, so Google spends crawl/index budget on pages that earn it.

import type { Metadata } from 'next';

export const MIN_FACILITIES_TO_INDEX = 3;

// Master switch. The noindex/sitemap-exclusion gate ships OFF and is flipped ON in
// SEQ-4, AFTER enrichment — so no page is ever noindexed before it's been enriched
// (per the enrichment-first sequencing). While false, everything stays indexable.
export const INDEX_GATES_ENABLED = false;

const nonEmpty = (s: unknown): boolean => typeof s === 'string' && s.trim() !== '';

/**
 * A programmatic landing combo (city hub, state×level, city×level, insurance×state)
 * is indexable only with ≥3 matching facilities. State hubs are exempt (never thin).
 */
export function landingIndexable(facilityCount: number): boolean {
  if (!INDEX_GATES_ENABLED) return true;
  return facilityCount >= MIN_FACILITIES_TO_INDEX;
}

/**
 * A facility profile is indexable only with Pass-1 presence: a real way to reach it
 * (phone/intake line/website) AND at least one level of care. Excludes true stubs;
 * everything richer indexes on structured differentiation (availability, verified
 * dates, computed signals) rather than prose.
 */
export function profileIndexable(f: {
  main_phone?: string | null;
  intake_line?: string | null;
  website?: string | null;
  levels_of_care?: string[] | null;
}): boolean {
  if (!INDEX_GATES_ENABLED) return true;
  const hasContact = nonEmpty(f.main_phone) || nonEmpty(f.intake_line) || nonEmpty(f.website);
  const hasLevel = Array.isArray(f.levels_of_care) && f.levels_of_care.length >= 1;
  return hasContact && hasLevel;
}

/** metadata.robots value: undefined when indexable, else noindex,follow. */
export function robotsFor(indexable: boolean): Metadata['robots'] {
  return indexable ? undefined : { index: false, follow: true };
}
