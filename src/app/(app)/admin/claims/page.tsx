import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { approveClaim, rejectClaim } from '../actions';

type Claim = {
  id: string;
  user_id: string | null;
  note: string | null;
  status: string;
  created_at: string;
  claimant_name: string | null;
  claimant_email: string | null;
  claimant_phone: string | null;
  claimant_title: string | null;
  facility_name_freetext: string | null;
  facilities: { name: string } | null;
};

export default async function AdminClaims() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facility_claims')
    .select(
      'id, user_id, note, status, created_at, claimant_name, claimant_email, claimant_phone, claimant_title, facility_name_freetext, facilities(name)'
    )
    .order('created_at', { ascending: false });
  const claims = (data ?? []) as unknown as Claim[];
  const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? u.id]));

  // Who submitted: a public claim's claimant_email, else the logged-in user's email.
  const claimantOf = (c: Claim) =>
    c.claimant_email ?? (c.user_id ? emailById.get(c.user_id) ?? c.user_id : 'unknown');
  const facilityOf = (c: Claim) => c.facilities?.name ?? c.facility_name_freetext ?? 'facility (not listed)';

  const pending = claims.filter((c) => c.status === 'pending');
  const resolved = claims.filter((c) => c.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Facility claims</h1>
        <p className="text-sm text-slate-500">
          Providers requesting to manage a facility. Verify each one, then approve — approval creates their
          login and emails their credentials.
        </p>
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
              <strong>{claimantOf(c)}</strong> → {facilityOf(c)}
            </div>
            <div className="mt-1 space-y-0.5 text-xs text-slate-500">
              {(c.claimant_name || c.claimant_title) && (
                <div>{[c.claimant_name, c.claimant_title].filter(Boolean).join(' · ')}</div>
              )}
              {c.claimant_phone && <div>{c.claimant_phone}</div>}
              {!c.facilities && c.facility_name_freetext && (
                <div className="text-amber-700">
                  ⚠ Not in the directory yet — create/link the facility before approving to grant access.
                </div>
              )}
              {c.note && <div className="text-slate-600">“{c.note}”</div>}
            </div>
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
              <span>
                {claimantOf(c)} → {facilityOf(c)}
              </span>
              <span>{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
