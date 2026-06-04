import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { freshnessTone, LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';
import { togglePublish } from '../actions';

const TONE_STYLES = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
} as const;

type CapacityRow = { level_of_care: string; beds_available: number; last_updated: string };
type FacilityRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  operator_type: string | null;
  priority_tier: string | null;
  is_published: boolean;
  verified_at: string | null;
  facility_capacity: CapacityRow[];
};

function oldestUpdate(caps: CapacityRow[]): string | null {
  if (!caps.length) return null;
  return caps.reduce((o, c) => (c.last_updated < o ? c.last_updated : o), caps[0].last_updated);
}

export default async function AdminFacilities() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('facilities')
    .select(
      'id, name, city, state, operator_type, priority_tier, is_published, verified_at, facility_capacity(level_of_care, beds_available, last_updated)'
    )
    .order('is_published', { ascending: false })
    .order('name');

  const facilities = (data ?? []) as FacilityRow[];
  const activeCount = facilities.filter((f) => f.is_published).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Facilities</h1>
          <p className="text-sm text-slate-500">
            {activeCount} active of {facilities.length}. Only <strong>Active</strong> facilities are recommended
            to seekers.
          </p>
        </div>
        <Link
          href="/admin/facilities/new"
          className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white"
        >
          + Onboard facility
        </Link>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">Could not load facilities: {error.message}.</p>
      )}

      <div className="space-y-2">
        {facilities.map((f) => {
          const tone = freshnessTone(oldestUpdate(f.facility_capacity));
          const totalBeds = f.facility_capacity.reduce((s, c) => s + c.beds_available, 0);
          return (
            <div
              key={f.id}
              className={
                'flex items-center justify-between rounded-md border bg-white p-4 ' +
                (f.is_published ? 'border-slate-200' : 'border-slate-200 opacity-60')
              }
            >
              <Link href={`/admin/facilities/${f.id}`} className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{f.name}</span>
                  {f.priority_tier && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      {f.priority_tier}
                    </span>
                  )}
                  {f.verified_at && (
                    <span className="rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-700">verified</span>
                  )}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {[f.city, f.state].filter(Boolean).join(', ') || 'No location set'}
                  {f.operator_type ? ` · ${f.operator_type}` : ''} ·{' '}
                  {f.facility_capacity
                    .map((c) => LEVEL_LABELS[c.level_of_care as LevelOfCare] ?? c.level_of_care)
                    .join(', ') || 'no levels'}
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm text-slate-600">{totalBeds} beds</span>
                <span className={`rounded px-2 py-1 text-xs font-medium ${TONE_STYLES[tone]}`}>
                  {tone === 'green' ? 'fresh' : tone === 'amber' ? 'aging' : 'stale'}
                </span>
                <form action={togglePublish}>
                  <input type="hidden" name="facility_id" value={f.id} />
                  <input type="hidden" name="publish" value={String(!f.is_published)} />
                  <button
                    type="submit"
                    title={f.is_published ? 'Deactivate (hide from seekers)' : 'Activate (recommend to seekers)'}
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
