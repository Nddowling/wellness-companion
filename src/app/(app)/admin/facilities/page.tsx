import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { freshnessTone, isBedBased, LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';
import { normalizePlan, PLAN_LABEL, type Plan } from '@/lib/facility/plan';
import { togglePublish } from '../actions';

const TONE_STYLES = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
} as const;

const PLAN_BADGE: Record<Plan, string> = {
  free: 'bg-slate-100 text-slate-500',
  starter: 'bg-teal-100 text-teal-800',
  growth: 'bg-indigo-100 text-indigo-800',
  anchor: 'bg-amber-100 text-amber-800',
};

const PAGE_SIZE = 50;
const MAX_PAGE = 10_000;

type CapacityRow = { level_of_care: string; beds_available: number; last_updated: string };
type FacilityRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  operator_type: string | null;
  priority_tier: string | null;
  plan: string | null;
  is_published: boolean;
  verified_at: string | null;
  levels_of_care: string[];
  facility_capacity: CapacityRow[];
};

function oldestUpdate(caps: CapacityRow[]): string | null {
  if (!caps.length) return null;
  return caps.reduce((o, c) => (c.last_updated < o ? c.last_updated : o), caps[0].last_updated);
}

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();
  return search ? `/admin/facilities?${search}` : '/admin/facilities';
}

