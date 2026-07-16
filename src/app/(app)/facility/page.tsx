import Link from 'next/link';

import { requireFacilityMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { freshnessTone, isBedBased } from '@/lib/constants';

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
  is_published: boolean;
  facility_capacity: Cap[];
};

function oldest(caps: Cap[]): string | null {
  if (!caps.length) return null;
  return caps.reduce((o, c) => (c.last_updated < o ? c.last_updated : o), caps[0].last_updated);
}

export default async function FacilityHome() {
  const { facilityIds } = await requireFacilityMember();
  const supabase = await createClient();

  const { data: facData } = await supabase
    .from('facilities')
    .select('id, name, city, state, is_published, facility_capacity(level_of_care, beds_available, last_updated)')
    .in('id', facilityIds)
    .order('name');
  const facilities = (facData ?? []) as FacilityRow[];

  // Open inbound leads per facility (routes not yet accepted/declined).
  const { data: routes } = await supabase
    .from('match_routes')
    .select('facility_id, status');
  const openLeads = new Map<string, number>();
  for (const r of routes ?? []) {
    if (r.status === 'sent' || r.status === 'viewed') {
      openLeads.set(r.facility_id, (openLeads.get(r.facility_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">My facility</h1>
        <p className="text-sm text-slate-500">
          Keep residential-bed reports current. Freshness may improve ordering within the same region, but every
          match still depends on the listed directory filters.
        </p>
      </div>

      <div className="space-y-2">
        {facilities.map((f) => {
          const residentialCaps = f.facility_capacity.filter((cap) => isBedBased(cap.level_of_care));
          const tone = freshnessTone(oldest(residentialCaps));
          const beds = residentialCaps.reduce((s, c) => s + c.beds_available, 0);
          const leads = openLeads.get(f.id) ?? 0;
          return (
            <Link
              key={f.id}
              href={`/facility/${f.id}`}
              className="flex flex-col items-start gap-3 rounded-md border border-slate-200 bg-white p-4 hover:border-teal-300 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 w-full sm:w-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{f.name}</span>
                  {!f.is_published && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">draft</span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {[f.city, f.state].filter(Boolean).join(', ') || 'No location set'} ·{' '}
                  {residentialCaps.length ? `${beds} residential ${beds === 1 ? 'bed' : 'beds'} reported` : 'no residential-bed report'}
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end sm:gap-3">
                {leads > 0 && (
                  <span className="rounded-full bg-teal-700 px-2 py-1 text-xs font-medium text-white">
                    {leads} new lead{leads === 1 ? '' : 's'}
                  </span>
                )}
                {residentialCaps.length > 0 && (
                  <span className={`rounded px-2 py-1 text-xs font-medium ${TONE_STYLES[tone]}`}>
                    {tone === 'green' ? 'fresh' : tone === 'amber' ? 'aging' : 'stale'}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
