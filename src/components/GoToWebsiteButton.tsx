'use client';

import { trackFacilityWebsiteClicked } from '@/lib/analytics';

/** Outbound website action with facility-level analytics only. */
export function GoToWebsiteButton({
  facilityId,
  className,
  children,
  facilityName,
  slug,
  city,
  state,
  sourcePage,
}: {
  facilityId: string;
  className?: string;
  children: React.ReactNode;
  // Optional — existing call sites pass only facilityId.
  facilityName?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  sourcePage?: string;
}) {
  function handleClick() {
    trackFacilityWebsiteClicked(
      { id: facilityId, name: facilityName, slug, city, state },
      sourcePage ?? 'facility_profile',
    );
  }

  return (
    <a
      href={`/go/${facilityId}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}
