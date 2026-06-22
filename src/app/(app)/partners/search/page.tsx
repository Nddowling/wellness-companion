import Link from 'next/link';

import { requirePartner } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPartnerLists, getSavedFacilityIds, type FacilitySummary } from '@/lib/partner/data';
import { FacilityRow } from '@/components/partner/FacilityRow';
import {
  LEVELS_OF_CARE,
  LEVEL_LABELS,
  PAYER_LABELS,
  PAYER_TYPES,
  isBedBased,
  type LevelOfCare,
} from '@/lib/constants';

const SUMMARY_SELECT =
  'id, name, city, state, main_phone, intake_line, levels_of_care, carriers_named, facility_payers(payer_type), facility_capacity(level_of_care, beds_available, last_updated)';

const RESULT_CAP = 120;

export default async function PartnerSearch({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; q?: string; region?: string; pay?: string; open?: string }>;
}) {
  await requirePartner();
  const { level, q, region, pay, open } = await searchParams;

  const admin = createAdminClient();

  // Region list for the dropdown (distinct published states).
  const { data: stateRows } = await admin
    .from('facilities')
    .select('state')
    .eq('is_published', true)
    .not('state', 'is', null);
  const states = [...new Set((stateRows ?? []).map((r) => r.state).filter((s): s is string => !!s))].sort();

  // The big reducers (state, level, name/city) run server-side so we never hit the
  // PostgREST 1k cap; payer + availability refine within the returned set.
  let query = admin.from('facilities').select(SUMMARY_SELECT).eq('is_published', true);
  if (region) query = query.eq('state', region);
  if (level && LEVELS_OF_CARE.includes(level as LevelOfCare)) query = query.contains('levels_of_care', [level]);
  if (q) {
    const needle = q.replace(/[,()%]/g, ' ').trim();
    if (needle) query = query.or(`name.ilike.%${needle}%,city.ilike.%${needle}%`);
  }
  const { data } = await query.order('name').limit(RESULT_CAP);
  let rows = (data ?? []) as FacilitySummary[];

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

  const [savedIds, lists] = await Promise.all([getSavedFacilityIds(), getPartnerLists()]);
  const savedSet = new Set(savedIds);
  const listOpts = lists.map((l) => ({ id: l.id, title: l.title }));

  const hrefFor = (l?: string) => {
    const p = new URLSearchParams();
    if (l) p.set('level', l);
    if (region) p.set('region', region);
    if (q) p.set('q', q);
    if (pay) p.set('pay', pay);
    if (open) p.set('open', open);
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
          Every published program, neutral order. Filter, then save or shortlist the right fit.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={hrefFor(undefined)} className={tabClass(!level)}>
          All levels
        </Link>
        {LEVELS_OF_CARE.map((l) => (
          <Link key={l} href={hrefFor(l)} className={tabClass(level === l)}>
            {LEVEL_LABELS[l]}
          </Link>
        ))}
      </div>

      <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" action="/partners/search">
        {level && <input type="hidden" name="level" value={level} />}
        <select name="region" defaultValue={region ?? ''} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
          <option value="">All regions</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="pay" defaultValue={pay ?? ''} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
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
          placeholder="Name or city…"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm sm:min-w-[10rem]"
        />
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
          <input type="checkbox" name="open" value="1" defaultChecked={!!open} className="h-4 w-4 rounded border-slate-300" />
          Available now
        </label>
        <button className="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white sm:w-auto">Search</button>
      </form>
      {(level || region || q || pay || open) && (
        <Link href="/partners/search" className="inline-block text-xs text-slate-500 underline hover:text-teal-700">
          Clear filters
        </Link>
      )}

      <p className="text-xs text-slate-400">
        {rows.length}
        {rows.length === RESULT_CAP ? '+ ' : ' '}
        programs{rows.length === RESULT_CAP ? ' — narrow with filters to see more' : ''}
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
    </div>
  );
}
