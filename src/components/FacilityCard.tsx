import Link from 'next/link';

import { LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';

export type FacilityCardData = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  levels_of_care: string[] | null;
};

/** Compact, linkable program card used across the directory + SEO landing pages. */
export function FacilityCard({ f }: { f: FacilityCardData }) {
  const loc = [f.city, f.state].filter(Boolean).join(', ');
  const levels = (f.levels_of_care ?? [])
    .map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l)
    .join(' · ');
  return (
    <Link
      href={`/programs/${f.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-teal-300"
    >
      <div className="font-medium text-slate-800">{f.name}</div>
      <div className="mt-0.5 text-xs text-slate-500">{loc || 'Location on file'}</div>
      {levels && <div className="mt-1 text-xs text-slate-500">{levels}</div>}
    </Link>
  );
}
