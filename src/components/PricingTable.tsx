'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { BillingCycle, BillingPlan } from '@/lib/billing/guards';

type Tier = {
  key: BillingPlan;
  name: string;
  tagline: string;
  monthly: string;
  annual: string;
  cta: string;
  highlight: boolean;
  features: string[];
};

export type BillingFacilityOption = {
  id: string;
  name: string;
  billingManaged: boolean;
};

type CheckoutReply = {
  action?: 'checkout' | 'portal' | 'contact';
  error?: string;
  loginUrl?: string;
  url?: string;
};

const TIERS: Tier[] = [
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'Basic in-app listing analytics.',
    monthly: '$499',
    annual: '$5,988',
    cta: 'Start Starter',
    highlight: false,
    features: [
      '30-day profile contact-action total',
      'All-time website referral count',
      'Two included team seats',
      'Larger teams require a documented custom arrangement',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    tagline: 'Analytics plus lead-status workflow.',
    monthly: '$999',
    annual: '$11,988',
    cta: 'Start Growth',
    highlight: true,
    features: [
      'Everything in Starter',
      'Mark leads viewed, accepted, or declined',
      'Two included team seats',
      'Larger teams require a documented custom arrangement',
    ],
  },
  {
    key: 'anchor',
    name: 'Anchor',
    tagline: 'Detailed in-app analytics and workflow.',
    monthly: '$1,999',
    annual: '$23,988',
    cta: 'Start Anchor',
    highlight: false,
    features: [
      'Everything in Growth',
      '30-day website, call, directions, and email breakdown',
      'Two included team seats',
      'Larger teams require a documented custom arrangement',
    ],
  },
];

