import Link from 'next/link';

import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requestClaim } from '../facility/actions';

export default async function GetStarted({ searchParams }: { searchParams: Promise<{ claimed?: string }> }) {
  const user = await requireUser();
  const { claimed } = await searchParams;

  const admin = createAdminClient();
  const { data: facilities } = await admin
    .from('facilities')
    .select('id, name, city, state')
    .order('name');

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/bd" className="rounded-lg border border-slate-200 bg-white p-5 hover:border-teal-300">
          <div className="text-lg font-semibold text-slate-800">I&apos;m a referrer</div>
          <p className="mt-1 text-sm text-slate-500">
            Browse the live directory, save shortlists, and keep notes — about places, never patients.
          </p>
          <span className="mt-3 inline-block text-sm font-medium text-teal-700">Continue →</span>
        </Link>

        <form action={requestClaim} className="space-y-2 rounded-lg border border-slate-200 bg-white p-5">
          <div className="text-lg font-semibold text-slate-800">I represent a facility</div>
          <p className="text-sm text-slate-500">Request to manage your program&apos;s profile and beds.</p>
          <select name="facility_id" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
            <option value="">Choose your facility…</option>
            {(facilities ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} {[f.city, f.state].filter(Boolean).length ? `— ${[f.city, f.state].filter(Boolean).join(', ')}` : ''}
              </option>
            ))}
          </select>
          <input name="note" placeholder="Your role (optional)" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Request access</button>
        </form>
      </div>
    </div>
  );
}
