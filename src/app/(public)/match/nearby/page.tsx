import type { Metadata } from 'next';
import Link from 'next/link';

import { NearbyMap } from '@/components/NearbyMap';
import { getNearby } from '@/lib/matching/nearby';
import { LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Treatment near you',
  // Personalized results — not a page for the index.
  robots: { index: false, follow: false },
};

const RADIUS_MI = 25;

export default async function NearbyPage({
  searchParams,
}: {
  searchParams: Promise<{ zip?: string; city?: string; state?: string; lat?: string; lng?: string }>;
}) {
  const { zip, city, state, lat, lng } = await searchParams;
  const latN = lat ? Number(lat) : undefined;
  const lngN = lng ? Number(lng) : undefined;
  const { origin, facilities } = await getNearby({ zip, city, state, lat: latN, lng: lngN }, RADIUS_MI, 20);
  const where =
    Number.isFinite(latN) && Number.isFinite(lngN)
      ? 'your location'
      : (String(zip ?? '').match(/\d{5}/) || [])[0] || [city, state].filter(Boolean).join(', ');
  const hasMapKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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
        <>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            <strong>{facilities.length}</strong> program{facilities.length === 1 ? '' : 's'} within {RADIUS_MI} miles of{' '}
            {where}, <strong>closest first</strong>. Pick any to see its full profile — we show everyone nearby and
            never rank or favor one program over another.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Map (left) */}
            <div className="h-[62vh] overflow-hidden rounded-xl border border-slate-200 lg:sticky lg:top-4">
              {hasMapKey ? (
                <NearbyMap origin={origin} facilities={facilities} />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">
                  Map is being set up. The full list of nearby programs is on the right.
                </div>
              )}
            </div>

            {/* List (right) */}
            <ol className="space-y-2">
              {facilities.length === 0 && (
                <li className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                  No programs found within {RADIUS_MI} miles.{' '}
                  <Link href="/programs" className="font-medium text-teal-700 hover:underline">
                    Browse the full directory
                  </Link>
                  .
                </li>
              )}
              {facilities.map((f) => {
                const levels = (f.levels_of_care ?? [])
                  .map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l)
                  .slice(0, 4)
                  .join(' · ');
                return (
                  <li key={f.id}>
                    <Link
                      href={`/programs/${f.id}`}
                      className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-teal-300"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium text-slate-800">{f.name}</div>
                        <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
                          {f.miles.toFixed(1)} mi
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {[f.city, f.state].filter(Boolean).join(', ') || 'Location on file'}
                      </div>
                      {levels && <div className="mt-1 text-xs text-slate-500">{levels}</div>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}
    </main>
  );
}
