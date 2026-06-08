import 'server-only';

import crypto from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePlan } from '@/lib/facility/plan';

// Stripe webhook: keeps a facility's plan in sync with its subscription. Verifies
// the signature with STRIPE_WEBHOOK_SECRET (raw body + HMAC-SHA256, Stripe's scheme).

// Facility referral reward: when a referred facility starts a PAID plan, the referrer
// earns 50% off their next month, capped at 6 paid referrals (= 3 free months). Plan
// list prices in cents (mirrors /pricing) so we can size the 50% credit.
const REFERRAL_CAP = 6;
const MONTHLY_CENTS: Record<string, number> = { starter: 49900, growth: 99900, anchor: 199900 };

// Apply the reward as a Stripe customer-balance credit (negative amount = credit that
// auto-reduces the referrer's next invoice). Best-effort; returns whether it landed.
async function grantStripeCredit(customerId: string, amountCents: number, referralId: string): Promise<boolean> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return false;
  try {
    const body = new URLSearchParams();
    body.set('amount', String(-Math.abs(amountCents)));
    body.set('currency', 'usd');
    body.set('description', 'Clear Bed Recovery referral reward — 50% off next month');
    body.set('metadata[referral_id]', referralId);
    const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}/balance_transactions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return res.ok;
  } catch {
    return false;
  }
}

// On a paid conversion, match the checkout email to a pending referral and reward the
// referrer (capped). The referral is always marked converted; credit_applied records
// whether a discount was actually granted (false when capped or the referrer is free).
async function creditReferrer(
  supabase: ReturnType<typeof createAdminClient>,
  session: Record<string, unknown>,
  convertedFacilityId: string
): Promise<void> {
  const details = session.customer_details as { email?: string } | undefined;
  const email = String(details?.email || (session.customer_email as string) || '').toLowerCase().trim();
  if (!email) return;

  const { data: referral } = await supabase
    .from('facility_referrals')
    .select('id, referrer_facility_id')
    .eq('status', 'pending')
    .ilike('referred_email', email)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!referral) return;

  const { data: referrer } = await supabase
    .from('facilities')
    .select('id, plan, stripe_customer_id, referral_credits_earned')
    .eq('id', referral.referrer_facility_id)
    .maybeSingle();

  let applied = false;
  const earned = referrer?.referral_credits_earned ?? 0;
  if (referrer && earned < REFERRAL_CAP && referrer.stripe_customer_id) {
    const monthly = MONTHLY_CENTS[normalizePlan(referrer.plan)];
    if (monthly) {
      applied = await grantStripeCredit(referrer.stripe_customer_id, Math.round(monthly / 2), referral.id);
      if (applied) {
        await supabase
          .from('facilities')
          .update({ referral_credits_earned: earned + 1 })
          .eq('id', referrer.id);
      }
    }
  }

  await supabase
    .from('facility_referrals')
    .update({
      status: 'converted',
      converted_facility_id: convertedFacilityId,
      converted_at: new Date().toISOString(),
      credit_applied: applied,
    })
    .eq('id', referral.id);
}

function verify(raw: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

// "GOD MODE" = lifetime free membership. It's a Stripe coupon (100% off, forever)
// whose id is in STRIPE_LIFETIME_COUPON, surfaced through a one-use, samba-locked
// promotion code. When a completed checkout applied that coupon we mark the facility
// lifetime (Anchor, never downgraded). Returns false unless the coupon truly matches.
async function appliedLifetimeCoupon(sessionId: string): Promise<boolean> {
  const lifetime = process.env.STRIPE_LIFETIME_COUPON;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!lifetime || !key || !sessionId) return false;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=total_details.breakdown.discounts`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    const data = await res.json();
    const discounts: { discount?: { coupon?: string | { id?: string } } }[] =
      data?.total_details?.breakdown?.discounts ?? [];
    return discounts.some((d) => {
      const c = d.discount?.coupon;
      const id = typeof c === 'string' ? c : c?.id;
      return id === lifetime;
    });
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response('Stripe webhook not configured', { status: 503 });

  const raw = await request.text();
  if (!verify(raw, request.headers.get('stripe-signature'), secret)) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('Bad payload', { status: 400 });
  }

  const supabase = createAdminClient();
  const obj = event.data.object;
  const meta = (obj.metadata ?? {}) as Record<string, string>;

  if (event.type === 'checkout.session.completed') {
    const facilityId = (obj.client_reference_id as string) || meta.facility_id;
    const plan = meta.plan;
    if (facilityId && plan) {
      // GOD MODE: a lifetime coupon grants top-tier (Anchor) forever, flagged so no
      // later subscription event can downgrade it.
      const lifetime = await appliedLifetimeCoupon(obj.id as string);
      await supabase
        .from('facilities')
        .update({
          plan: lifetime ? 'anchor' : plan,
          plan_status: lifetime ? 'lifetime' : 'active',
          stripe_customer_id: (obj.customer as string) ?? null,
          stripe_subscription_id: (obj.subscription as string) ?? null,
        })
        .eq('id', facilityId);

      // A real paid signup (not a comped lifetime grant) can satisfy a referral.
      if (!lifetime && MONTHLY_CENTS[plan]) await creditReferrer(supabase, obj, facilityId);
    }
  } else if (event.type === 'customer.subscription.updated') {
    const status = obj.status as string; // active, past_due, canceled, ...
    const planStatus = status === 'active' || status === 'trialing' ? 'active' : status === 'past_due' ? 'past_due' : 'canceled';
    await supabase
      .from('facilities')
      .update({ plan_status: planStatus })
      .eq('stripe_subscription_id', obj.id as string)
      .neq('plan_status', 'lifetime'); // never touch a lifetime grant
  } else if (event.type === 'customer.subscription.deleted') {
    await supabase
      .from('facilities')
      .update({ plan: 'free', plan_status: 'canceled' })
      .eq('stripe_subscription_id', obj.id as string)
      .neq('plan_status', 'lifetime'); // lifetime survives cancellation
  }

  return Response.json({ received: true });
}
