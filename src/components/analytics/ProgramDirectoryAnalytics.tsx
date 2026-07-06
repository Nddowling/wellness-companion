'use client';

import { useEffect } from 'react';

import { getResultCountBucket, trackSearchNoResults, trackSearchResultsViewed } from '@/lib/analytics';

// Fires exactly one search-outcome event per rendered directory result set.
// Everything sent is a boolean, a coarse count bucket, a page number, or a
// public region code — never the raw query text or any seeker-identifying data.
type Props = {
  total: number;
  page: number;
  hasQuery: boolean;
  hasLocation: boolean;
  hasInsuranceFilter: boolean;
  hasLevelOfCareFilter: boolean;
  hasSpecialtyFilter: boolean;
  hasPopulationFilter: boolean;
  hasOpenFilter: boolean;
  region?: string;
};

export function ProgramDirectoryAnalytics({
  total,
  page,
  hasQuery,
  hasLocation,
  hasInsuranceFilter,
  hasLevelOfCareFilter,
  hasSpecialtyFilter,
  hasPopulationFilter,
  hasOpenFilter,
  region,
}: Props) {
  useEffect(() => {
    const shared = {
      sourcePage: 'programs_directory',
      page,
      hasQuery,
      hasLocation,
      hasInsuranceFilter,
      hasLevelOfCareFilter,
      hasSpecialtyFilter,
      hasPopulationFilter,
      hasOpenFilter,
      region,
    };
    if (total === 0) {
      trackSearchNoResults({ ...shared, resultCountBucket: '0' });
    } else {
      trackSearchResultsViewed({ ...shared, resultCountBucket: getResultCountBucket(total) });
    }
    // Re-fire when the result set identity changes (new filters/page/region).
  }, [
    total,
    page,
    hasQuery,
    hasLocation,
    hasInsuranceFilter,
    hasLevelOfCareFilter,
    hasSpecialtyFilter,
    hasPopulationFilter,
    hasOpenFilter,
    region,
  ]);

  return null;
}
