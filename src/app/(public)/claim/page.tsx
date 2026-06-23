import Link from 'next/link';
import type { Metadata } from 'next';

import { Logo } from '@/components/Logo';
import { ClaimFacilityField } from '@/components/ClaimFacilityField';
import { submitPublicClaim } from './actions';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Claim your facility — Clear Bed Recovery',
  description:
    'Run a treatment program? Claim your facility to manage your profile, beds, and referrals. We verify every claim before granting access.',
};

const field = 'w-full rounded border border-slate-300 px-3 py-2 text-sm';

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string; exists?: string }>;
}) {
  const { submitted, error, exists } = await searchParams;

  return (
    <>
    <main className="mx-auto min-h-screen max-w-xl px-5 py-10">
      <Link href="/" aria-label="Clear Bed Recovery — home">
        <Logo className="text-xl" />
      </Link>

      <h1 className="mt-8 font-serif text-3xl text-ink">Claim your facility</h1>
      <p className="mt-2 text-sm text-slate-600">
        Manage your program&apos;s profile, keep bed availability current, and receive referrals. Tell us
        a little about you and your program, and pick a password — you can sign in right away. We verify
        every claim before granting access to manage your listing.
      </p>

      {submitted && (
        <div className="mt-6 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ Thanks — your claim is in.{' '}
          {exists ? (
            <>
              It looks like you already have an account —{' '}
              <Link href="/login" className="font-medium underline">sign in</Link> with your existing
              password. We&apos;ll link this facility once an admin verifies you (usually 1–2 business days).
            </>
          ) : (
            <>
              You can <Link href="/login" className="font-medium underline">sign in now</Link> with the email
              and password you just chose. We review every claim (usually within{' '}
              <strong>1–2 business days</strong>) and grant access to manage your listing once you&apos;re
              approved.
            </>
          )}
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error === 'pw'
            ? 'Please choose a password of at least 8 characters.'
            : 'Please include your email and either pick your facility or type its name.'}
        </div>
      )}

      {!submitted && (
        <form action={submitPublicClaim} className="mt-6 space-y-4">
          <ClaimFacilityField />

          <div className="grid gap-3 sm:grid-cols-2">
            <input name="claimant_name" required placeholder="Your name" className={field} />
            <input name="claimant_title" placeholder="Your role / title" className={field} />
            <input name="claimant_email" type="email" required placeholder="Work email" className={field} />
            <input name="claimant_phone" placeholder="Phone" className={field} />
          </div>

          <div>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Create a password (8+ characters)"
              className={field}
            />
            <p className="mt-1 text-xs text-slate-500">You&apos;ll sign in with your work email and this password.</p>
          </div>

          <textarea
            name="note"
            rows={3}
            placeholder="Anything that helps us verify you (website, NPI, your role)…"
            className={field}
          />

          <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800">
            Create account &amp; submit claim
          </button>
          <p className="text-center text-xs text-slate-500">
            We&apos;ll review and reach out within 1–2 business days. Already verified?{' '}
            <Link href="/login" className="font-medium text-teal-700 underline">Provider login</Link>
          </p>
        </form>
      )}
    </main>
    <SiteFooter />
    </>
  );
}
