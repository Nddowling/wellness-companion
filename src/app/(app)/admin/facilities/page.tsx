import Link from 'next/link';

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

const BROWSE_LIMIT = 1000;
const SEARCH_LIMIT = 200;

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

export default async function AdminFacilities({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const supabase = await createClient();

  // Search hits the WHOLE table (name / city / state), not just the loaded page —
  // so all ~13k facilities are findable even though we only render up to 1,000.
  let req = supabase
    .from('facilities')
    .select(
      'id, name, city, state, operator_type, priority_tier, plan, is_published, verified_at, levels_of_care, facility_capacity(level_of_care, beds_available, last_updated)'
    )
    .order('is_published', { ascending: false })
    .order('name');

  if (query) {
    const safe = query.replace(/[%,()]/g, ' ').trim();
    req = req.or(`name.ilike.%${safe}%,city.ilike.%${safe}%,state.ilike.%${safe}%`).limit(SEARCH_LIMIT);
  } else {
    req = req.limit(BROWSE_LIMIT);
  }

  const { data, error } = await req;
  const facilities = (data ?? []) as FacilityRow[];

  // True total (for the browse-cap note) + admin-member counts for the rows shown.
  const admin = createAdminClient();
  const [{ count: totalCount }, { data: memberRows }] = await Promise.all([
    supabase.from('facilities').select('id', { count: 'exact', head: true }),
    facilities.length
      ? admin.from('facility_members').select('facility_id').in('facility_id', facilities.map((f) => f.id))
      : Promise.resolve({ data: [] as { facility_id: string }[] }),
  ]);
  const adminCount = new Map<string, number>();
  for (const m of memberRows ?? []) adminCount.set(m.facility_id, (adminCount.get(m.facility_id) ?? 0) + 1);

  const activeCount = facilities.filter((f) => f.is_published).length;
  const capped = !query && (totalCount ?? 0) > facilities.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Facilities</h1>
          <p className="text-sm text-slate-500">
            {query ? (
              <>
                <strong>{facilities.length}</strong> result{facilities.length === 1 ? '' : 's'} for &ldquo;{query}
                &rdquo;
                {facilities.length === SEARCH_LIMIT ? ' (showing first 200 — narrow your search)' : ''}.
              </>
            ) : (
              <>
                {activeCount} active in this view of {(totalCount ?? facilities.length).toLocaleString()} total.
                {capped ? ' Showing the first 1,000 — search to reach any of them.' : ''}
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
      <form action="/admin/facilities" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search all facilities by name, city, or state…"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Search</button>
        {query && (
          <Link
            href="/admin/facilities"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-teal-400"
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
                'flex items-center justify-between rounded-md border bg-white p-4 ' +
                (f.is_published ? 'border-slate-200' : 'border-slate-200 opacity-60')
              }
            >
              <Link href={`/admin/facilities/${f.id}`} className="min-w-0 flex-1 pr-3">
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

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm text-slate-600">
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
    </div>
  );
}
