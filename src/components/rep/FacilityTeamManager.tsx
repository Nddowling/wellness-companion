import Link from 'next/link';

import { getFacilityTeamManage } from '@/lib/rep/data';
import { setAffiliationStatusAction } from '@/app/(app)/rep/actions';

function StatusButton({
  affiliationId,
  facilityId,
  status,
  children,
  className,
}: {
  affiliationId: string;
  facilityId: string;
  status: 'verified' | 'rejected';
  children: React.ReactNode;
  className: string;
}) {
  return (
    <form action={setAffiliationStatusAction}>
      <input type="hidden" name="affiliation_id" value={affiliationId} />
      <input type="hidden" name="facility_id" value={facilityId} />
      <input type="hidden" name="status" value={status} />
      <button className={className}>{children}</button>
    </form>
  );
}

/**
 * Director-side team management: verify/reject reps who self-attached to this
 * facility. Verifying makes them public on the listing. Access is already gated by
 * the page (requireFacilityMember) and by RLS.
 */
export async function FacilityTeamManager({ facilityId }: { facilityId: string }) {
  const team = await getFacilityTeamManage(facilityId);
  const pending = team.filter((m) => m.status === 'pending');
  const verified = team.filter((m) => m.status === 'verified');

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Your team</h2>
      <p className="mb-3 mt-0.5 text-xs text-slate-500">
        People who added themselves to your listing. Verified members appear publicly on your profile.
      </p>

      {pending.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">Pending ({pending.length})</div>
          {pending.map((m) => (
            <div
              key={m.affiliation_id}
              className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2"
            >
              <div className="min-w-0">
                <Link href={`/p/${m.slug}`} className="block truncate text-sm font-medium text-slate-800 hover:text-teal-700">
                  {m.display_name}
                </Link>
                <div className="truncate text-xs text-slate-500">{m.title || m.headline || 'Team member'}</div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <StatusButton
                  affiliationId={m.affiliation_id}
                  facilityId={facilityId}
                  status="verified"
                  className="rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  Verify
                </StatusButton>
                <StatusButton
                  affiliationId={m.affiliation_id}
                  facilityId={facilityId}
                  status="rejected"
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-red-300 hover:text-red-600"
                >
                  Reject
                </StatusButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {verified.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            On your listing ({verified.length})
          </div>
          {verified.map((m) => (
            <div key={m.affiliation_id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
              <div className="min-w-0">
                <Link href={`/p/${m.slug}`} className="block truncate text-sm font-medium text-slate-800 hover:text-teal-700">
                  {m.display_name}
                </Link>
                <div className="truncate text-xs text-slate-500">{m.title || m.headline || 'Team member'}</div>
              </div>
              <StatusButton
                affiliationId={m.affiliation_id}
                facilityId={facilityId}
                status="rejected"
                className="shrink-0 text-xs text-slate-400 hover:text-red-600"
              >
                Remove
              </StatusButton>
            </div>
          ))}
        </div>
      ) : (
        pending.length === 0 && (
          <p className="text-xs text-slate-400">
            No team members yet. Share{' '}
            <Link href="/for-reps" className="text-teal-700 underline">
              clearbedrecovery.com/for-reps
            </Link>{' '}
            with your admissions &amp; business-development staff.
          </p>
        )
      )}
    </section>
  );
}
