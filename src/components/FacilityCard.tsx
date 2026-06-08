import Link from 'next/link';

import { LEVEL_LABELS, bedSummary, type CapacityRow, type LevelOfCare } from '@/lib/constants';

export type FacilityCardData = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  levels_of_care: string[] | null;
  facility_capacity?: CapacityRow[] | null;
};

const BED_TONE = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-slate-100 text-slate-600',
} as const;

/** Compact bed-availability chip — shown on every facility card. */
export function BedChip({ caps, levels }: { caps?: CapacityRow[] | null; levels?: string[] | null }) {
  const { label, tone } = bedSummary(caps, levels);
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${BED_TONE[tone]}`}>{label}</span>;
}

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
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-slate-800">{f.name}</div>
        <BedChip caps={f.facility_capacity} levels={f.levels_of_care} />
      </div>
      <div className="mt-0.5 text-xs text-slate-500">{loc || 'Location on file'}</div>
      {levels && <div className="mt-1 text-xs text-slate-500">{levels}</div>}
    </Link>
  );
}
