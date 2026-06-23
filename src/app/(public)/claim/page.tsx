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
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { submitted, error } = await searchParams;

  return (
    <>
    <main className="mx-auto min-h-screen max-w-xl px-5 py-10">
      <Link href="/" aria-label="Clear Bed Recovery — home">
        <Logo className="text-xl" />
      </Link>

      <h1 className="mt-8 font-serif text-3xl text-ink">Claim your facility</h1>
      <p className="mt-2 text-sm text-slate-600">
        Manage your program&apos;s profile, keep bed availability current, and receive referrals. Tell us
        a little about you and your program — we verify every claim and reach out before granting access.
        Once you&apos;re approved, we&apos;ll email you a link to set your password and sign in.
      </p>

      {submitted && (
        <div className="mt-6 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ Thanks — your claim is in. We review every claim (usually within{' '}
          <strong>1–2 business days</strong>) and email you a link to set your password and sign in once
          you&apos;re approved. Already verified? <Link href="/login" className="font-medium underline">Provider login</Link>.
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Please include your email and either pick your facility or type its name.
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
