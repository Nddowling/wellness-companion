import type { Metadata } from 'next';

import NearbyResultsClient from './NearbyResultsClient';

export const metadata: Metadata = {
  title: 'Nearby Treatment Programs — Clear Bed Recovery',
  description: 'Explore treatment directory listings near a city or ZIP code.',
  robots: { index: false, follow: true, noarchive: true },
};

export default function NearbyProgramsPage() {
  return <NearbyResultsClient />;
}
