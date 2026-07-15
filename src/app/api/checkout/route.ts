import 'server-only';

import Stripe from 'stripe';

import {
  checkoutAttemptMatches,
  checkoutAttemptExpired,
  hasManagedBilling,
  isBillingCycle,
  isBillingPlan,
  isUuid,
  selectBillingFacility,
  type BillingCycle,
  type BillingPlan,
} from '@/lib/billing/guards';
import { getStripe, priceIdFor } from '@/lib/billing/stripe-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type CheckoutAttempt = {
  id: string;
  facility_id: string;
  requested_by: string;
  plan: string;
  billing_cycle: string;
  status: string;
  checkout_url: string | null;
  stripe_session_id: string | null;
  expires_at: string;
};

const SUPPORT_URL =
  'mailto:sales@clearbedrecovery.com?subject=Clear%20Bed%20Recovery%20billing%20support';

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

async function updateCheckoutAttempt(
  admin: ReturnType<typeof createAdminClient>,
  attemptId: string,
  values: Database['public']['Tables']['billing_checkout_attempts']['Update'],
): Promise<boolean> {
  const { data, error } = await admin
    .from('billing_checkout_attempts')
    .update(values)
    .eq('id', attemptId)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    console.error('[stripe] billing attempt persistence failed', {
      attemptId,
      code: error?.code ?? 'row_not_found',
    });
    return false;
  }
  return true;
}

function pricingResumeUrl(plan: BillingPlan, cycle: BillingCycle, facilityId: unknown): string {
  const params = new URLSearchParams({ plan, cycle });
  if (isUuid(facilityId)) params.set('facility', facilityId);
  return `/pricing?${params.toString()}`;
}

async function createPortalResponse(
  stripe: Stripe,
  facility: { id: string; plan_status: string | null; stripe_customer_id: string | null },
  returnUrl: string,
) {
  if (facility.plan_status?.trim().toLowerCase() === 'lifetime' || !facility.stripe_customer_id) {
    return json(
      {
        error: 'This facility already has managed billing. Contact us to change its plan.',
        action: 'contact',
        url: SUPPORT_URL,
      },
      409,
    );
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: facility.stripe_customer_id,
      return_url: returnUrl,
    });
    return json({ action: 'portal', url: portal.url });
  } catch (error) {
    console.error('[stripe] customer portal request failed', {
      type: error instanceof Error ? error.name : 'unknown',
    });
    return json(
      {
        error: 'Billing management is temporarily unavailable. Contact us for help.',
        action: 'contact',
        url: SUPPORT_URL,
      },
      502,
    );
  }
}

/**
 * Legacy GET links are read-only. Checkout creation is POST-only so a crawler,
 * prefetch, or copied URL cannot create a subscription session.
 */
export async function GET(request: Request) {
  const source = new URL(request.url).searchParams;
  const plan = source.get('plan');
  const cycle = source.get('cycle');
  const destination = new URL('/pricing', request.url);
  if (isBillingPlan(plan)) destination.searchParams.set('plan', plan);
  if (isBillingCycle(cycle)) destination.searchParams.set('cycle', cycle);
  const facilityId = source.get('facility');
  if (isUuid(facilityId)) destination.searchParams.set('facility', facilityId);
  return Response.redirect(destination, 303);
}

