import { requirePartner } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getPartnerProfile } from '@/lib/partner/data';
import { PARTNER_TYPE_GROUPS } from '@/lib/partner/types';
import { updatePartnerProfileAction } from '@/app/(app)/partners/actions';

const field = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700';

export default async function PartnerSettings() {
  const user = await requirePartner();
  const supabase = await createClient();
  const {
    data: { user: full },
  } = await supabase.auth.getUser();
  const fullName = (full?.user_metadata as { full_name?: string } | undefined)?.full_name ?? '';
  const profile = await getPartnerProfile(user.id);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Your profile</h1>
        <p className="text-sm text-slate-500">How you refer — used to tailor your experience. Always free.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Name</span>
          <span className="text-slate-700">{fullName || '—'}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-slate-500">Email</span>
          <span className="text-slate-700">{full?.email ?? '—'}</span>
        </div>
      </div>

      <form action={updatePartnerProfileAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="partner_type" className="text-sm font-medium text-slate-700">
            How do you refer people?
          </label>
          <select id="partner_type" name="partner_type" defaultValue={profile?.partner_type ?? ''} className={field}>
            <option value="">Select your role…</option>
            {PARTNER_TYPE_GROUPS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="title" className="text-sm font-medium text-slate-700">
              Title
            </label>
            <input id="title" name="title" defaultValue={profile?.title ?? ''} placeholder="Discharge Planner" className={field} />
          </div>
          <div>
            <label htmlFor="employer" className="text-sm font-medium text-slate-700">
              Organization
            </label>
            <input id="employer" name="employer" defaultValue={profile?.employer ?? ''} placeholder="Grady Memorial Hospital" className={field} />
          </div>
        </div>

        <div>
          <label htmlFor="phone" className="text-sm font-medium text-slate-700">
            Phone (optional)
          </label>
          <input id="phone" name="phone" defaultValue={profile?.phone ?? ''} placeholder="(555) 123-4567" className={field} />
        </div>

        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
          Save profile
        </button>
      </form>
    </div>
  );
}
