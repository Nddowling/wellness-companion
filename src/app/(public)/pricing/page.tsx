import type { Metadata } from 'next';
import Link from 'next/link';

import { PricingTable } from '@/components/PricingTable';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Pricing — Clear Bed Recovery',
  description:
    'Simple flat-fee plans for treatment programs. Facilities pay; people seeking care never do. No per-referral fees — ever.',
  alternates: { canonical: '/pricing' },
};

export default function PricingPage() {
  return (
    <>
    <main className="text-slate-800">
      <section className="mx-auto max-w-5xl px-6 pb-2 pt-16 text-center">
        <span className="eyebrow text-teal-700">For treatment programs</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
          Simple, flat pricing
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-500">
          Programs pay to be found. People seeking care <strong>never</strong> pay. Start free and upgrade when
          you&apos;re ready — no contracts, cancel anytime.
        </p>
        {/* Seeker escape — this is provider pricing; never let someone seeking care think they'd pay. */}
        <p className="mx-auto mt-4 max-w-xl rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Looking for treatment for yourself or someone else?{' '}
          <Link href="/match" className="font-semibold underline underline-offset-2">
            Find care →
          </Link>{' '}
          — always free, no account needed.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-8">
        <PricingTable />
      </section>

      <section className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-xl border border-slate-200 bg-mist/60 p-5 text-sm text-slate-600">
          <h3 className="font-semibold text-slate-800">Flat fees — always</h3>
          <p className="mt-1">
            We never charge per referral, per lead, or per admission, and featured placement is a fixed
            advertising fee labeled as such. This isn&apos;t just our preference — it&apos;s required by federal
            law (EKRA, 18 U.S.C. § 220), which protects people seeking treatment from pay-to-play referrals.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <h2 className="text-xl font-semibold text-slate-800">Not sure where to start?</h2>
        <p className="mt-2 text-sm text-slate-500">
          List your program for free today — you can upgrade to a paid plan anytime.
        </p>
        <Link
          href="/claim"
          className="mt-4 inline-block rounded-md bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Get your free listing →
        </Link>
      </section>
    </main>
    <SiteFooter />
    </>
  );
}
