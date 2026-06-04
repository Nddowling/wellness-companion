import type { Metadata } from 'next';
import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';
import { LEVELS_OF_CARE, LEVEL_LABELS, PAYER_LABELS, type LevelOfCare, type PayerType } from '@/lib/constants';
import { absoluteUrl } from '@/lib/seo';

const PROGRAMS_TITLE = 'Browse Treatment Programs — Rehab & Recovery Directory';
const PROGRAMS_DESCRIPTION =
  'Browse our full directory of addiction and mental-health treatment programs — detox, residential, PHP, IOP, and outpatient — with accepted insurance and real-time bed availability.';

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
  searchParams: Promise<{ level?: string; q?: string }>;
}) {
  const { level, q } = await searchParams;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('facilities')
    .select('id, name, city, state, levels_of_care, carriers_named, facility_payers(payer_type)')
    .eq('is_published', true)
    .order('name');

  let rows = (data ?? []) as Row[];
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

  const tabClass = (active: boolean) =>
    'rounded-full px-3 py-1 text-xs font-medium ' +
    (active ? 'bg-teal-700 text-white' : 'border border-slate-300 text-slate-600 hover:border-teal-400');

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/match" className="text-sm text-teal-700">
        ← Back to your matches
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-slate-800">Browse treatment programs</h1>
        <p className="text-sm text-slate-500">
          Every program in our directory. Explore on your own — there&apos;s no wrong way to look.
        </p>
      </div>

      {/* Level filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/programs" className={tabClass(!level)}>
          All
        </Link>
        {LEVELS_OF_CARE.map((l) => (
          <Link key={l} href={`/programs?level=${l}`} className={tabClass(level === l)}>
            {LEVEL_LABELS[l]}
          </Link>
        ))}
      </div>

      {/* Search */}
      <form className="mt-3 flex gap-2" action="/programs">
        {level && <input type="hidden" name="level" value={level} />}
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name or city…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Search</button>
      </form>

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
            <div className="font-medium text-slate-800">{r.name}</div>
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
