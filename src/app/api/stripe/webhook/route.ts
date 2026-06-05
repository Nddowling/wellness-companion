import 'server-only';

import crypto from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';

// Stripe webhook: keeps a facility's plan in sync with its subscription. Verifies
// the signature with STRIPE_WEBHOOK_SECRET (raw body + HMAC-SHA256, Stripe's scheme).

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
      await supabase
        .from('facilities')
        .update({
          plan,
          plan_status: 'active',
          stripe_customer_id: (obj.customer as string) ?? null,
          stripe_subscription_id: (obj.subscription as string) ?? null,
        })
        .eq('id', facilityId);
    }
  } else if (event.type === 'customer.subscription.updated') {
    const status = obj.status as string; // active, past_due, canceled, ...
    const planStatus = status === 'active' || status === 'trialing' ? 'active' : status === 'past_due' ? 'past_due' : 'canceled';
    await supabase
      .from('facilities')
      .update({ plan_status: planStatus })
      .eq('stripe_subscription_id', obj.id as string);
  } else if (event.type === 'customer.subscription.deleted') {
    await supabase
      .from('facilities')
      .update({ plan: 'free', plan_status: 'canceled' })
      .eq('stripe_subscription_id', obj.id as string);
  }

  return Response.json({ received: true });
}
