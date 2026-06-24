'use client';

import { useState } from 'react';
import Link from 'next/link';

import { NearbyMap } from '@/components/NearbyMap';
import type { NearbyFacility } from '@/lib/matching/nearby';
import { LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';

/**
 * Map + list of facilities in the current map frame. The map re-queries the visible
 * area on every pan/zoom (max 20, closest-to-you first) and feeds the in-view set here
 * so the list always mirrors what's on the map.
 */
export function NearbyExplorer({ origin, initial }: { origin: { lat: number; lng: number }; initial: NearbyFacility[] }) {
  const [facilities, setFacilities] = useState<NearbyFacility[]>(initial);

  return (
    <>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        <strong>{facilities.length}</strong> program{facilities.length === 1 ? '' : 's'} in view,{' '}
        <strong>closest first</strong>. Pan or zoom the map to explore a different area — the list follows. We show
        everyone in the frame and never rank or favor one program over another.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Map (left) */}
        <div className="h-[62vh] overflow-hidden rounded-xl border border-slate-200 lg:sticky lg:top-4">
          <NearbyMap origin={origin} initial={initial} onBoundsFacilities={setFacilities} />
        </div>

        {/* List (right) — mirrors the frame */}
        <ol className="space-y-2">
          {facilities.length === 0 && (
            <li className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              No programs in this part of the map.{' '}
              <Link href="/programs" className="font-medium text-teal-700 hover:underline">
                Browse the full directory
              </Link>
              , or zoom out.
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
  );
}
