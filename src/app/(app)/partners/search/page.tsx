import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requirePartner } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPartnerLists, getSavedFacilityIds, type FacilitySummary } from '@/lib/partner/data';
import { FacilityRow } from '@/components/partner/FacilityRow';
import { ProgramLookup } from '@/components/partner/ProgramLookup';
import {
  LEVELS_OF_CARE,
  LEVEL_LABELS,
  PAYER_LABELS,
  PAYER_TYPES,
  isBedBased,
  isoDaysAgo,
  type LevelOfCare,
} from '@/lib/constants';

const PAGE_SIZE = 40;

export default async function PartnerSearch({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; q?: string; region?: string; pay?: string; open?: string; page?: string }>;
}) {
  await requirePartner();
  const { level, q, region, pay, open, page } = await searchParams;
  const pageNumber = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const selectedLevel = level && LEVELS_OF_CARE.includes(level as LevelOfCare) ? (level as LevelOfCare) : null;
  const selectedRegion = region && /^[A-Z]{2}$/.test(region) ? region : null;
  const selectedPay = pay && (PAYER_TYPES as readonly string[]).includes(pay) ? pay : null;
  const bedReportEligible = selectedLevel === null || isBedBased(selectedLevel);
  const freshBedFilter = open === '1' && bedReportEligible;

  // Retire legacy free-text URLs without ever using their value. New program-name
  // lookup is POST-only and navigates directly to a selected directory record.
  const hasNonCanonicalFacet =
    (level !== undefined && !selectedLevel) ||
    (region !== undefined && !selectedRegion) ||
    (pay !== undefined && !selectedPay) ||
    (open !== undefined && open !== '1') ||
    (page !== undefined && (pageNumber <= 1 || page !== String(pageNumber)));
  if (q !== undefined || hasNonCanonicalFacet) {
    const clean = new URLSearchParams();
    if (selectedLevel) clean.set('level', selectedLevel);
    if (selectedRegion) clean.set('region', selectedRegion);
    if (selectedPay) clean.set('pay', selectedPay);
    if (freshBedFilter) clean.set('open', '1');
    if (pageNumber > 1) clean.set('page', String(pageNumber));
    redirect(clean.size ? `/partners/search?${clean}` : '/partners/search');
  }

  const admin = createAdminClient();

  // Region list for the dropdown (distinct published states).
  const { data: stateRows } = await admin
    .from('facilities')
    .select('state')
    .eq('is_published', true)
    .not('state', 'is', null);
  const states = [...new Set((stateRows ?? []).map((r) => r.state).filter((s): s is string => !!s))].sort();

  const payerFilter = selectedPay !== null;
  const capacityJoin = freshBedFilter ? '!inner' : '';
  const payerJoin = payerFilter ? '!inner' : '';
  const summarySelect =
    `id, name, city, state, main_phone, intake_line, levels_of_care, carriers_named, ` +
    `facility_payers${payerJoin}(payer_type), ` +
    `facility_capacity${capacityJoin}(level_of_care, beds_available, last_updated)`;

  // Every reducer runs in Postgres before pagination. This avoids silently applying
  // payer/availability filters to only the first alphabetic slice of the directory.
  let query = admin
    .from('facilities')
    .select(summarySelect, { count: 'exact' })
    .eq('is_published', true);
  if (selectedRegion) query = query.eq('state', selectedRegion);
  if (selectedLevel) query = query.contains('levels_of_care', [selectedLevel]);
  if (payerFilter) {
    query = query.eq('facility_payers.payer_type', selectedPay!);
  }
  if (freshBedFilter) {
    const cutoff = isoDaysAgo(7);
    const futureSkewCutoff = isoDaysAgo(-5 / (24 * 60));
    query = query
      .gt('facility_capacity.beds_available', 0)
      .gte('facility_capacity.last_updated', cutoff)
      .lte('facility_capacity.last_updated', futureSkewCutoff)
      .eq('facility_capacity.level_of_care', 'residential');
    query = selectedLevel
      ? query
      : query.contains('levels_of_care', ['residential']);
  }
  const from = (pageNumber - 1) * PAGE_SIZE;
  const { data, count } = await query.order('name').range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as FacilitySummary[];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [savedIds, lists] = await Promise.all([getSavedFacilityIds(), getPartnerLists()]);
  const savedSet = new Set(savedIds);
  const listOpts = lists.map((l) => ({ id: l.id, title: l.title }));

  const hrefFor = (l?: string, targetPage?: number) => {
    const p = new URLSearchParams();
    if (l) p.set('level', l);
    if (selectedRegion) p.set('region', selectedRegion);
    if (selectedPay) p.set('pay', selectedPay);
    const targetLevel = l && LEVELS_OF_CARE.includes(l as LevelOfCare) ? (l as LevelOfCare) : null;
    if (freshBedFilter && (targetLevel === null || isBedBased(targetLevel))) p.set('open', '1');
    if (targetPage && targetPage > 1) p.set('page', String(targetPage));
    const s = p.toString();
    return s ? `/partners/search?${s}` : '/partners/search';
  };
  const tabClass = (active: boolean) =>
    'rounded-full px-3 py-1 text-xs font-medium ' +
    (active ? 'bg-teal-700 text-white' : 'border border-slate-300 text-slate-600 hover:border-teal-400');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Search the directory</h1>
        <p className="text-sm text-slate-500">
          Published directory records in neutral alphabetical order. Filter, then save or shortlist options to verify.
        </p>
      </div>

      <ProgramLookup />

      <div className="flex flex-wrap gap-2">
        <Link href={hrefFor(undefined)} className={tabClass(!selectedLevel)}>
          All levels
        </Link>
        {LEVELS_OF_CARE.map((l) => (
          <Link key={l} href={hrefFor(l)} className={tabClass(selectedLevel === l)}>
            {LEVEL_LABELS[l]}
          </Link>
        ))}
      </div>

      <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" action="/partners/search">
        {selectedLevel && <input type="hidden" name="level" value={selectedLevel} />}
        <select name="region" defaultValue={selectedRegion ?? ''} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
          <option value="">All regions</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="pay" defaultValue={selectedPay ?? ''} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
          <option value="">Any payment category</option>
          {PAYER_TYPES.map((pt) => (
            <option key={pt} value={pt}>
              {PAYER_LABELS[pt]}
            </option>
          ))}
        </select>
        {bedReportEligible && (
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
            <input type="checkbox" name="open" value="1" defaultChecked={freshBedFilter} className="h-4 w-4 rounded border-slate-300" />
            Fresh bed report (7 days)
          </label>
        )}
        <button className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white sm:w-auto">Search</button>
      </form>
      {(selectedLevel || selectedRegion || selectedPay || freshBedFilter) && (
        <Link href="/partners/search" className="inline-block text-xs text-slate-500 underline hover:text-teal-700">
          Clear filters
        </Link>
      )}

      <p className="text-xs text-slate-400">
        {total} matching program{total === 1 ? '' : 's'} · page {Math.min(pageNumber, pageCount)} of {pageCount}
      </p>

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No programs match that filter. Try a different level or clear the search.
          </p>
        )}
        {rows.map((f) => (
          <FacilityRow key={f.id} f={f} saved={savedSet.has(f.id)} lists={listOpts} />
        ))}
      </div>

      {pageCount > 1 && (
        <nav aria-label="Search result pages" className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm">
          {pageNumber > 1 ? (
            <Link href={hrefFor(selectedLevel ?? undefined, pageNumber - 1)} className="font-medium text-teal-700 hover:underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {pageNumber < pageCount && (
            <Link href={hrefFor(selectedLevel ?? undefined, pageNumber + 1)} className="font-medium text-teal-700 hover:underline">
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
