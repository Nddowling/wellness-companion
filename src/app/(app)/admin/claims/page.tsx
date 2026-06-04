import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { approveClaim, rejectClaim } from '../actions';

type Claim = {
  id: string;
  user_id: string;
  note: string | null;
  status: string;
  created_at: string;
  facilities: { name: string } | null;
};

export default async function AdminClaims() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facility_claims')
    .select('id, user_id, note, status, created_at, facilities(name)')
    .order('created_at', { ascending: false });
  const claims = (data ?? []) as unknown as Claim[];
  const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? u.id]));

  const pending = claims.filter((c) => c.status === 'pending');
  const resolved = claims.filter((c) => c.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Facility claims</h1>
        <p className="text-sm text-slate-500">People requesting to manage a facility. Approving creates their membership.</p>
      </div>

      <div className="space-y-2">
        {pending.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No pending claims.
          </p>
        )}
        {pending.map((c) => (
          <div key={c.id} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-800">
              <strong>{emailById.get(c.user_id) ?? c.user_id}</strong> → {c.facilities?.name ?? 'facility'}
            </div>
            {c.note && <div className="mt-1 text-xs text-slate-500">“{c.note}”</div>}
            <div className="mt-2 flex gap-2">
              <form action={approveClaim}>
                <input type="hidden" name="claim_id" value={c.id} />
                <button className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white">Approve</button>
              </form>
              <form action={rejectClaim}>
                <input type="hidden" name="claim_id" value={c.id} />
                <button className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600">Reject</button>
              </form>
            </div>
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-700">Resolved</h2>
          {resolved.map((c) => (
            <div key={c.id} className="flex justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-xs text-slate-500">
              <span>{emailById.get(c.user_id) ?? c.user_id} → {c.facilities?.name}</span>
              <span>{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
