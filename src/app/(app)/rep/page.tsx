import Link from 'next/link';

import { requireRep } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { absoluteUrl } from '@/lib/seo';
import { getMyAffiliations, getMyInvites, getRepProfile } from '@/lib/rep/data';
import { AttachFacility } from '@/components/rep/AttachFacility';
import { CopyLink } from '@/components/partner/CopyLink';
import {
  createInviteAction,
  deleteInviteAction,
  removeAffiliationAction,
  updateRepProfileAction,
} from '@/app/(app)/rep/actions';

const field = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700';

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

      {/* Profile editor */}
      <form action={updateRepProfileAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="display_name" className="text-sm font-medium text-slate-700">
              Name
            </label>
            <input id="display_name" name="display_name" defaultValue={profile?.display_name ?? metaName} className={field} required />
          </div>
          <div>
            <label htmlFor="location" className="text-sm font-medium text-slate-700">
              Location
            </label>
            <input id="location" name="location" defaultValue={profile?.location ?? ''} placeholder="Atlanta, GA" className={field} />
          </div>
        </div>
        <div>
          <label htmlFor="headline" className="text-sm font-medium text-slate-700">
            Headline
          </label>
          <input id="headline" name="headline" defaultValue={profile?.headline ?? ''} placeholder="Admissions Director · 8 yrs in recovery care" className={field} />
        </div>
        <div>
          <label htmlFor="bio" className="text-sm font-medium text-slate-700">
            About
          </label>
          <textarea id="bio" name="bio" defaultValue={profile?.bio ?? ''} rows={4} placeholder="Your experience, approach, and what you’re proud of." className={field} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="photo_url" className="text-sm font-medium text-slate-700">
              Photo URL
            </label>
            <input id="photo_url" name="photo_url" defaultValue={profile?.photo_url ?? ''} placeholder="https://…/headshot.jpg" className={field} />
          </div>
          <div>
            <label htmlFor="linkedin_url" className="text-sm font-medium text-slate-700">
              LinkedIn URL
            </label>
            <input id="linkedin_url" name="linkedin_url" defaultValue={profile?.linkedin_url ?? ''} placeholder="https://linkedin.com/in/…" className={field} />
          </div>
        </div>
        <div>
          <label htmlFor="specialties" className="text-sm font-medium text-slate-700">
            Specialties <span className="text-xs text-slate-400">(comma-separated)</span>
          </label>
          <input id="specialties" name="specialties" defaultValue={(profile?.specialties ?? []).join(', ')} placeholder="Detox intake, Dual diagnosis, Veterans" className={field} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="is_public" defaultChecked={profile?.is_public ?? true} className="h-4 w-4 rounded border-slate-300" />
          Profile is public (shareable + can appear on facility listings)
        </label>
        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
          Save profile
        </button>
      </form>

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
