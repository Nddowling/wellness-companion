import 'server-only';

import { redirect } from 'next/navigation';

import { getRoles } from '@/lib/auth';

// Starts a Stripe Checkout subscription for a facility's paid plan. Flat-fee only
// (EKRA): the price is a fixed monthly/annual subscription, never per-referral.
// Env-gated — until STRIPE_SECRET_KEY + the plan price IDs are set, it sends the
// facility to /pricing?soon=1 instead of erroring.

const PRICE_ENV: Record<string, Record<string, string>> = {
  verified: { monthly: 'STRIPE_PRICE_VERIFIED', annual: 'STRIPE_PRICE_VERIFIED_ANNUAL' },
  premium: { monthly: 'STRIPE_PRICE_PREMIUM', annual: 'STRIPE_PRICE_PREMIUM_ANNUAL' },
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const plan = params.get('plan') ?? '';
  const cycle = params.get('cycle') === 'annual' ? 'annual' : 'monthly';
  if (!(plan in PRICE_ENV)) redirect('/pricing');

  const { user, facilityIds } = await getRoles();
  if (!user) redirect('/login');
  if (facilityIds.length === 0) redirect('/get-started'); // must manage a facility to subscribe
  const facilityId = facilityIds[0];

  const key = process.env.STRIPE_SECRET_KEY;
  const price = process.env[PRICE_ENV[plan][cycle]];
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://clearbedrecovery.com';
  if (!key || !price) redirect('/pricing?soon=1');

  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('line_items[0][price]', price!);
  body.set('line_items[0][quantity]', '1');
  body.set('client_reference_id', facilityId);
  body.set('success_url', `${site}/facility/${facilityId}?upgraded=1`);
  body.set('cancel_url', `${site}/pricing`);
  if (user.email) body.set('customer_email', user.email);
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
