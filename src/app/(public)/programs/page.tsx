import type { Metadata } from 'next';
import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';
import { LEVELS_OF_CARE, LEVEL_LABELS, PAYER_LABELS, PAYER_TYPES, isBedBased, type CapacityRow, type LevelOfCare, type PayerType } from '@/lib/constants';
import { BedChip } from '@/components/FacilityCard';
import { absoluteUrl } from '@/lib/seo';
import { getRoles, isProviderSide } from '@/lib/auth';

const PROGRAMS_TITLE = 'Browse Treatment Programs — Rehab & Recovery Directory';
const PROGRAMS_DESCRIPTION =
  'Browse our directory of addiction treatment programs — including care for co-occurring mental-health needs — across detox, residential, PHP, IOP, and outpatient, with accepted insurance and real-time bed availability.';

export const metadata: Metadata = {
  title: PROGRAMS_TITLE,
  description: PROGRAMS_DESCRIPTION,
  alternates: { canonical: '/programs' },
  openGraph: {
    title: PROGRAMS_TITLE,
    description: PROGRAMS_DESCRIPTION,
    url: absoluteUrl('/programs'),
  },
};

type Row = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  levels_of_care: string[];
  carriers_named: string[];
  facility_payers: { payer_type: string }[];
  facility_capacity: CapacityRow[];
};

function acceptedSummary(r: Row): string {
  const gov = (r.facility_payers ?? [])
    .filter((p) => p.payer_type !== 'commercial')
    .map((p) => PAYER_LABELS[p.payer_type as PayerType] ?? p.payer_type);
  const all = [...gov, ...(r.carriers_named ?? [])];
  if (!all.length) return 'Call to verify coverage';
  return all.slice(0, 4).join(' · ') + (all.length > 4 ? ` +${all.length - 4} more` : '');
}

export default async function ProgramsDirectory({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; q?: string; region?: string; pay?: string; open?: string }>;
}) {
  const { level, q, region, pay, open } = await searchParams;
  const providerSide = isProviderSide(await getRoles());
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('facilities')
    .select('id, name, city, state, levels_of_care, carriers_named, facility_payers(payer_type), facility_capacity(level_of_care, beds_available, last_updated)')
    .eq('is_published', true)
    .order('name');

  const all = (data ?? []) as Row[];
  // Region options come from the states actually present in the directory.
  const states = [...new Set(all.map((r) => r.state).filter((s): s is string => !!s))].sort();

  let rows = all;
  if (region) rows = rows.filter((r) => r.state === region);
  if (level && LEVELS_OF_CARE.includes(level as LevelOfCare)) {
    rows = rows.filter((r) => (r.levels_of_care ?? []).includes(level));
  }
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        [r.city, r.state].filter(Boolean).join(', ').toLowerCase().includes(needle)
    );
  }
  // Referrer axes: payment accepted, and "available now" (open overnight beds, or
  // outpatient — which is always accepting).
  if (pay && (PAYER_TYPES as readonly string[]).includes(pay)) {
    rows = rows.filter((r) => (r.facility_payers ?? []).some((p) => p.payer_type === pay));
  }
  if (open) {
    rows = rows.filter((r) => {
      const openBeds = (r.facility_capacity ?? []).some((c) => isBedBased(c.level_of_care) && c.beds_available > 0);
      const hasBedLevel = (r.levels_of_care ?? []).some(isBedBased);
      return openBeds || !hasBedLevel;
    });
  }

  // Build a /programs href that keeps the other filters intact.
  const hrefFor = (l?: string) => {
    const p = new URLSearchParams();
    if (l) p.set('level', l);
    if (region) p.set('region', region);
    if (q) p.set('q', q);
    if (pay) p.set('pay', pay);
    if (open) p.set('open', open);
    const s = p.toString();
    return s ? `/programs?${s}` : '/programs';
  };

  const tabClass = (active: boolean) =>
    'rounded-full px-3 py-1 text-xs font-medium ' +
    (active ? 'bg-teal-700 text-white' : 'border border-slate-300 text-slate-600 hover:border-teal-400');

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {!providerSide && (
        <Link href="/match" className="text-sm text-teal-700">
          ← Back to your matches
        </Link>
      )}

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-slate-800">Browse treatment programs</h1>
        <p className="text-sm text-slate-500">
          Every program in our directory. Explore on your own — there&apos;s no wrong way to look.
        </p>
        <Link href="/treatment" className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline">
          Browse by state &amp; city →
        </Link>
      </div>

      {/* Treatment-type filter (always available) */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={hrefFor(undefined)} className={tabClass(!level)}>
          All
        </Link>
        {LEVELS_OF_CARE.map((l) => (
          <Link key={l} href={hrefFor(l)} className={tabClass(level === l)}>
            {LEVEL_LABELS[l]}
          </Link>
        ))}
      </div>

      {/* Region + search (always available). One GET form so all three filters compose. */}
      <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap" action="/programs">
        {level && <input type="hidden" name="level" value={level} />}
        <select
          name="region"
          defaultValue={region ?? ''}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
        >
          <option value="">All regions</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="pay"
          defaultValue={pay ?? ''}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
        >
          <option value="">Any insurance</option>
          {PAYER_TYPES.map((pt) => (
            <option key={pt} value={pt}>
              {PAYER_LABELS[pt]}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name or city…"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm sm:min-w-[10rem]"
        />
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
          <input
            type="checkbox"
            name="open"
            value="1"
            defaultChecked={!!open}
            className="h-4 w-4 rounded border-slate-300"
          />
          Available now
        </label>
        <button className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white sm:w-auto">
          Search
        </button>
      </form>
      {(level || region || q || pay || open) && (
        <Link href="/programs" className="mt-2 inline-block text-xs text-slate-500 underline hover:text-teal-700">
          Clear filters
        </Link>
      )}

      <p className="mt-4 text-xs text-slate-400">{rows.length} programs</p>

      <div className="mt-2 space-y-2">
        {rows.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No programs match that filter. Try a different level or clear the search.
          </p>
        )}
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/programs/${r.id}`}
            className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-300"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-slate-800">{r.name}</div>
              <BedChip caps={r.facility_capacity} levels={r.levels_of_care} />
            </div>
            <div className="text-xs text-slate-500">
              {[r.city, r.state].filter(Boolean).join(', ') || 'Location on file'} ·{' '}
              {(r.levels_of_care ?? []).map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l).join(', ') || 'Programs vary'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Accepts: {acceptedSummary(r)}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
