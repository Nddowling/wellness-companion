'use client';

import Link from 'next/link';
import { useState } from 'react';

type Tier = {
  key: string;
  name: string;
  tagline: string;
  monthly: string;
  annual: string;
  paid: boolean;
  cta: string;
  freeHref?: string;
  highlight: boolean;
  features: string[];
};

const TIERS: Tier[] = [
  {
    key: 'free',
    name: 'Free',
    tagline: 'Get on the map.',
    monthly: '$0',
    annual: '$0',
    paid: false,
    cta: 'Get listed free',
    freeHref: '/get-started',
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
    tagline: 'Own your profile.',
    monthly: '$349',
    annual: '$3,490',
    paid: true,
    cta: 'Start Verified',
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
    tagline: 'Stand out & scale.',
    monthly: '$999',
    annual: '$9,990',
    paid: true,
    cta: 'Start Premium',
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

export function PricingTable() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      {/* Monthly / annual toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={annual ? 'text-sm text-slate-400' : 'text-sm font-medium text-slate-700'}>Monthly</span>
        <button
          onClick={() => setAnnual((a) => !a)}
          aria-label="Toggle annual billing"
          className={
            'relative h-6 w-11 rounded-full transition ' + (annual ? 'bg-teal-700' : 'bg-slate-300')
          }
        >
          <span
            className={
              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ' + (annual ? 'left-[22px]' : 'left-0.5')
            }
          />
        </button>
        <span className={annual ? 'text-sm font-medium text-slate-700' : 'text-sm text-slate-400'}>
          Annual <span className="text-teal-700">· 2 months free</span>
        </span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {TIERS.map((t) => {
          const href = t.paid ? `/api/checkout?plan=${t.key}&cycle=${annual ? 'annual' : 'monthly'}` : t.freeHref!;
          const price = annual ? t.annual : t.monthly;
          const period = t.paid ? (annual ? '/yr' : '/mo') : 'forever';
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
              {t.paid && annual && <p className="mt-1 text-xs text-teal-700">2 months free vs. monthly</p>}

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
    </div>
  );
}
