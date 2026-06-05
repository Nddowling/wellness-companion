import 'server-only';

import { redirect } from 'next/navigation';

import { getRoles } from '@/lib/auth';

// Starts a Stripe Checkout subscription for a facility's plan. Flat-fee only (EKRA):
// a fixed monthly/annual subscription, never per-referral. Env-gated — until the
// STRIPE_* vars are set, facilities go to /pricing?soon=1 instead of erroring.
//
// Founding offer: if STRIPE_LAUNCH_COUPON is set we auto-apply it (50% off, first
// 10 facilities). If it's exhausted/expired, we retry without it.

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
  if (!user) redirect('/login');
  if (facilityIds.length === 0) redirect('/get-started'); // must manage a facility to subscribe
  const facilityId = facilityIds[0];

  const key = process.env.STRIPE_SECRET_KEY;
  const price = process.env[PRICE_ENV[plan][cycle]];
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://clearbedrecovery.com';
  const coupon = process.env.STRIPE_LAUNCH_COUPON;
  if (!key || !price) redirect('/pricing?soon=1');

  async function createSession(applyCoupon: boolean): Promise<string | null> {
    const body = new URLSearchParams();
    body.set('mode', 'subscription');
    body.set('line_items[0][price]', price!);
    body.set('line_items[0][quantity]', '1');
    body.set('client_reference_id', facilityId);
    body.set('success_url', `${site}/facility/${facilityId}?upgraded=1`);
    body.set('cancel_url', `${site}/pricing`);
    if (user!.email) body.set('customer_email', user!.email);
    body.set('metadata[facility_id]', facilityId);
    body.set('metadata[plan]', plan);
    body.set('subscription_data[metadata][facility_id]', facilityId);
    body.set('subscription_data[metadata][plan]', plan);
    // Stripe forbids discounts + allow_promotion_codes together.
    if (applyCoupon && coupon) body.set('discounts[0][coupon]', coupon);
    else body.set('allow_promotion_codes', 'true');

    try {
      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data = await res.json();
      if (res.ok && data.url) return data.url as string;
      console.error('[stripe] checkout error', data?.error ?? data);
      return null;
    } catch (e) {
      console.error('[stripe] checkout request failed', e);
      return null;
    }
  }

  let sessionUrl = await createSession(!!coupon);
  if (!sessionUrl && coupon) sessionUrl = await createSession(false); // coupon exhausted → full price
  redirect(sessionUrl ?? '/pricing?soon=1');
}
