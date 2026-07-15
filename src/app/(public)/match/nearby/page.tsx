import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Browse treatment by location',
  robots: { index: false, follow: false },
};

// Retired privacy-incompatible route. Older versions accepted full ZIP/city and
// coordinate query parameters, which put treatment-seeking location in URLs. The
// current search uses coarse state filters or an in-memory ZIP3 guided step.
export default function NearbyPage() {
  redirect('/treatment');
}
