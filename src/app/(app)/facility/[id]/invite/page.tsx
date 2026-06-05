import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireFacilityMember } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { inviteStaff } from '../../actions';
import { seatLimit, INCLUDED_SEATS, EXTRA_SEAT_PRICE_MONTHLY } from '@/lib/facility/plan';

export default async function InviteStaff({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invited?: string; tmp?: string; emailed?: string; seatfull?: string }>;
}) {
  const { id } = await params;
  const { invited, tmp, emailed, seatfull } = await searchParams;
  const { facilityIds } = await requireFacilityMember();
  if (!facilityIds.includes(id)) notFound();

  const admin = createAdminClient();
  const { data: facility } = await admin.from('facilities').select('name, extra_seats').eq('id', id).maybeSingle();
  if (!facility) notFound();

  const { data: members } = await admin.from('facility_members').select('user_id, role').eq('facility_id', id);
  const usedSeats = (members ?? []).length;
  const maxSeats = seatLimit(facility.extra_seats);
  const seatsFull = usedSeats >= maxSeats;
  const { data: usersList } = await admin.auth.admin.listUsers();
  const emailById = new Map((usersList?.users ?? []).map((u) => [u.id, u.email ?? '—']));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href={`/facility/${id}`} className="text-sm text-teal-700">
          ← Back to dashboard
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">Invite a staff member</h1>
        <p className="text-sm text-slate-500">Add a colleague to help manage {facility.name}.</p>
        <p className="mt-1 text-xs text-slate-500">
          {usedSeats} of {maxSeats} seats used. Every plan includes {INCLUDED_SEATS} (Admin + 1 BD); extra seats are
          ${EXTRA_SEAT_PRICE_MONTHLY}/mo each.
        </p>
      </div>

      {(seatfull || seatsFull) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <strong>You&apos;ve used all {maxSeats} seats.</strong> Add a seat for ${EXTRA_SEAT_PRICE_MONTHLY}/mo to invite
          another teammate.
          <div className="mt-2">
            <Link
              href={`/pricing?seat=1&facility=${id}`}
              className="inline-block rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
            >
              Add a seat (${EXTRA_SEAT_PRICE_MONTHLY}/mo) →
            </Link>
          </div>
        </div>
      )}

      {invited && (
        <div className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          ✓ <strong>{invited}</strong> can now help manage {facility.name}.
          {emailed === '1' ? (
            <div className="mt-1 text-xs text-emerald-800">
              We&apos;ve emailed them an invite with sign-in details.
            </div>
          ) : (
            <div className="mt-1 text-xs text-amber-800">
              We couldn&apos;t send the invite email{tmp ? '' : ' just now'} — share their sign-in details directly.
            </div>
          )}
          {tmp && (
            <div className="mt-1 text-xs text-emerald-800">
              Temporary password: <strong>{tmp}</strong> — they can change it after signing in. (Also included in
              the invite email.)
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
        <div>
          <label className="text-xs text-slate-500">Role</label>
          <select name="role" defaultValue="staff" className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
            <option value="staff">Staff — can edit profile, beds, and leads</option>
            <option value="owner">Owner — full access, can invite others</option>
          </select>
        </div>
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
