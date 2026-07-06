'use client';

import Link from 'next/link';

import { trackClaimProfileClicked, type FacilityAnalytics } from '@/lib/analytics';

// Client wrapper around the "Claim this profile" links so we can fire a Vercel
// custom event before navigation. Facility identity is public directory data.
export function ClaimProfileLink({
  facility,
  sourcePage,
  href,
  className,
  children,
}: {
  facility: FacilityAnalytics;
  sourcePage: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackClaimProfileClicked(facility, sourcePage)}
    >
      {children}
    </Link>
  );
}
