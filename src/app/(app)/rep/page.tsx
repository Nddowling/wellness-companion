import Link from 'next/link';

import { requireRep } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { absoluteUrl } from '@/lib/seo';
import { getMyAffiliations, getMyInvites, getRepProfile } from '@/lib/rep/data';
import { getInboundReferrals, getInboundReferralStats } from '@/lib/referrals/data';
import { LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';
import { AttachFacility } from '@/components/rep/AttachFacility';
import { RepProfileForm } from '@/components/rep/RepProfileForm';
import { CopyLink } from '@/components/partner/CopyLink';
import {
  createInviteAction,
  deleteInviteAction,
  removeAffiliationAction,
} from '@/app/(app)/rep/actions';

const STATUS_BADGE: Record<string, string> = {
  verified: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  rejected: 'bg-slate-100 text-slate-500',
};

export default async function RepDashboard() {
  const user = await requireRep();
  const supabase = await createClient();
  const {
    data: { user: full },
  } = await supabase.auth.getUser();
  const metaName = (full?.user_metadata as { full_name?: string } | undefined)?.full_name ?? '';

  const [profile, affiliations, invites] = await Promise.all([
    getRepProfile(user.id),
    getMyAffiliations(user.id),
    getMyInvites(user.id),
  ]);

  // Inbound referral activity is scoped to VERIFIED affiliations only — a rep genuinely
  // works there. Aggregate + de-identified; never grants facility management.
  const verifiedFacilityIds = affiliations.filter((a) => a.status === 'verified').map((a) => a.facility_id);
  const [inboundStats, inbound] = await Promise.all([
    getInboundReferralStats(verifiedFacilityIds),
    getInboundReferrals(verifiedFacilityIds, 8),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Your profile</h1>
          <p className="text-sm text-slate-500">Build it, attach your facility, and bring your colleagues.</p>
        </div>
        {profile && (
          <Link
            href={`/p/${profile.slug}`}
            className="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-teal-700 hover:border-teal-400"
          >
            View public profile →
          </Link>
        )}
      </div>

      {/* Inbound referral activity — only once at least one facility is verified */}
      {verifiedFacilityIds.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Referrals to your facilities</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: inboundStats.total },
              { label: 'Accepted', value: inboundStats.accepted },
              { label: 'Awaiting', value: inboundStats.pending },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-xl font-semibold text-ink">{s.value}</div>
                <div className="mt-0.5 text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
          {inbound.length > 0 && (
            <ul className="mt-4 space-y-2">
              {inbound.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-sm first:border-0 first:pt-0"
                >
                  <span className="text-slate-700">
                    {r.facilityName}
                    {r.careLevel && (
                      <span className="ml-2 text-xs text-slate-400">
                        {LEVEL_LABELS[r.careLevel as LevelOfCare] ?? r.careLevel}
                      </span>
                    )}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{r.routeStatus}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Profile editor (client form: device photo upload + inline save feedback) */}
      <RepProfileForm profile={profile} defaultName={metaName} />

      {/* Affiliations */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Facilities you represent</h2>
        {affiliations.length === 0 ? (
          <p className="text-xs text-slate-500">Attach yourself to your facility below — it shows on the listing once your director verifies.</p>
        ) : (
          <div className="space-y-2">
            {affiliations.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">{a.facility?.name ?? 'Facility'}</div>
                  <div className="text-xs text-slate-500">{a.title || 'Team member'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={'rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ' + (STATUS_BADGE[a.status] ?? 'bg-slate-100 text-slate-500')}>
                    {a.status}
                  </span>
                  <form action={removeAffiliationAction}>
                    <input type="hidden" name="facility_id" value={a.facility_id} />
                    <button className="text-xs text-slate-400 hover:text-red-600">Remove</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
          <div className="mb-2 text-sm font-medium text-slate-700">Attach a facility</div>
          <AttachFacility />
        </div>
      </section>

      {/* Invites */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Invite colleagues</h2>
        <p className="text-xs text-slate-500">Share a link so teammates can join with their own profiles.</p>
        <form action={createInviteAction} className="flex flex-wrap items-end gap-2">
          {affiliations.length > 0 && (
            <select name="facility_id" defaultValue="" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <option value="">No specific facility</option>
              {affiliations.map((a) => (
                <option key={a.facility_id} value={a.facility_id}>
                  Pre-attach to {a.facility?.name ?? 'facility'}
                </option>
              ))}
            </select>
          )}
          <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Create invite link
          </button>
        </form>
        <div className="space-y-2">
          {invites.map((inv) => (
            <div key={inv.token} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>{inv.facility ? `Pre-attaches to ${inv.facility.name}` : 'General invite'}</span>
                <form action={deleteInviteAction}>
                  <input type="hidden" name="token" value={inv.token} />
                  <button className="text-slate-400 hover:text-red-600">Delete</button>
                </form>
              </div>
              <CopyLink url={absoluteUrl(`/for-reps?invite=${inv.token}`)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
