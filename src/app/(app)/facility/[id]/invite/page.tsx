import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireFacilityOwner } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { inviteStaff } from '../../actions';
import { seatLimit, INCLUDED_SEATS } from '@/lib/facility/plan';

export default async function InviteStaff({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    invited?: string;
    emailed?: string;
    seatfull?: string;
    already?: string;
    new?: string;
  }>;
}) {
  const { id } = await params;
  const { invited, emailed, seatfull, already, new: newAccount } = await searchParams;
  await requireFacilityOwner(id);

  const admin = createAdminClient();
  const { data: facility } = await admin.from('facilities').select('name, extra_seats').eq('id', id).maybeSingle();
  if (!facility) notFound();

  const { data: members } = await admin.from('facility_members').select('user_id, role').eq('facility_id', id);
  const usedSeats = (members ?? []).length;
  const maxSeats = seatLimit(facility.extra_seats);
  const seatsFull = usedSeats >= maxSeats;
  const memberUsers = await Promise.all(
    (members ?? []).map(async (member) => {
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      return [member.user_id, data.user?.email ?? '—'] as const;
    }),
  );
  const emailById = new Map(memberUsers);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href={`/facility/${id}`} className="text-sm text-teal-700">
          ← Back to dashboard
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">Invite a staff member</h1>
        <p className="text-sm text-slate-500">Add a colleague to help manage {facility.name}.</p>
        <p className="mt-1 text-xs text-slate-500">
          {usedSeats} of {maxSeats} seats used. Every plan currently includes {INCLUDED_SEATS} team seats.
        </p>
      </div>

      {(seatfull || seatsFull) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <strong>You&apos;ve used all {maxSeats} seats.</strong> Additional seats are not available through self-service
          checkout. Contact Clear Bed before inviting another teammate so any custom arrangement is documented.
          <div className="mt-2">
            <a
              href="mailto:sales@clearbedrecovery.com?subject=Clear%20Bed%20team%20seat%20request"
              className="inline-block rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
            >
              Contact Clear Bed →
            </a>
          </div>
        </div>
      )}

      {already === '1' && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          That account is already on this facility team. Its existing role was not changed.
        </div>
      )}

      {invited === '1' && (
        <div className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          ✓ Your colleague can now help manage {facility.name} as staff.
          {emailed === '1' ? (
            <div className="mt-1 text-xs text-emerald-800">
              We&apos;ve emailed them {newAccount === '1' ? 'a single-use link to set a password' : 'a sign-in link'}.
            </div>
          ) : (
            <div className="mt-1 text-xs text-amber-800">
              We couldn&apos;t deliver the invite email. Ask them to open the sign-in page and use “Forgot password.”
            </div>
          )}
        </div>
      )}

      <form action={inviteStaff} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <input type="hidden" name="facility_id" value={id} />
        <div>
          <label className="text-xs text-slate-500">Their work email</label>
          <input
            name="email"
            type="email"
            required
            placeholder="colleague@yourprogram.org"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <p className="text-xs text-slate-500">
          Invites grant staff access to edit the profile, update residential-bed reports, and view consented contacts.
          Ownership changes require administrator review.
        </p>
        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Send invite</button>
      </form>

      <div>
        <h2 className="text-sm font-semibold text-slate-700">Your team</h2>
        <div className="mt-2 space-y-1">
          {(members ?? []).map((m) => (
            <div key={m.user_id} className="flex justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="text-slate-700">{emailById.get(m.user_id) ?? m.user_id}</span>
              <span className="text-xs text-slate-400">{m.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
