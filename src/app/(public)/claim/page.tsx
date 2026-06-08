import Link from 'next/link';
import type { Metadata } from 'next';

import { createAdminClient } from '@/lib/supabase/admin';
import { Logo } from '@/components/Logo';
import { submitPublicClaim } from './actions';

export const metadata: Metadata = {
  title: 'Claim your facility — Clear Bed Recovery',
  description:
    'Run a treatment program? Claim your facility to manage your profile, beds, and referrals. We verify every claim before granting access.',
};

const field = 'w-full rounded border border-slate-300 px-3 py-2 text-sm';

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { submitted, error } = await searchParams;

  const admin = createAdminClient();
  const { data: facilities } = await admin
    .from('facilities')
    .select('id, name, city, state')
    .order('name');

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-10">
      <Link href="/" aria-label="Clear Bed Recovery — home">
        <Logo className="text-xl" />
      </Link>

      <h1 className="mt-8 font-serif text-3xl text-ink">Claim your facility</h1>
      <p className="mt-2 text-sm text-slate-600">
        Manage your program&apos;s profile, keep bed availability current, and receive referrals. Tell us
        a little about you and your program — we verify every claim and reach out before granting access.
        There&apos;s no account to create yet; we&apos;ll set yours up once you&apos;re verified.
      </p>

      {submitted && (
        <div className="mt-6 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ Thanks — your claim is in. We&apos;ll verify your details and email you a login once approved.
          Already verified? <Link href="/login" className="font-medium underline">Provider login</Link>.
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Please include your email and either pick your facility or type its name.
        </div>
      )}

      {!submitted && (
        <form action={submitPublicClaim} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Your facility</label>
            <select name="facility_id" className={field} defaultValue="">
              <option value="">Choose your facility…</option>
              {(facilities ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {[f.city, f.state].filter(Boolean).length ? ` — ${[f.city, f.state].filter(Boolean).join(', ')}` : ''}
                </option>
              ))}
            </select>
            <input
              name="facility_name_freetext"
              placeholder="Not listed? Type your facility name + city"
              className={`${field} mt-2`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input name="claimant_name" placeholder="Your name" className={field} />
            <input name="claimant_title" placeholder="Your role / title" className={field} />
            <input name="claimant_email" type="email" required placeholder="Work email" className={field} />
            <input name="claimant_phone" placeholder="Phone" className={field} />
          </div>

          <textarea
            name="note"
            rows={3}
            placeholder="Anything that helps us verify you (website, NPI, your role)…"
            className={field}
          />

          <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800">
            Submit claim for verification
          </button>
          <p className="text-center text-xs text-slate-500">
            Already verified? <Link href="/login" className="font-medium text-teal-700 underline">Provider login</Link>
          </p>
        </form>
      )}
    </main>
  );
}
