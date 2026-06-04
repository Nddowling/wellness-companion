import Link from 'next/link';

import { requireUser } from '@/lib/auth';
import { getSearchesByAuthUser } from '@/lib/vault/seekers';
import { LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';
import { updateMyInfoAction } from './actions';

const field = 'rounded border border-slate-300 px-3 py-2 text-sm';

export default async function SeekerDashboard() {
  const user = await requireUser();
  const searches = await getSearchesByAuthUser(user.id);
  const latest = searches[0]?.search;
  const firstName = latest?.name ? latest.name.split(' ')[0] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>
        <p className="text-sm text-slate-500">Your information is saved privately. Reach out whenever you&apos;re ready.</p>
      </div>

      <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
        In an emergency, call <strong>911</strong>. In crisis or having thoughts of suicide, call or text{' '}
        <strong>988</strong> right now.
      </div>

      {searches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          <p>You don&apos;t have saved searches yet.</p>
          <Link href="/match" className="mt-3 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            Find care
          </Link>
        </div>
      ) : (
        <>
          {/* Edit personal info (latest record) */}
          {latest && (
            <form action={updateMyInfoAction} className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-700">Your information</h2>
              <input type="hidden" name="seeker_id" value={latest.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="name" defaultValue={latest.name ?? ''} placeholder="Name" className={field} />
                <input name="email" defaultValue={latest.email ?? ''} placeholder="Email" className={field} />
                <input name="phone" defaultValue={latest.phone ?? ''} placeholder="Phone" className={field} />
                <input name="dob" defaultValue={latest.dob ?? ''} placeholder="Date of birth" className={field} />
                <input name="insurance" defaultValue={latest.insurance ?? ''} placeholder="Insurance" className={field} />
              </div>
              <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Save my info</button>
            </form>
          )}

          {/* Past searches */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Your searches</h2>
            {searches.map(({ search, facilities }) => (
              <div key={search.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-400">
                  {new Date(search.created_at).toLocaleDateString()} ·{' '}
                  {String(search.face_sheet?.concern_category ?? 'care')} ·{' '}
                  {String(search.face_sheet?.care_level_needed ?? '')}
                </div>
                <div className="mt-2 space-y-1">
                  {facilities.map((f) => (
                    <div key={f.id} className="flex items-center justify-between text-sm">
                      <Link href={`/programs/${f.id}`} className="text-teal-700 hover:underline">
                        {f.name}
                      </Link>
                      <span className="text-xs text-slate-400">
                        {f.levels.map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l).join(', ')}
                      </span>
                    </div>
                  ))}
                  {facilities.length === 0 && <div className="text-xs text-slate-400">No programs saved.</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/programs" className="rounded-md border border-slate-300 px-4 py-2 text-slate-600 hover:border-teal-300">
          Browse all programs
        </Link>
        <Link href="/match" className="rounded-md border border-slate-300 px-4 py-2 text-slate-600 hover:border-teal-300">
          Start a new search
        </Link>
      </div>
    </div>
  );
}