export async function POST(request: Request) {
  let input: { plan?: unknown; cycle?: unknown; facilityId?: unknown };
  try {
    input = (await request.json()) as typeof input;
  } catch {
    return json({ error: 'Invalid checkout request.' }, 400);
  }

  if (!isBillingPlan(input.plan) || !isBillingCycle(input.cycle)) {
    return json({ error: 'Choose a valid plan and billing cycle.' }, 400);
  }
  const plan = input.plan;
  const cycle = input.cycle;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = pricingResumeUrl(plan, cycle, input.facilityId);
    return json({ error: 'Sign in to continue.', loginUrl: `/login?next=${encodeURIComponent(next)}` }, 401);
  }

  // Re-read every membership on the server. User metadata and the browser's
  // facility selection never authorize billing changes.
  const { data: memberships, error: membershipError } = await supabase
    .from('facility_members')
    .select('facility_id, role')
    .eq('user_id', user.id);
  if (membershipError) return json({ error: 'Could not verify facility ownership.' }, 503);

  const selected = selectBillingFacility(input.facilityId, memberships ?? []);
  if (!selected.ok) {
    if (selected.reason === 'facility_required') {
      return json({ error: 'Select the facility whose billing you want to manage.' }, 400);
    }
    return json(
      {
        error:
          selected.reason === 'owner_required'
            ? 'Only a verified facility owner can manage billing.'
            : 'You do not have access to manage billing for that facility.',
      },
      403,
    );
  }

  const { data: facility, error: facilityError } = await supabase
    .from('facilities')
    .select('id, plan, plan_status, stripe_customer_id, stripe_subscription_id')
    .eq('id', selected.facilityId)
    .maybeSingle();
  if (facilityError || !facility) return json({ error: 'Facility not found.' }, 404);

  const stripe = getStripe();
  if (!stripe) return json({ error: 'Billing is not configured yet.', action: 'contact', url: SUPPORT_URL }, 503);

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(request.url).origin;
  if (hasManagedBilling(facility)) {
    return createPortalResponse(stripe, facility, `${site}/facility/${facility.id}`);
  }

  const price = priceIdFor(plan, cycle);
  if (!price) return json({ error: 'That billing option is not configured yet.' }, 503);

  const admin = createAdminClient();
  const now = Date.now();

  const findAttempt = async () =>
    admin
      .from('billing_checkout_attempts')
      .select(
        'id, facility_id, requested_by, plan, billing_cycle, status, checkout_url, stripe_session_id, expires_at',
      )
      .eq('facility_id', facility.id)
      .in('status', ['pending', 'open'])
      .maybeSingle();

  let { data: attempt, error: attemptReadError } = await findAttempt();
  if (attemptReadError) return json({ error: 'Secure checkout is temporarily unavailable.' }, 503);

  if (!attempt) {
    const expiresAt = new Date(now + 2 * 60 * 60_000).toISOString();
    const inserted = await admin
      .from('billing_checkout_attempts')
      .insert({
        facility_id: facility.id,
        requested_by: user.id,
        plan,
        billing_cycle: cycle,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select(
        'id, facility_id, requested_by, plan, billing_cycle, status, checkout_url, stripe_session_id, expires_at',
      )
      .single();
    if (inserted.error?.code === '23505') {
      ({ data: attempt, error: attemptReadError } = await findAttempt());
    } else {
      attempt = inserted.data;
      attemptReadError = inserted.error;
    }
    if (attemptReadError || !attempt) {
      return json({ error: 'Secure checkout is temporarily unavailable.' }, 503);
    }
  }

  const currentAttempt = attempt as CheckoutAttempt;
  if (!checkoutAttemptMatches(currentAttempt, user.id, plan, cycle)) {
    return json(
      { error: 'A checkout is already in progress for this facility. Finish it or try again later.' },
      409,
    );
  }
  if (currentAttempt.status === 'open' && currentAttempt.checkout_url) {
    if (checkoutAttemptExpired(currentAttempt, now) && currentAttempt.stripe_session_id) {
      try {
        const oldSession = await stripe.checkout.sessions.retrieve(currentAttempt.stripe_session_id);
        if (oldSession.status === 'expired') {
          const persisted = await updateCheckoutAttempt(admin, currentAttempt.id, {
            status: 'expired',
            updated_at: new Date().toISOString(),
          });
          if (!persisted) return json({ error: 'Could not record the expired checkout.' }, 503);
          return json({ error: 'The previous checkout expired. Select the plan again to continue.' }, 409);
        }
        if (oldSession.status === 'complete') {
          return json({ error: 'Your payment is complete and billing access is still being synchronized.' }, 409);
        }
      } catch (error) {
        console.error('[stripe] could not verify prior checkout status', {
          type: error instanceof Error ? error.name : 'unknown',
        });
        return json({ error: 'A prior checkout needs billing support before another can start.' }, 409);
      }
    }
    return json({ action: 'checkout', url: currentAttempt.checkout_url, reused: true });
  }

  const metadata = {
    facility_id: facility.id,
    plan,
    checkout_attempt_id: currentAttempt.id,
  };
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    client_reference_id: facility.id,
    success_url: `${site}/facility/${facility.id}?upgraded=1`,
    cancel_url: `${site}${pricingResumeUrl(plan, cycle, facility.id)}`,
    expires_at: Math.floor(new Date(currentAttempt.expires_at).getTime() / 1000),
    metadata,
    subscription_data: { metadata },
  };
  if (facility.stripe_customer_id) params.customer = facility.stripe_customer_id;

  try {
    const session = await stripe.checkout.sessions.create(params, {
      idempotencyKey: `clearbed-checkout-${currentAttempt.id}`,
    });
    if (session.status === 'complete') {
      const persisted = await updateCheckoutAttempt(admin, currentAttempt.id, {
        status: 'open',
        stripe_session_id: session.id,
        checkout_url: session.url,
        updated_at: new Date().toISOString(),
      });
      if (!persisted) return json({ error: 'Could not record the completed checkout.' }, 503);
      return json({ error: 'Your payment is complete and billing access is still being synchronized.' }, 409);
    }
    if (session.status === 'expired') {
      const persisted = await updateCheckoutAttempt(admin, currentAttempt.id, {
        status: 'expired',
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      });
      if (!persisted) return json({ error: 'Could not record the expired checkout.' }, 503);
      return json({ error: 'The previous checkout expired. Select the plan again to continue.' }, 409);
    }
    if (!session.url) {
      const persisted = await updateCheckoutAttempt(admin, currentAttempt.id, {
        status: 'failed',
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      });
      if (!persisted) return json({ error: 'Could not finalize the secure checkout session.' }, 503);
      return json({ error: 'Stripe did not return a checkout URL.' }, 502);
    }

    const persisted = await updateCheckoutAttempt(admin, currentAttempt.id, {
      status: 'open',
      stripe_session_id: session.id,
      checkout_url: session.url,
      updated_at: new Date().toISOString(),
    });
    if (!persisted) return json({ error: 'Could not finalize the secure checkout session.' }, 503);
    return json({ action: 'checkout', url: session.url });
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.param === 'expires_at'
    ) {
      // Stripe requires expires_at to remain inside its accepted future window.
      // A persisted pending attempt can enter that window before its timestamp
      // has literally passed; no Session was created, so it is safe to retire.
      const persisted = await updateCheckoutAttempt(admin, currentAttempt.id, {
        status: 'expired',
        updated_at: new Date().toISOString(),
      });
      if (!persisted) return json({ error: 'Could not record the expired checkout.' }, 503);
      return json({ error: 'The previous checkout expired. Select the plan again to continue.' }, 409);
    }
    // Keep the pending row. A retry uses the same persisted attempt ID and Stripe
    // idempotency key, so an uncertain network failure cannot create a second Session.
    console.error('[stripe] checkout session request failed', {
      type: error instanceof Error ? error.name : 'unknown',
    });
    return json({ error: 'Secure checkout is temporarily unavailable. Please try again.' }, 502);
  }
}
