import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';
import { LEVELS_OF_CARE, LEVEL_LABELS, PAYER_LABELS, PAYER_TYPES, isBedBased, type CapacityRow, type LevelOfCare, type PayerType } from '@/lib/constants';
import { BedChip } from '@/components/FacilityCard';
import { FilterBar, type Facets } from '@/components/FilterBar';
import { ProgramDirectoryAnalytics } from '@/components/analytics/ProgramDirectoryAnalytics';
import { Breadcrumb, breadcrumbJsonLd, DisclosurePanel } from '@/components/ui';
import { absoluteUrl } from '@/lib/seo';
import { US_STATES } from '@/lib/geo';
import { serializeJsonLd } from '@/components/JsonLd';

const PROGRAMS_TITLE = 'Browse Treatment Programs — Rehab & Recovery Directory';
const PROGRAMS_DESCRIPTION =
  'Browse addiction treatment directory records across detox, residential, PHP, IOP, and outpatient, with listed payment options and dated availability reports.';

const PROGRAMS_METADATA: Metadata = {
  title: PROGRAMS_TITLE,
  description: PROGRAMS_DESCRIPTION,
  alternates: { canonical: '/programs' },
  openGraph: { title: PROGRAMS_TITLE, description: PROGRAMS_DESCRIPTION, url: absoluteUrl('/programs') },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const query = await searchParams;
  return {
    ...PROGRAMS_METADATA,
    // Faceted and paginated variants are useful navigation, not standalone
    // landing pages. Keep one indexable canonical directory URL and let crawlers
    // follow result links without indexing every query combination.
    ...(Object.keys(query).length > 0
      ? { robots: { index: false, follow: true, noarchive: true } }
      : {}),
  };
}

const PAGE_SIZE = 24;
const MAX_PAGE = 1_000;
const PUBLIC_SPECIALTY_FILTERS = new Set(['occurring', 'trauma', 'mat', 'substance']);
const PUBLIC_POPULATION_FILTERS = new Set([
  'men',
  'women',
  'adolescent',
  'young adult',
  'veteran',
  'senior',
  'pregnant',
]);
const ALLOWED_QUERY_KEYS = new Set(['level', 'region', 'pay', 'open', 'spec', 'pop', 'page']);

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

function paymentSummary(r: Row): string {
  const gov = (r.facility_payers ?? [])
    .filter((p) => p.payer_type !== 'commercial')
    .map((p) => PAYER_LABELS[p.payer_type as PayerType] ?? p.payer_type);
  const all = [...gov, ...(r.carriers_named ?? [])];
  if (!all.length) return 'Call to verify payment options';
  return all.slice(0, 4).join(' · ') + (all.length > 4 ? ` +${all.length - 4} more` : '');
}

export default async function ProgramsDirectory({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; q?: string; region?: string; pay?: string; open?: string; spec?: string; pop?: string; page?: string }>;
}) {
  const raw = await searchParams;
  const { level, q, region, pay, open, spec, pop, page: pageParam } = raw;

  const validLevel = level && (LEVELS_OF_CARE as readonly string[]).includes(level) ? level : null;
  const validPay = pay && (PAYER_TYPES as readonly string[]).includes(pay) ? pay : null;
  const validRegion = region && Object.hasOwn(US_STATES, region) ? region : null;
  const validSpec = spec && PUBLIC_SPECIALTY_FILTERS.has(spec) ? spec : null;
  const validPop = pop && PUBLIC_POPULATION_FILTERS.has(pop) ? pop : null;
  const page = pageParam && /^\d+$/.test(pageParam)
    ? Math.min(MAX_PAGE, Math.max(1, Number(pageParam)))
    : 1;
  const bedReportEligible = validLevel === null || isBedBased(validLevel);
  const openFilter = bedReportEligible && open === '1';

  const hasUnsafeOrNonCanonicalParam =
    Object.keys(raw).some((key) => !ALLOWED_QUERY_KEYS.has(key)) ||
    q !== undefined ||
    (level !== undefined && level !== validLevel) ||
    (pay !== undefined && pay !== validPay) ||
    (region !== undefined && region !== validRegion) ||
    (spec !== undefined && spec !== validSpec) ||
    (pop !== undefined && pop !== validPop) ||
    (open !== undefined && (!openFilter || open !== '1')) ||
    (pageParam !== undefined && (page === 1 || pageParam !== String(page)));

  // Older directory search linked arbitrary free text in `q`, which could put a
  // treatment narrative into browser history and request logs. Strip that legacy
  // parameter while preserving the coarse, allow-listed facets.
  if (hasUnsafeOrNonCanonicalParam) {
    const safe = new URLSearchParams();
    for (const [key, value] of Object.entries({
      level: validLevel ?? undefined,
      region: validRegion ?? undefined,
      pay: validPay ?? undefined,
      spec: validSpec ?? undefined,
      pop: validPop ?? undefined,
      open: openFilter ? '1' : undefined,
      page: page > 1 ? String(page) : undefined,
    })) {
      if (value) safe.set(key, value);
    }
    const query = safe.toString();
    redirect(query ? `/programs?${query}` : '/programs');
  }

  // All filtering/counting/paging runs in Postgres (no 1,000-row PostgREST cap), so
  // the directory searches the WHOLE table and returns just this page + true totals.
  const filters = {
    p_region: validRegion,
    p_level: validLevel,
    p_pay: validPay,
    p_spec: validSpec,
    p_pop: validPop,
    p_q: null,
    p_open: openFilter,
  };

  const admin = createAdminClient();
  // RPCs aren't in the generated types — cast the client (receiver intact).
  const client = admin as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;
  };
  const [rowsRes, countRes, facetRes] = await Promise.all([
    client.rpc('facilities_search', { ...filters, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    client.rpc('facilities_search_count', filters),
    client.rpc('facilities_facet_counts', filters),
  ]);

  if (rowsRes.error || countRes.error || facetRes.error) {
    console.error('[directory] database RPC failed', {
      rows: rowsRes.error?.code ?? null,
      count: countRes.error?.code ?? null,
      facets: facetRes.error?.code ?? null,
    });
    throw new Error('The treatment directory is temporarily unavailable.');
  }

  const rows = (rowsRes.data as Row[]) ?? [];
  const total = Number(countRes.data ?? 0);
  const facets = (facetRes.data as Facets) ?? { levels: {}, payers: {}, regions: {} };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Pagination hrefs keep the active filters (changing a filter is handled by FilterBar).
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ level: validLevel ?? undefined, region: validRegion ?? undefined, pay: validPay ?? undefined, spec: validSpec ?? undefined, pop: validPop ?? undefined, open: openFilter ? '1' : undefined })) if (v) p.set(k, v);
    if (n > 1) p.set('page', String(n));
    const s = p.toString();
    return s ? `/programs?${s}` : '/programs';
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const crumbs = [{ label: 'All Centers', href: '/' }, { label: 'Browse programs' }];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <ProgramDirectoryAnalytics
        total={total}
        page={page}
        hasQuery={false}
        hasLocation={Boolean(validRegion)}
        hasInsuranceFilter={Boolean(validPay)}
        hasLevelOfCareFilter={Boolean(validLevel)}
        hasSpecialtyFilter={Boolean(validSpec)}
        hasPopulationFilter={Boolean(validPop)}
        hasOpenFilter={openFilter}
        region={validRegion || undefined}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs)) }}
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
          Directory results are ordered neutrally by name; payment is not required for inclusion and cannot purchase
          a higher position. We never take per-admission or per-call fees.{' '}
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
                    <span className="font-medium text-slate-600">Listed payment options:</span> {paymentSummary(r)}
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
