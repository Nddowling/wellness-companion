import 'server-only';

import Stripe from 'stripe';

import type { BillingCycle, BillingPlan } from '@/lib/billing/guards';

const PRICE_ENV: Record<BillingPlan, Record<BillingCycle, string>> = {
  starter: { monthly: 'STRIPE_PRICE_STARTER', annual: 'STRIPE_PRICE_STARTER_ANNUAL' },
  growth: { monthly: 'STRIPE_PRICE_GROWTH', annual: 'STRIPE_PRICE_GROWTH_ANNUAL' },
  anchor: { monthly: 'STRIPE_PRICE_ANCHOR', annual: 'STRIPE_PRICE_ANCHOR_ANNUAL' },
};

let stripeClient: Stripe | null = null;

/** Build-safe lazy Stripe SDK initialization. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      maxNetworkRetries: 2,
      timeout: 20_000,
      appInfo: { name: 'Clear Bed Recovery' },
    });
  }
  return stripeClient;
}

export function priceIdFor(plan: BillingPlan, cycle: BillingCycle): string | null {
  return process.env[PRICE_ENV[plan][cycle]]?.trim() || null;
}

export function planForPriceId(priceId: string | null | undefined): BillingPlan | null {
  if (!priceId) return null;
  for (const plan of Object.keys(PRICE_ENV) as BillingPlan[]) {
    for (const cycle of Object.keys(PRICE_ENV[plan]) as BillingCycle[]) {
      if (process.env[PRICE_ENV[plan][cycle]] === priceId) return plan;
    }
  }
  return null;
}
