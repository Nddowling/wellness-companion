'use client';

import { useEffect } from 'react';

import { trackClaimProfileStarted, trackClaimProfileSubmitted, type FacilityAnalytics } from '@/lib/analytics';

// Fires the claim-funnel conversion events (Claim Profile Started / Submitted) from
// the /claim page. Only fires when the claim is attributed to a facility (the primary
// path: "Claim this profile" deep-links from a listing), so events carry slug + metro.
export function ClaimFunnelAnalytics({
  facility,
  submitted,
}: {
  facility?: FacilityAnalytics;
  submitted?: boolean;
}) {
  useEffect(() => {
    if (!facility) return;
    if (submitted) trackClaimProfileSubmitted(facility);
    else trackClaimProfileStarted(facility);
    // Fire once on mount for the current funnel step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
