import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import {
  freshnessTone,
  LEVEL_LABELS,
  PAYER_LABELS,
  type LevelOfCare,
  type PayerType,
} from '@/lib/constants';
import { togglePublish, updateCapacity, verifyFacility } from '../../actions';

const TONE_STYLES = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
} as const;

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: facility } = await supabase
    .from('facilities')
    .select(
      'id, name, city, state, is_published, verified_at, facility_capacity(level_of_care, beds_available, last_updated), facility_payers(payer_type, in_network)'
    )
    .eq('id', id)
    .maybeSingle();

  if (!facility) notFound();

  const caps = (facility.facility_capacity ?? []) as {
    level_of_care: string;
    beds_available: number;
    last_updated: string;
  }[];
  const payers = (facility.facility_payers ?? []) as { payer_type: string; in_network: boolean }[];

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-teal-700">
        ← Back
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{facility.name}</h1>
          <p className="text-sm text-slate-500">
            {[facility.city, facility.state].filter(Boolean).join(', ') || 'No location set'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={verifyFacility}>
            <input type="hidden" name="facility_id" value={facility.id} />
            <button className="rounded-md border border-teal-300 px-3 py-1.5 text-sm text-teal-700">
              {facility.verified_at ? 'Re-verify' : 'Verify'}
            </button>
          </form>
          <form action={togglePublish}>
            <input type="hidden" name="facility_id" value={facility.id} />
            <input type="hidden" name="publish" value={(!facility.is_published).toString()} />
            <button className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white">
              {facility.is_published ? 'Unpublish' : 'Publish'}
            </button>
          </form>
        </div>
      </div>

      {/* Bed availability — the freshness moat */}
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Bed availability</h2>
        <p className="mb-3 text-xs text-slate-400">
          Saving any row stamps <code>last_updated</code> to now.
        </p>
        <div className="space-y-2">
          {caps.length === 0 && (
            <p className="text-sm text-slate-500">No levels of care configured.</p>
          )}
          {caps.map((c) => {
            const tone = freshnessTone(c.last_updated);
            return (
              <form
                key={c.level_of_care}
                action={updateCapacity}
                className="flex items-center gap-3"
              >
                <input type="hidden" name="facility_id" value={facility.id} />
                <input type="hidden" name="level_of_care" value={c.level_of_care} />
                <span className="w-56 text-sm text-slate-700">
                  {LEVEL_LABELS[c.level_of_care as LevelOfCare] ?? c.level_of_care}
                </span>
                <input
                  name="beds_available"
                  type="number"
                  min={0}
                  defaultValue={c.beds_available}
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <button className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700">
                  Save
                </button>
                <span className={`rounded px-2 py-0.5 text-xs ${TONE_STYLES[tone]}`}>
                  updated {new Date(c.last_updated).toLocaleDateString()}
                </span>
              </form>
            );
          })}
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Payers accepted</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {payers.length === 0 && <span className="text-sm text-slate-500">None set.</span>}
          {payers.map((p) => (
            <span
              key={p.payer_type}
              className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700"
            >
              {PAYER_LABELS[p.payer_type as PayerType] ?? p.payer_type}
              {p.in_network ? ' · in-network' : ''}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