export function PricingTable({
  facilities = [],
  initialCycle = 'monthly',
  initialFacilityId = null,
  initialPlan = null,
  isSignedIn = false,
  membershipCount = 0,
}: {
  facilities?: BillingFacilityOption[];
  initialCycle?: BillingCycle;
  initialFacilityId?: string | null;
  initialPlan?: BillingPlan | null;
  isSignedIn?: boolean;
  membershipCount?: number;
}) {
  const [annual, setAnnual] = useState(initialCycle === 'annual');
  const [selectedFacilityId, setSelectedFacilityId] = useState(() => {
    if (!isSignedIn && initialFacilityId) return initialFacilityId;
    if (initialFacilityId && facilities.some((facility) => facility.id === initialFacilityId)) {
      return initialFacilityId;
    }
    return membershipCount === 1 && facilities.length === 1 ? facilities[0].id : '';
  });
  const [busyPlan, setBusyPlan] = useState<BillingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cycle: BillingCycle = annual ? 'annual' : 'monthly';
  const selectedFacility = facilities.find((facility) => facility.id === selectedFacilityId) ?? null;
  const showFacilityPicker = isSignedIn && (membershipCount > 1 || facilities.length > 1);

  async function beginBilling(plan: BillingPlan) {
    if (busyPlan) return;
    if (isSignedIn && facilities.length === 0) {
      setError('Only a verified facility owner can manage billing.');
      return;
    }
    if (isSignedIn && membershipCount > 1 && !selectedFacilityId) {
      setError('Select the facility whose billing you want to manage.');
      return;
    }

    setBusyPlan(plan);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, cycle, facilityId: selectedFacilityId || null }),
      });
      const reply = (await response.json()) as CheckoutReply;
      if (reply.loginUrl) {
        window.location.assign(reply.loginUrl);
        return;
      }
      if (reply.url && (response.ok || reply.action === 'contact')) {
        window.location.assign(reply.url);
        return;
      }
      setError(reply.error || 'Secure billing is temporarily unavailable.');
    } catch {
      setError('Secure billing is temporarily unavailable. Please try again.');
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <div>
      {showFacilityPicker && (
        <div className="mx-auto mb-6 max-w-lg rounded-xl border border-slate-200 bg-white p-4 text-left">
          <label htmlFor="billing-facility" className="text-sm font-semibold text-slate-800">
            Facility to bill
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Billing is facility-specific. Choose the location you own before continuing.
          </p>
          <select
            id="billing-facility"
            value={selectedFacilityId}
            onChange={(event) => {
              setSelectedFacilityId(event.target.value);
              setError(null);
            }}
            className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="">Select a facility…</option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {initialPlan && (
        <p className="mx-auto mb-5 max-w-lg rounded-lg bg-teal-50 px-3 py-2 text-center text-sm text-teal-800">
          Your {TIERS.find((tier) => tier.key === initialPlan)?.name} selection is ready to continue.
        </p>
      )}

      {error && (
        <p role="alert" className="mx-auto mb-5 max-w-lg rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
          {error}
        </p>
      )}

      {isSignedIn && facilities.length === 0 && (
        <p className="mx-auto mb-5 max-w-lg rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
          A verified facility owner must manage subscriptions. Staff can ask their facility owner or contact us.
        </p>
      )}

      {selectedFacility?.billingManaged && (
        <p className="mx-auto mb-5 max-w-lg rounded-lg bg-slate-100 px-3 py-2 text-center text-sm text-slate-700">
          This facility already has managed billing. Any plan button opens its secure billing portal instead of
          starting another subscription.
        </p>
      )}

      <div className="flex items-center justify-center gap-3">
        <span className={annual ? 'text-sm text-slate-400' : 'text-sm font-medium text-slate-700'}>Monthly</span>
        <button
          type="button"
          onClick={() => setAnnual((value) => !value)}
          aria-label="Toggle annual billing"
          aria-pressed={annual}
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
        {TIERS.map((tier) => {
          const price = annual ? tier.annual : tier.monthly;
          const period = annual ? '/yr' : '/mo';
          const busy = busyPlan === tier.key;
          return (
            <div
              key={tier.key}
              className={
                'flex h-full flex-col rounded-2xl border bg-white p-6 ' +
                (tier.highlight ? 'border-teal-600 shadow-lg ring-1 ring-teal-600' : 'border-slate-200')
              }
            >
              {tier.highlight && (
                <span className="mb-2 self-start rounded-full bg-teal-700 px-2.5 py-0.5 text-xs font-medium text-white">
                  Includes lead-status workflow
                </span>
              )}
              <h2 className="text-lg font-semibold text-slate-800">{tier.name}</h2>
              <p className="text-sm text-slate-500">{tier.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-slate-800">{price}</span>
                <span className="text-sm text-slate-500">{period}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">per facility{annual ? '' : ', billed monthly'}</p>

              <button
                type="button"
                onClick={() => beginBilling(tier.key)}
                disabled={busyPlan !== null || (isSignedIn && facilities.length === 0)}
                className={
                  'mt-5 rounded-md px-4 py-2.5 text-center text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ' +
                  (tier.highlight
                    ? 'bg-terracotta text-white hover:bg-terracotta-dark'
                    : 'border border-slate-300 text-slate-700 hover:border-teal-400')
                }
              >
                {busy ? 'Opening secure billing…' : selectedFacility?.billingManaged ? 'Manage billing' : tier.cta}
              </button>

              <ul className="mt-6 space-y-2 text-sm text-slate-600">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="mt-0.5 text-teal-600">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white p-5 sm:flex-row">
        <div>
          <h2 className="font-semibold text-slate-800">Need a custom arrangement?</h2>
          <p className="mt-1 text-sm text-slate-500">
            Talk with us about your organization&apos;s needs and the scope currently available. Any custom terms are
            documented before purchase.
          </p>
        </div>
        <a
          href="mailto:sales@clearbedrecovery.com?subject=Enterprise%20inquiry%20%E2%80%94%20Clear%20Bed%20Recovery"
          className="shrink-0 rounded-md border border-teal-700 px-5 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-700 hover:text-white"
        >
          Talk to us →
        </a>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Not ready to subscribe?{' '}
        <Link href="/get-started" className="font-medium text-teal-700 hover:underline">
          List your program for free →
        </Link>{' '}
        (claiming unlocks the complete public profile; no card required).
      </p>
      <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
        Every plan, including Free, includes two team seats. Larger teams require a documented custom arrangement;
        contact sales to discuss one. A plan never changes directory matching or access to contact details a seeker
        consented to share.
      </p>
    </div>
  );
}
