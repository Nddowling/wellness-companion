import Link from 'next/link';

import { getRoles } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { freshnessTone, LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';
import { registerBd, toggleSaved } from './actions';

const TONE_STYLES = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
} as const;

type Cap = { level_of_care: string; beds_available: number; last_updated: string };
type FacilityRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  levels_of_care: string[];
  facility_capacity: Cap[];
};

function oldest(caps: Cap[]): string | null {
  if (!caps.length) return null;
  return caps.reduce((o, c) => (c.last_updated < o ? c.last_updated : o), caps[0].last_updated);
}

export default async function BdHome() {
  const { user, isBd } = await getRoles();
  const supabase = await createClient();

  // Not a referrer yet — show the self-registration form.
  if (!isBd) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Join as a referrer</h1>
          <p className="text-sm text-slate-500">
            Referrers browse the live facility directory, save shortlists, and keep private notes —
            about places, never about patients.
          </p>
        </div>
        <form action={registerBd} className="grid gap-2 rounded-md border border-slate-200 bg-white p-4">
          <input name="employer" placeholder="Employer / organization" className="rounded border border-slate-300 px-2 py-1 text-sm" />
          <input name="territory" placeholder="Territory (e.g. Southern California)" className="rounded border border-slate-300 px-2 py-1 text-sm" />
          <input name="phone" placeholder="Phone" className="rounded border border-slate-300 px-2 py-1 text-sm" />
          <button type="submit" className="justify-self-start rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white">
            Join
          </button>
        </form>
      </div>
    );
  }

  const [{ data: facData }, { data: savedData }] = await Promise.all([
    supabase
      .from('facilities')
      .select('id, name, city, state, levels_of_care, facility_capacity(level_of_care, beds_available, last_updated)')
      .eq('is_published', true)
      .order('name'),
    supabase.from('bd_saved_facilities').select('facility_id').eq('bd_user_id', user!.id),
  ]);
  const facilities = (facData ?? []) as FacilityRow[];
  const saved = new Set((savedData ?? []).map((s) => s.facility_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Facility directory</h1>
        <p className="text-sm text-slate-500">Live bed availability across published facilities.</p>
      </div>

      {facilities.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No published facilities yet.
        </p>
      )}

      <div className="space-y-2">
        {facilities.map((f) => {
          const tone = freshnessTone(oldest(f.facility_capacity));
          const beds = f.facility_capacity.reduce((s, c) => s + c.beds_available, 0);
          const isSaved = saved.has(f.id);
          return (
            <div key={f.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-4">
              <Link href={`/bd/${f.id}`} className="min-w-0 flex-1">
                <div className="font-medium text-slate-800">{f.name}</div>
                <div className="text-xs text-slate-500">
                  {[f.city, f.state].filter(Boolean).join(', ') || 'No location'} ·{' '}
                  {(f.levels_of_care ?? [])
                    .map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l)
                    .join(', ') || 'no levels'}{' '}
                  · {beds} beds
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <span className={`rounded px-2 py-1 text-xs font-medium ${TONE_STYLES[tone]}`}>
                  {tone === 'green' ? 'fresh' : tone === 'amber' ? 'aging' : 'stale'}
                </span>
                <form action={toggleSaved}>
                  <input type="hidden" name="facility_id" value={f.id} />
                  <input type="hidden" name="currently_saved" value={String(isSaved)} />
                  <button
                    type="submit"
                    className={
                      'rounded-md px-3 py-1 text-xs font-medium ' +
                      (isSaved ? 'bg-teal-50 text-teal-700' : 'border border-slate-300 text-slate-600')
                    }
                  >
                    {isSaved ? '★ Saved' : '☆ Save'}
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
