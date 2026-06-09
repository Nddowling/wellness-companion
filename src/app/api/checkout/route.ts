import 'server-only';

import { redirect } from 'next/navigation';

import { getRoles } from '@/lib/auth';

// Starts a Stripe Checkout subscription for a facility's plan. Flat-fee only (EKRA):
// a fixed monthly/annual subscription, never per-referral. Env-gated — until the
// STRIPE_* vars are set, facilities go to /pricing?soon=1 instead of erroring.
//
// Checkout shows a coupon-code box (allow_promotion_codes). Codes are Stripe
// promotion codes (limits/restrictions configured in Stripe, see
// scripts/stripe-promo-setup.mjs):
//   FOUNDING50   — 50% off the first 12 months; capped at 10 redemptions
//   RECOVERYNOW  — 100% off, free access
//   GODMODE      — lifetime free Anchor; ONE redemption, locked to the "samba"
//                  customer. Its coupon id is STRIPE_LIFETIME_COUPON, which the
//                  webhook uses to flag the facility plan_status = 'lifetime'.

const PRICE_ENV: Record<string, Record<string, string>> = {
  starter: { monthly: 'STRIPE_PRICE_STARTER', annual: 'STRIPE_PRICE_STARTER_ANNUAL' },
  growth: { monthly: 'STRIPE_PRICE_GROWTH', annual: 'STRIPE_PRICE_GROWTH_ANNUAL' },
  anchor: { monthly: 'STRIPE_PRICE_ANCHOR', annual: 'STRIPE_PRICE_ANCHOR_ANNUAL' },
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const plan = params.get('plan') ?? '';
  const cycle = params.get('cycle') === 'annual' ? 'annual' : 'monthly';
  if (!(plan in PRICE_ENV)) redirect('/pricing');

  const { user, facilityIds } = await getRoles();
  // Preserve the chosen plan across auth: come back here and resume checkout after
  // sign-in, instead of dropping the provider on a context-free "Welcome back".
  const resume = `/api/checkout?plan=${plan}&cycle=${cycle}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(resume)}`);
  // Must manage a facility to subscribe — carry the plan so onboarding can show it.
  if (facilityIds.length === 0) redirect(`/get-started?plan=${plan}`);
  const facilityId = facilityIds[0];

  const key = process.env.STRIPE_SECRET_KEY;
  const price = process.env[PRICE_ENV[plan][cycle]];
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://clearbedrecovery.com';
  if (!key || !price) redirect('/pricing?soon=1');

  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('line_items[0][price]', price);
  body.set('line_items[0][quantity]', '1');
  body.set('client_reference_id', facilityId);
  body.set('success_url', `${site}/facility/${facilityId}?upgraded=1`);
  body.set('cancel_url', `${site}/pricing`);
  if (user.email) body.set('customer_email', user.email);
  body.set('allow_promotion_codes', 'true'); // shows the coupon-code box at checkout
  body.set('metadata[facility_id]', facilityId);
  body.set('metadata[plan]', plan);
  body.set('subscription_data[metadata][facility_id]', facilityId);
  body.set('subscription_data[metadata][plan]', plan);

  let sessionUrl: string | null = null;
  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    if (res.ok && data.url) sessionUrl = data.url as string;
    else console.error('[stripe] checkout error', data?.error ?? data);
  } catch (e) {
    console.error('[stripe] checkout request failed', e);
  }

  redirect(sessionUrl ?? '/pricing?soon=1');
}
