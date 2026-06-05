'use client';

import Link from 'next/link';
import { useState } from 'react';

type Tier = {
  key: string;
  name: string;
  tagline: string;
  monthly: string;
  annual: string;
  cta: string;
  highlight: boolean;
  features: string[];
};

const TIERS: Tier[] = [
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'Outpatient, OTP & smaller programs.',
    monthly: '$499',
    annual: '$5,988',
    cta: 'Start Starter',
    highlight: false,
    features: [
      'Claimed, editable profile + photos',
      'Bed board listing & live availability',
      'Receive payer-matched applications',
      'Basic referral tracking',
      'Reviews from people you’ve served',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    tagline: 'Mid-size residential & PHP.',
    monthly: '$999',
    annual: '$11,988',
    cta: 'Start Growth',
    highlight: true,
    features: [
      'Everything in Starter',
      '2 referrer (BD) seats',
      'Attribution tracking',
      'Follow-up workflow',
      'Priority placement in match results',
    ],
  },
  {
    key: 'anchor',
    name: 'Anchor',
    tagline: 'Multi-bed residential & hospital systems.',
    monthly: '$1,999',
    annual: '$23,988',
    cta: 'Start Anchor',
    highlight: false,
    features: [
      'Everything in Growth',
      'Unlimited referrer seats',
      'Dedicated onboarding',
      'Census analytics dashboard',
      'API bed-board updates',
      'White-glove intake-team training',
    ],
  },
];

export function PricingTable() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      {/* Founding offer */}
      <div className="mb-6 rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-center text-sm text-slate-700">
        <strong className="text-slate-800">Founding facilities:</strong> our first 10 programs get{' '}
        <strong>50% off the first year</strong> — applied automatically at checkout.
      </div>

      {/* Monthly / annual toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={annual ? 'text-sm text-slate-400' : 'text-sm font-medium text-slate-700'}>Monthly</span>
        <button
          onClick={() => setAnnual((a) => !a)}
          aria-label="Toggle annual billing"
          className={'relative h-6 w-11 rounded-full transition ' + (annual ? 'bg-teal-700' : 'bg-slate-300')}
        >
          <span
            className={
              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ' + (annual ? 'left-[22px]' : 'left-0.5')
            }
          />
        </button>
        <span className={annual ? 'text-sm font-medium text-slate-700' : 'text-sm text-slate-400'}>
          Annual <span className="text-slate-400">· billed yearly</span>
        </span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {TIERS.map((t) => {
          const href = `/api/checkout?plan=${t.key}&cycle=${annual ? 'annual' : 'monthly'}`;
          const price = annual ? t.annual : t.monthly;
          const period = annual ? '/yr' : '/mo';
          return (
            <div
              key={t.key}
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
                <span className="text-3xl font-semibold text-slate-800">{price}</span>
                <span className="text-sm text-slate-500">{period}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">per facility{annual ? '' : ', billed monthly'}</p>

              <Link
                href={href}
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
          );
        })}
      </div>

      {/* Free / basic listing */}
      <p className="mt-6 text-center text-sm text-slate-500">
        Not ready to subscribe?{' '}
        <Link href="/get-started" className="font-medium text-teal-700 hover:underline">
          List your program for free →
        </Link>{' '}
        (a basic directory listing, so people can still find you).
      </p>
    </div>
  );
}
