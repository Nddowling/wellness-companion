// Safe wrapper around Vercel Web Analytics custom events.
//
// PRIVACY (non-negotiable — this is a recovery/treatment directory):
// We NEVER send raw search text, names, emails, phone numbers, freeform
// messages, insurance member IDs, addiction/medical details, or anything that
// could identify a *seeker*. Only booleans, small categorical enums, public
// filter values (state codes, level-of-care keys), and coarse count buckets.
//
// Facility identity (id, business name, city, state, operator type) IS public
// directory data — a listed business, not a person — so it's safe to attach to
// facility-engagement events for attribution.
//
// Every call is wrapped in try/catch: analytics must NEVER break navigation,
// forms, phone links, or treatment search.

import { track } from '@vercel/analytics';

type Primitive = string | number | boolean | null | undefined;
type Props = Record<string, Primitive>;

/**
 * Fire a custom Vercel event. Drops `undefined` props (so callers can pass
 * optional fields freely) and swallows any error — a missing metric must never
 * surface to the user.
 */
export function safeTrack(eventName: string, properties?: Props): void {
  try {
    const clean: Record<string, string | number | boolean | null> = {};
    if (properties) {
      for (const [k, v] of Object.entries(properties)) {
        if (v !== undefined) clean[k] = v;
      }
    }
    track(eventName, clean);
  } catch {
    // analytics is best-effort; never let it throw into the UI
  }
}

/**
 * Coarse, non-identifying bucket for a result count. We deliberately avoid the
 * raw number so no single rare query can be de-anonymized by its result size.
 */
export function getResultCountBucket(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '0';
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  if (count <= 50) return '21-50';
  if (count <= 100) return '51-100';
  return '100+';
}

// Public directory facts about a facility — safe to attach to engagement events.
export type FacilityAnalytics = {
  id: string;
  name?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  facilityType?: string | null;
};

function facilityProps(f: FacilityAnalytics): Props {
  // `metro` = a single "City, ST" market label so the Vercel dashboard can segment
  // conversion events by market in one click (e.g. "calls in Savannah, GA").
  const metro = [f.city, f.state].filter(Boolean).join(', ') || undefined;
  return {
    facilityId: f.id,
    facilityName: f.name ?? undefined,
    slug: f.slug ?? undefined,
    metro,
    city: f.city ?? undefined,
    state: f.state ?? undefined,
    facilityType: f.facilityType ?? undefined,
  };
}

/* ------------------------------------------------------------------ *
 * Search & discovery
 * ------------------------------------------------------------------ */

export function trackSearchStarted(sourcePage: string): void {
  safeTrack('Search Started', { sourcePage });
}

export type SearchSubmittedParams = {
  sourcePage: string;
  searchType: string;
  hasQuery?: boolean;
  hasLocation?: boolean;
  hasInsuranceFilter?: boolean;
  hasLevelOfCareFilter?: boolean;
  hasSpecialtyFilter?: boolean;
  hasPopulationFilter?: boolean;
  region?: string;
};

export function trackSearchSubmitted(params: SearchSubmittedParams): void {
  safeTrack('Search Submitted', { ...params });
}

// Shape shared by results-viewed / no-results — all booleans + buckets, no raw text.
export type SearchResultsParams = {
  sourcePage: string;
  resultCountBucket: string;
  page?: number;
  hasQuery?: boolean;
  hasLocation?: boolean;
  hasInsuranceFilter?: boolean;
  hasLevelOfCareFilter?: boolean;
  hasSpecialtyFilter?: boolean;
  hasPopulationFilter?: boolean;
  hasOpenFilter?: boolean;
  region?: string;
};

export function trackSearchResultsViewed(params: SearchResultsParams): void {
  safeTrack('Search Results Viewed', { ...params });
}

export function trackSearchNoResults(params: SearchResultsParams): void {
  safeTrack('Search Returned No Results', { ...params });
}

export function trackFilterApplied(
  filterName: string,
  filterValueCategory: string,
  sourcePage: string,
): void {
  safeTrack('Filter Applied', { filterName, filterValueCategory, sourcePage });
}

export function trackSearchError(sourcePage: string, errorType: string): void {
  safeTrack('Search Error', { sourcePage, errorType });
}

/* ------------------------------------------------------------------ *
 * Facility engagement
 * ------------------------------------------------------------------ */

export function trackFacilityCardClicked(f: FacilityAnalytics, sourcePage: string): void {
  safeTrack('Facility Card Clicked', { ...facilityProps(f), sourcePage });
}

export function trackFacilityDetailViewed(f: FacilityAnalytics, sourcePage: string): void {
  safeTrack('Facility Detail Viewed', { ...facilityProps(f), sourcePage });
}

export function trackFacilityPhoneClicked(f: FacilityAnalytics, sourcePage: string): void {
  safeTrack('Facility Phone Clicked', { ...facilityProps(f), sourcePage });
}

export function trackFacilityEmailClicked(f: FacilityAnalytics, sourcePage: string): void {
  safeTrack('Facility Email Clicked', { ...facilityProps(f), sourcePage });
}

export function trackFacilityWebsiteClicked(f: FacilityAnalytics, sourcePage: string): void {
  safeTrack('Facility Website Clicked', { ...facilityProps(f), sourcePage });
}

export function trackFacilityDirectionsClicked(f: FacilityAnalytics, sourcePage: string): void {
  safeTrack('Facility Directions Clicked', { ...facilityProps(f), sourcePage });
}

/* ------------------------------------------------------------------ *
 * Claim-profile funnel (facility side)
 * ------------------------------------------------------------------ */

export function trackClaimProfileClicked(f: FacilityAnalytics, sourcePage: string): void {
  safeTrack('Claim Profile Clicked', { ...facilityProps(f), sourcePage });
}

export function trackClaimProfileStarted(f: FacilityAnalytics): void {
  safeTrack('Claim Profile Started', { ...facilityProps(f) });
}

export function trackClaimProfileSubmitted(f: FacilityAnalytics): void {
  safeTrack('Claim Profile Submitted', { ...facilityProps(f) });
}

/* ------------------------------------------------------------------ *
 * Forms & outbound links
 * ------------------------------------------------------------------ */

export function trackContactFormStarted(sourcePage: string): void {
  safeTrack('Contact Form Started', { sourcePage });
}

export function trackContactFormSubmitted(sourcePage: string): void {
  safeTrack('Contact Form Submitted', { sourcePage });
}

export function trackFormValidationError(formName: string, fieldName: string): void {
  safeTrack('Form Validation Error', { formName, fieldName });
}

export function trackExternalLinkClicked(
  label: string,
  destinationCategory: string,
  sourcePage: string,
): void {
  safeTrack('External Link Clicked', { label, destinationCategory, sourcePage });
}
