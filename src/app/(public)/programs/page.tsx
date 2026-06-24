import type { Metadata } from 'next';
import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';
import { LEVELS_OF_CARE, LEVEL_LABELS, PAYER_LABELS, PAYER_TYPES, type CapacityRow, type LevelOfCare, type PayerType } from '@/lib/constants';
import { US_STATES } from '@/lib/geo';
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
  openGraph: { title: PROGRAMS_TITLE, description: PROGRAMS_DESCRIPTION, url: absoluteUrl('/programs') },
};

const PAGE_SIZE = 24;

type Row = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  levels_of_care: string[];
  carriers_named: string[] | null;
  facility_payers: { payer_type: string }[] | null;
  facility_capacity: CapacityRow[] | null;
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
  searchParams: Promise<{ level?: string; q?: string; region?: string; pay?: string; open?: string; spec?: string; pop?: string; page?: string }>;
}) {
  const { level, q, region, pay, open, spec, pop, page: pageParam } = await searchParams;
  const providerSide = isProviderSide(await getRoles());

  const validLevel = level && (LEVELS_OF_CARE as readonly string[]).includes(level) ? level : null;
  const validPay = pay && (PAYER_TYPES as readonly string[]).includes(pay) ? pay : null;
  const page = Math.max(1, Number(pageParam) || 1);

  // All filtering/counting/paging runs in Postgres (no 1,000-row PostgREST cap), so
  // the directory searches the WHOLE table and returns just this page + true totals.
  const filters = {
    p_region: region || null,
    p_level: validLevel,
    p_pay: validPay,
    p_spec: spec?.trim() || null,
    p_pop: pop?.trim() || null,
    p_q: q?.trim() || null,
    p_open: !!open,
  };

  const admin = createAdminClient();
  // RPCs aren't in the generated types — cast the client (receiver intact).
  const client = admin as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const [rowsRes, countRes, statesRes] = await Promise.all([
    client.rpc('facilities_search', { ...filters, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    client.rpc('facilities_search_count', filters),
    client.rpc('facilities_state_counts', {}),
  ]);

  const rows = (rowsRes.data as Row[]) ?? [];
  const total = Number(countRes.data ?? 0);
  const states = ((statesRes.data as { state: string }[]) ?? []).map((s) => s.state);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(validLevel || region || q || validPay || open || spec || pop);

  // Build hrefs that keep the active filters. Changing a filter resets to page 1.
  const params = (overrides: Record<string, string | undefined>) => {
    const cur: Record<string, string | undefined> = {
      level: validLevel ?? undefined,
      region,
      q,
      pay: validPay ?? undefined,
      spec,
      pop,
      open,
      ...overrides,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    return p;
  };
  const hrefFor = (l?: string) => {
    const s = params({ level: l, page: undefined }).toString();
    return s ? `/programs?${s}` : '/programs';
  };
  const pageHref = (n: number) => {
    const s = params({ page: n > 1 ? String(n) : undefined }).toString();
    return s ? `/programs?${s}` : '/programs';
  };

  const tabClass = (active: boolean) =>
    'rounded-full px-3 py-1 text-xs font-medium ' +
    (active ? 'bg-teal-700 text-white' : 'border border-slate-300 text-slate-600 hover:border-teal-400');

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
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

      {/* Treatment-type filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={hrefFor(undefined)} className={tabClass(!validLevel)}>
          All
        </Link>
        {LEVELS_OF_CARE.map((l) => (
          <Link key={l} href={hrefFor(l)} className={tabClass(validLevel === l)}>
            {LEVEL_LABELS[l]}
          </Link>
        ))}
      </div>

      {/* Region + insurance + search. One GET form so the filters compose (resets to page 1). */}
      <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap" action="/programs">
        {validLevel && <input type="hidden" name="level" value={validLevel} />}
        {spec && <input type="hidden" name="spec" value={spec} />}
        {pop && <input type="hidden" name="pop" value={pop} />}
        <select name="region" defaultValue={region ?? ''} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
          <option value="">All regions</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {US_STATES[s] ?? s}
            </option>
          ))}
        </select>
        <select name="pay" defaultValue={validPay ?? ''} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
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
          placeholder="Name, city, condition…"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm sm:min-w-[10rem]"
        />
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
          <input type="checkbox" name="open" value="1" defaultChecked={!!open} className="h-4 w-4 rounded border-slate-300" />
          Available now
        </label>
        <button className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white sm:w-auto">Search</button>
      </form>
      {hasFilters && (
        <Link href="/programs" className="mt-2 inline-block text-xs text-slate-500 underline hover:text-teal-700">
          Clear filters
        </Link>
      )}

      <p className="mt-4 text-xs text-slate-400">
        {total.toLocaleString()} program{total === 1 ? '' : 's'}
        {total > PAGE_SIZE && ` · showing ${from.toLocaleString()}–${to.toLocaleString()}`}
      </p>

      {rows.length === 0 ? (
        <p className="mt-2 rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No programs match that filter. Try a different level or clear the search.
        </p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {rows.map((r) => {
            const loc = [r.city, r.state].filter(Boolean).join(', ') || 'Location on file';
            const levelChips = (r.levels_of_care ?? []).map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l);
            return (
              <Link
                key={r.id}
                href={`/programs/${r.id}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-sage/10 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-800 group-hover:text-teal-800">{r.name}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{loc}</div>
                  </div>
                  <BedChip caps={r.facility_capacity} levels={r.levels_of_care} />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  {levelChips.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {levelChips.slice(0, 4).map((l) => (
                        <span key={l} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Accepts:</span> {acceptedSummary(r)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:border-teal-400 hover:text-teal-700">
              ← Previous
            </Link>
          ) : (
            <span className="rounded-md border border-slate-200 px-4 py-2 text-slate-300">← Previous</span>
          )}
          <span className="text-slate-500">
            Page {page} of {totalPages.toLocaleString()}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:border-teal-400 hover:text-teal-700">
              Next →
            </Link>
          ) : (
            <span className="rounded-md border border-slate-200 px-4 py-2 text-slate-300">Next →</span>
          )}
        </div>
      )}
    </main>
  );
}