export default async function AdminFacilities({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const query = (q ?? '').trim();
  const page = pageParam && /^\d+$/.test(pageParam)
    ? Math.min(MAX_PAGE, Math.max(1, Number(pageParam)))
    : 1;
  const from = (page - 1) * PAGE_SIZE;
  const supabase = await createClient();

  // Search hits the WHOLE table (name / city / state), not just the loaded page —
  // so all facilities remain findable while each response renders a phone-friendly page.
  let req = supabase
    .from('facilities')
    .select(
      'id, name, city, state, operator_type, priority_tier, plan, is_published, verified_at, levels_of_care, facility_capacity(level_of_care, beds_available, last_updated)',
      { count: 'exact' },
    )
    .order('is_published', { ascending: false })
    .order('name');

  if (query) {
    const safe = query.replace(/[%,()]/g, ' ').trim();
    req = req.or(`name.ilike.%${safe}%,city.ilike.%${safe}%,state.ilike.%${safe}%`);
  }

  const { data, error, count: totalCount } = await req.range(from, from + PAGE_SIZE - 1);
  const facilities = (data ?? []) as FacilityRow[];
  const total = totalCount ?? facilities.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (!error && total > 0 && page > totalPages) redirect(pageHref(totalPages, query));

  // Admin-member counts are loaded only for the current page.
  const admin = createAdminClient();
  const { data: memberRows } = facilities.length
    ? await admin.from('facility_members').select('facility_id').in('facility_id', facilities.map((f) => f.id))
    : { data: [] as { facility_id: string }[] };
  const adminCount = new Map<string, number>();
  for (const m of memberRows ?? []) adminCount.set(m.facility_id, (adminCount.get(m.facility_id) ?? 0) + 1);

  const activeCount = facilities.filter((f) => f.is_published).length;
  const firstResult = total === 0 ? 0 : from + 1;
  const lastResult = Math.min(from + facilities.length, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Facilities</h1>
          <p className="text-sm text-slate-500">
            {query ? (
              <>
                <strong>{facilities.length}</strong> result{facilities.length === 1 ? '' : 's'} for &ldquo;{query}
                &rdquo; on this page. {total.toLocaleString()} total match{total === 1 ? '' : 'es'}.
              </>
            ) : (
              <>
                {activeCount} active on this page · showing {firstResult.toLocaleString()}–{lastResult.toLocaleString()} of{' '}
                {total.toLocaleString()} total.
              </>
            )}
          </p>
        </div>
        <Link
          href="/admin/facilities/new"
          className="shrink-0 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white"
        >
          + Onboard facility
        </Link>
      </div>

      {/* Full-table search */}
      <form action="/admin/facilities" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search all facilities by name, city, or state…"
          className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm sm:flex-1"
        />
        <button className="flex-1 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white sm:flex-none">Search</button>
        {query && (
          <Link
            href="/admin/facilities"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-center text-sm text-slate-600 hover:border-teal-400 sm:flex-none"
          >
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">Could not load facilities: {error.message}.</p>
      )}

      <div className="space-y-2">
        {facilities.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            {query ? `No facilities match “${query}”.` : 'No facilities yet.'}
          </p>
        )}
        {facilities.map((f) => {
          const listsResidential = f.levels_of_care.some(isBedBased);
          const residentialCaps = listsResidential
            ? f.facility_capacity.filter((capacity) => isBedBased(capacity.level_of_care))
            : [];
          const capacityUpdatedAt = oldestUpdate(residentialCaps);
          const tone = freshnessTone(capacityUpdatedAt);
          const totalBeds = residentialCaps.reduce((sum, capacity) => sum + capacity.beds_available, 0);
          const admins = adminCount.get(f.id) ?? 0;
          return (
            <div
              key={f.id}
              className={
                'flex flex-col items-stretch gap-3 rounded-md border bg-white p-4 sm:flex-row sm:items-center sm:justify-between ' +
                (f.is_published ? 'border-slate-200' : 'border-slate-200 opacity-60')
              }
            >
              <Link href={`/admin/facilities/${f.id}`} className="min-w-0 w-full sm:flex-1 sm:pr-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{f.name}</span>
                  <span className={'rounded px-1.5 py-0.5 text-xs font-medium ' + PLAN_BADGE[normalizePlan(f.plan)]}>
                    {PLAN_LABEL[normalizePlan(f.plan)]}
                  </span>
                  {f.verified_at && (
                    <span className="rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-700">admin-reviewed</span>
                  )}
                  {admins > 0 && (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                      {admins} admin{admins === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {[f.city, f.state].filter(Boolean).join(', ') || 'No location set'}
                  {f.operator_type ? ` · ${f.operator_type}` : ''} ·{' '}
                  {f.levels_of_care
                    .map((level) => LEVEL_LABELS[level as LevelOfCare] ?? level)
                    .join(', ') || 'no levels'}
                </div>
              </Link>

              <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:justify-start sm:gap-3">
                <span className="min-w-0 flex-1 text-xs text-slate-600 sm:flex-none sm:text-sm">
                  {listsResidential
                    ? residentialCaps.length
                      ? `${totalBeds} residential ${totalBeds === 1 ? 'bed' : 'beds'}`
                      : 'No residential-bed report'
                    : 'No residential care'}
                </span>
                <span className={`rounded px-2 py-1 text-xs font-medium ${TONE_STYLES[tone]}`}>
                  {capacityUpdatedAt
                    ? tone === 'green'
                      ? 'fresh'
                      : tone === 'amber'
                        ? 'aging'
                        : 'stale'
                    : 'no report'}
                </span>
                <form action={togglePublish}>
                  <input type="hidden" name="facility_id" value={f.id} />
                  <input type="hidden" name="publish" value={String(!f.is_published)} />
                  <button
                    type="submit"
                    title={f.is_published ? 'Deactivate (hide from directory)' : 'Activate (show in directory)'}
                    className={
                      'w-24 rounded-md px-3 py-1.5 text-xs font-medium ' +
                      (f.is_published
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'border border-slate-300 text-slate-500 hover:border-teal-400')
                    }
                  >
                    {f.is_published ? '● Active' : '○ Inactive'}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Facility pages" className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1, query)}
              className="flex min-h-11 items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-400"
            >
              ← Previous
            </Link>
          ) : <span />}
          <span className="text-center text-xs text-slate-500">
            Page {page.toLocaleString()} of {totalPages.toLocaleString()}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1, query)}
              className="flex min-h-11 items-center rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Next →
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
