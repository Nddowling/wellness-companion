import type { Metadata } from 'next';
import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';
import { LEVELS_OF_CARE, LEVEL_LABELS, PAYER_LABELS, PAYER_TYPES, type CapacityRow, type LevelOfCare, type PayerType } from '@/lib/constants';
import { BedChip } from '@/components/FacilityCard';
import { FilterBar, type Facets } from '@/components/FilterBar';
import { Breadcrumb, breadcrumbJsonLd, DisclosurePanel } from '@/components/ui';
import { absoluteUrl } from '@/lib/seo';

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
  const [rowsRes, countRes, facetRes] = await Promise.all([
    client.rpc('facilities_search', { ...filters, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    client.rpc('facilities_search_count', filters),
    client.rpc('facilities_facet_counts', filters),
  ]);

  const rows = (rowsRes.data as Row[]) ?? [];
  const total = Number(countRes.data ?? 0);
  const facets = (facetRes.data as Facets) ?? { levels: {}, payers: {}, regions: {} };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Pagination hrefs keep the active filters (changing a filter is handled by FilterBar).
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ level: validLevel ?? undefined, region, q, pay: validPay ?? undefined, spec, pop, open })) if (v) p.set(k, v);
    if (n > 1) p.set('page', String(n));
    const s = p.toString();
    return s ? `/programs?${s}` : '/programs';
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const crumbs = [{ label: 'All Centers', href: '/' }, { label: 'Browse programs' }];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)) }}
      />
      <Breadcrumb items={crumbs} />

      <div className="mt-3">
        <h1 className="h1 text-ink">Browse treatment programs</h1>
        <p className="lead mt-1 max-w-2xl">
          Every program in our directory — filter by care, insurance, and location. There&apos;s no wrong way to look.
        </p>
        <Link href="/treatment" className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline">
          Browse by state &amp; city →
        </Link>
      </div>

      <div className="mt-5">
        <FilterBar facets={facets} />
      </div>

      <div className="mt-4">
        <DisclosurePanel label="How we rank results" tone="trust" icon={<span aria-hidden>⚖️</span>}>
          We list every licensed program the same way. Sponsors pay a <strong>flat fee</strong> and are clearly
          labeled — they never outrank a program that better fits your needs, and we never take per-admission or
          per-call fees.{' '}
          <Link href="/how-we-make-money" className="font-medium text-teal-700 underline">
            How we make money →
          </Link>
        </DisclosurePanel>
      </div>

      <p className="mt-5 text-sm text-slate-500">
        <span className="font-semibold text-ink">{total.toLocaleString()}</span> program{total === 1 ? '' : 's'}
        {total > PAGE_SIZE && ` · showing ${from.toLocaleString()}–${to.toLocaleString()}`}
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No programs match those filters. Try widening the location or clearing a filter above.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
