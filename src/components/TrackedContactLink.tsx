'use client';

import {
  trackFacilityPhoneClicked,
  trackFacilityDirectionsClicked,
  trackFacilityEmailClicked,
} from '@/lib/analytics';

// A contact link (call / directions / email) that records a de-identified
// engagement event before the browser follows it — feeding the facility's
// performance summary. Uses sendBeacon so it fires even as the page hands off
// to the dialer/maps/mail app. Attaches the seeker's match_id when present
// (same localStorage source as the outbound website link), for attribution.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function TrackedContactLink({
  facilityId,
  eventType,
  href,
  target,
  rel,
  className,
  children,
  facilityName,
  slug,
  city,
  state,
  sourcePage,
}: {
  facilityId: string;
  eventType: 'call' | 'directions' | 'email';
  href: string;
  target?: string;
  rel?: string;
  className?: string;
  children: React.ReactNode;
  // Optional — existing call sites pass only facilityId/eventType/href.
  facilityName?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  sourcePage?: string;
}) {
  function onClick() {
    // Vercel custom event (best-effort; helpers already swallow their own errors).
    const facility = { id: facilityId, name: facilityName, slug, city, state };
    const page = sourcePage ?? 'facility_profile';
    if (eventType === 'call') trackFacilityPhoneClicked(facility, page);
    else if (eventType === 'directions') trackFacilityDirectionsClicked(facility, page);
    else if (eventType === 'email') trackFacilityEmailClicked(facility, page);

    try {
      let matchId: string | null = null;
      const raw = localStorage.getItem('wc_matches');
      const m = raw ? (JSON.parse(raw)?.match_id as unknown) : null;
      if (typeof m === 'string' && UUID_RE.test(m)) matchId = m;

      const body = JSON.stringify({ facilityId, type: eventType, matchId });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/track', {
          method: 'POST',
          body,
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {
      // a missing metric must never break the contact action
    }
  }

  return (
    <a href={href} target={target} rel={rel} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
