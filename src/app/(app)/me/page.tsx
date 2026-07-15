import Link from 'next/link';

import { requireSeeker } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSearchesByAuthUser } from '@/lib/vault/seekers';
import { LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';
import { updateMyInfoAction } from './actions';

const field = 'rounded border border-slate-300 px-3 py-2 text-sm';

export default async function SeekerDashboard() {
  const user = await requireSeeker();
  const supabase = await createClient();
  const {
    data: { user: full },
  } = await supabase.auth.getUser();
  const mustReset = (full?.user_metadata as { must_reset_password?: boolean } | undefined)?.must_reset_password;
  const searches = await getSearchesByAuthUser(user.id);
  const latest = searches[0]?.search;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Welcome back</h1>
        <p className="text-sm text-slate-500">Your information is saved privately. Reach out whenever you&apos;re ready.</p>
      </div>

      {mustReset && (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          <strong>Finish setting up your account.</strong>{' '}
          <Link href="/reset" className="font-medium underline">
            set your own password
          </Link>{' '}
          to secure your account. If your setup link expired, use “Forgot password” on the sign-in page.
        </div>
      )}

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
          {/* Edit only the single, already-consented contact method. */}
          {latest && (latest.email || latest.phone) && (
            <form action={updateMyInfoAction} className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-700">Your contact method</h2>
              <input type="hidden" name="seeker_id" value={latest.id} />
              <input type="hidden" name="channel" value={latest.email ? 'email' : 'phone'} />
              <label className="grid gap-1 text-xs font-medium text-slate-600">
                {latest.email ? 'Email you chose' : 'Phone you chose'}
                <input
                  name="value"
                  type={latest.email ? 'email' : 'tel'}
                  defaultValue={latest.email ?? latest.phone ?? ''}
                  required
                  autoComplete={latest.email ? 'email' : 'tel'}
                  className={field}
                />
              </label>
              <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                <input type="checkbox" name="confirmed" value="1" required className="mt-0.5" />
                <span>
                  I confirm Clear Bed may continue using this contact method for the permissions I previously chose.
                </span>
              </label>
              <p className="text-xs text-slate-400">
                This updates the same contact channel only. Start a new connection to choose a different method.
              </p>
              <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Save my info</button>
            </form>
          )}

          {/* Past searches */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Your searches</h2>
            {searches.map(({ search, facilities }) => (
              <div key={search.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-400">
                  {new Date(search.created_at).toLocaleDateString()}
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

      {/* Support & resources — free content for wherever someone is in recovery */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700">Support &amp; resources</h2>
        <p className="mt-1 text-xs text-slate-500">Free reading and tools you can use privately, anytime.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link href="/library" className="rounded-xl border border-slate-200 p-3 transition hover:border-teal-300">
            <div className="text-sm font-semibold text-ink">📚 Recovery library</div>
            <div className="mt-0.5 text-xs text-slate-500">Guides you can read privately, anytime.</div>
          </Link>
          <Link href="/guides" className="rounded-xl border border-slate-200 p-3 transition hover:border-teal-300">
            <div className="text-sm font-semibold text-ink">🧭 How-to guides</div>
            <div className="mt-0.5 text-xs text-slate-500">Insurance, what to expect, first steps.</div>
          </Link>
        </div>
      </div>

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
