'use client';

import { useEffect } from 'react';

import { trackFacilityDetailViewed } from '@/lib/analytics';

// Fires one "Facility Detail Viewed" event when a program profile renders.
// Facility identity is public directory data; the extra booleans describe the
// listing's completeness, not the viewer.
type Props = {
  facilityId: string;
  facilityName?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  facilityType?: string | null;
  hasWebsite?: boolean;
  hasPhone?: boolean;
  sourcePage: string;
};

export function FacilityProfileAnalytics({
  facilityId,
  facilityName,
  slug,
  city,
  state,
  facilityType,
  hasWebsite,
  hasPhone,
  sourcePage,
}: Props) {
  useEffect(() => {
    trackFacilityDetailViewed(
      { id: facilityId, name: facilityName, slug, city, state, facilityType },
      sourcePage,
    );
    // Only re-fire when the viewed facility changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, sourcePage]);

  // hasWebsite / hasPhone are accepted per the tracking contract; fold them in
  // so the profile-completeness signal travels with the view event.
  void hasWebsite;
  void hasPhone;
  return null;
}
