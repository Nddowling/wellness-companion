import type { Metadata } from 'next';
import Link from 'next/link';

import Reveal from '@/components/Reveal';

export const metadata: Metadata = {
  title: 'Pricing — Clear Bed Recovery',
  description:
    'Simple flat-fee plans for treatment programs. Facilities pay; people seeking care never do. No per-referral fees — ever.',
  alternates: { canonical: '/pricing' },
};

type Tier = {
  key: string;
  name: string;
  price: string;
  period: string;
  annual?: string;
  tagline: string;
  cta: string;
  href: string;
  highlight: boolean;
  features: string[];
};

const TIERS: Tier[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'Get on the map.',
    cta: 'Get listed free',
    href: '/get-started',
    highlight: false,
    features: [
      'Directory listing — name, location, levels of care',
      'Appears in seeker matches',
      'No credit card required',
    ],
  },
  {
    key: 'verified',
    name: 'Verified',
    price: '$349',
    period: '/mo',
    annual: 'or $3,490/yr — save ~$700',
    tagline: 'Own your profile.',
    cta: 'Start Verified',
    href: '/api/checkout?plan=verified',
    highlight: true,
    features: [
      'Everything in Free',
      'Claimed, editable profile',
      'Photos & a Verified badge',
      'Live bed availability',
      'Reviews from people you’ve served',
      'Intake contact shown to seekers',
      'Basic analytics',
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '$999',
    period: '/mo',
    annual: 'or $9,990/yr — save ~$2,000',
    tagline: 'Stand out & scale.',
    cta: 'Start Premium',
    href: '/api/checkout?plan=premium',
    highlight: false,
    features: [
      'Everything in Verified',
      'Featured “Sponsored” placement (flat fee)',
      'Multiple locations',
      'EHR / bed-feed integration',
      'Priority support',
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="text-slate-800">
      <section className="mx-auto max-w-5xl px-6 pb-6 pt-16 text-center">
        <span className="eyebrow text-teal-700">For treatment programs</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
          Simple, flat pricing
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-500">
          Programs pay to be found. People seeking care <strong>never</strong> pay. Start free and upgrade when
          you&apos;re ready — no contracts, cancel anytime.
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-8 lg:grid-cols-3">
        {TIERS.map((t, i) => (
          <Reveal key={t.key} delay={i * 110}>
            <div
              className={
                'flex h-full flex-col rounded-2xl border bg-white p-6 ' +
                (t.highlight ? 'border-teal-600 shadow-lg ring-1 ring-teal-600' : 'border-slate-200')
              }
            >
              {t.highlight && (
                <span className="mb-2 self-start rounded-full bg-teal-700 px-2.5 py-0.5 text-xs font-medium text-white">
                  Most popular
                </span>
              )}
              <h2 className="text-lg font-semibold text-slate-800">{t.name}</h2>
              <p className="text-sm text-slate-500">{t.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-slate-800">{t.price}</span>
                <span className="text-sm text-slate-500">{t.period}</span>
              </div>
              {t.annual && <p className="mt-1 text-xs text-slate-400">{t.annual}</p>}

              <Link
                href={t.href}
                className={
                  'mt-5 rounded-md px-4 py-2.5 text-center text-sm font-semibold transition ' +
                  (t.highlight
                    ? 'bg-terracotta text-white hover:bg-terracotta-dark'
                    : 'border border-slate-300 text-slate-700 hover:border-teal-400')
                }
              >
                {t.cta}
              </Link>

              <ul className="mt-6 space-y-2 text-sm text-slate-600">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-0.5 text-teal-600">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </section>

      {/* EKRA / compliance note */}
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
          List your program for free today — you can upgrade to Verified anytime.
        </p>
        <Link
          href="/get-started"
          className="mt-4 inline-block rounded-md bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Get your free listing →
        </Link>
      </section>
    </main>
  );
}
