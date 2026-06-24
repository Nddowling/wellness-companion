import type { Metadata } from 'next';
import Link from 'next/link';

import { NearbyExplorer } from '@/components/NearbyExplorer';
import { getNearby } from '@/lib/matching/nearby';

export const metadata: Metadata = {
  title: 'Treatment near you',
  // Personalized results — not a page for the index.
  robots: { index: false, follow: false },
};

// First paint only — the map then re-queries by the visible frame as the user explores.
const INITIAL_RADIUS_MI = 35;

export default async function NearbyPage({
  searchParams,
}: {
  searchParams: Promise<{ zip?: string; city?: string; state?: string; lat?: string; lng?: string }>;
}) {
  const { zip, city, state, lat, lng } = await searchParams;
  const latN = lat ? Number(lat) : undefined;
  const lngN = lng ? Number(lng) : undefined;
  const { origin, facilities } = await getNearby({ zip, city, state, lat: latN, lng: lngN }, INITIAL_RADIUS_MI, 20);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Link href="/match" className="text-sm text-teal-700 hover:underline">
        ← Back to the guide
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-ink sm:text-3xl">Treatment near you</h1>

      {!origin ? (
        <p className="mt-3 rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600">
          We couldn&apos;t pin down a location to search from.{' '}
          <Link href="/match" className="font-medium text-teal-700 hover:underline">
            Start the guide
          </Link>{' '}
          and share your ZIP, or{' '}
          <Link href="/programs" className="font-medium text-teal-700 hover:underline">
            browse all programs
          </Link>
          .
        </p>
      ) : (
        <NearbyExplorer origin={origin} initial={facilities} />
      )}
    </main>
  );
}
