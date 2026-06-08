import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { FacilityPicker } from '@/components/FacilityPicker';

export default async function GetStarted({ searchParams }: { searchParams: Promise<{ claimed?: string }> }) {
  const user = await requireUser();
  const { claimed } = await searchParams;

  const supabase = await createClient();
  const { data: myClaims } = await supabase
    .from('facility_claims')
    .select('facility_id, status, facilities(name)')
    .eq('user_id', user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Welcome — let&apos;s get you set up</h1>
        <p className="text-sm text-slate-500">Tell us how you&apos;ll be using Clear Bed Recovery.</p>
      </div>

      {claimed && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ Request sent. An admin will review and approve your facility access.
        </div>
      )}

      {myClaims && myClaims.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
          <div className="font-medium text-slate-700">Your facility requests</div>
          {myClaims.map((c) => (
            <div key={c.facility_id} className="flex justify-between text-slate-600">
              <span>{(c.facilities as { name?: string } | null)?.name ?? 'facility'}</span>
              <span className="text-xs text-slate-400">{c.status}</span>
            </div>
          ))}
        </div>
      )}

      <FacilityPicker />
    </div>
  );
}
