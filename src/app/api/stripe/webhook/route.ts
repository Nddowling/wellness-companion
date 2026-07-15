import 'server-only';

import type Stripe from 'stripe';

import { isUuid, normalizeStripeSubscriptionStatus, stripeKeyLivemode } from '@/lib/billing/guards';
import { getStripe, planForPriceId } from '@/lib/billing/stripe-server';
import { invalidateFacilityPublic } from '@/lib/facility/invalidate';
import { createAdminClient } from '@/lib/supabase/admin';
import { postgresNullableText } from '@/lib/supabase/rpc';

const WEBHOOK_TOLERANCE_SECONDS = 300;
const HANDLED_EVENTS = new Set<Stripe.Event.Type>([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

function objectId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function metadataUuid(value: string | null | undefined): string | null {
  return isUuid(value) ? value : null;
}

function verifyEvent(stripe: Stripe, raw: string, signature: string): Stripe.Event | null {
  // Stripe can emit multiple v1 signatures while a signing secret is rolling.
  // constructEvent checks every signature and enforces timestamp tolerance. An
  // optional previous secret lets deployments overlap a deliberate rotation.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS]
    .map((secret) => secret?.trim())
    .filter((secret): secret is string => !!secret);
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(raw, signature, secret, WEBHOOK_TOLERANCE_SECONDS);
    } catch {
      // Try the other active signing secret without logging the payload/header.
    }
  }
  return null;
}

async function retrieveCurrentSubscription(stripe: Stripe, subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const expectedLivemode = stripeKeyLivemode(process.env.STRIPE_SECRET_KEY);
  if (!stripe || !hasWebhookSecret || expectedLivemode === null) {
    return new Response('Stripe webhook not configured', { status: 503 });
  }

  // This must remain the exact raw body. Parsing before constructEvent breaks the
  // signature guarantee and must never be reintroduced.
  const raw = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Invalid signature', { status: 400 });
  const event = verifyEvent(stripe, raw, signature);
  if (!event) return new Response('Invalid signature', { status: 400 });
  if (event.livemode !== expectedLivemode) {
    return new Response('Stripe mode mismatch', { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) return Response.json({ received: true });

  let objectIdValue: string;
  let subscriptionId: string | null = null;
  let customerId: string | null = null;
  let facilityId: string | null = null;
  let checkoutAttemptId: string | null = null;
  let plan: string | null = null;
  let planStatus = 'incomplete';

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      objectIdValue = session.id;
      subscriptionId = objectId(session.subscription);
      customerId = objectId(session.customer);
      facilityId = metadataUuid(session.metadata?.facility_id) ?? metadataUuid(session.client_reference_id);
      checkoutAttemptId = metadataUuid(session.metadata?.checkout_attempt_id);
      plan = null;

      if (subscriptionId) {
        const current = await retrieveCurrentSubscription(stripe, subscriptionId);
        customerId = objectId(current.customer) ?? customerId;
        plan = planForPriceId(current.items.data[0]?.price.id);
        planStatus = normalizeStripeSubscriptionStatus(current.status);
      }
    } else {
      const delivered = event.data.object as Stripe.Subscription;
      objectIdValue = delivered.id;
      const current =
        event.type === 'customer.subscription.updated'
          ? await retrieveCurrentSubscription(stripe, delivered.id)
          : delivered;
      subscriptionId = current.id;
      customerId = objectId(current.customer);
      facilityId = metadataUuid(current.metadata?.facility_id);
      checkoutAttemptId = metadataUuid(current.metadata?.checkout_attempt_id);
      plan = planForPriceId(current.items.data[0]?.price.id);
      planStatus =
        event.type === 'customer.subscription.deleted'
          ? 'canceled'
          : normalizeStripeSubscriptionStatus(current.status);
    }
  } catch (error) {
    // Stripe recommends retrieving the current object when event order matters.
    // A transient retrieval failure returns non-2xx so Stripe safely retries.
    console.error('[stripe] could not retrieve current subscription state', {
      eventId: event.id,
      type: error instanceof Error ? error.name : 'unknown',
    });
    return Response.json({ error: 'Could not verify current subscription state' }, { status: 500 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('apply_stripe_billing_event', {
    p_api_version: postgresNullableText(event.api_version),
    p_checkout_attempt_id: postgresNullableText(checkoutAttemptId),
    p_customer_id: postgresNullableText(customerId),
    p_event_created: event.created,
    p_event_id: event.id,
    p_event_type: event.type,
    p_facility_id: postgresNullableText(facilityId),
    p_livemode: event.livemode,
    p_object_id: objectIdValue,
    p_plan: postgresNullableText(plan),
    p_plan_status: planStatus,
    p_subscription_id: postgresNullableText(subscriptionId),
  });
  if (error) {
    console.error('[stripe] durable webhook transaction failed', {
      eventId: event.id,
      code: error.code,
    });
    return Response.json({ error: 'Could not apply billing event' }, { status: 500 });
  }

  const result = data?.[0];
  if (
    result?.changed_facility_id &&
    (result.result === 'applied' || result.result === 'duplicate')
  ) {
    try {
      await invalidateFacilityPublic(result.changed_facility_id);
    } catch (error) {
      // The billing transaction is already durable. Return a controlled 500 so
      // Stripe retries; duplicate events return the stored facility ID and can
      // safely repeat this cache purge without applying entitlement twice.
      console.error('[stripe] post-billing cache invalidation failed', {
        eventId: event.id,
        type: error instanceof Error ? error.name : 'unknown',
      });
      return Response.json({ error: 'Could not refresh billing caches' }, { status: 500 });
    }
  }
  return Response.json({ received: true, result: result?.result ?? 'ignored' });
}
