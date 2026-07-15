export const BILLING_PLANS = ['starter', 'growth', 'anchor'] as const;
export const BILLING_CYCLES = ['monthly', 'annual'] as const;

export type BillingPlan = (typeof BILLING_PLANS)[number];
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export type FacilityMembership = {
  facility_id: string;
  role: string;
};

export type CheckoutAttemptIdentity = {
  requested_by: string;
  plan: string;
  billing_cycle: string;
};

export type ExpiringCheckoutAttempt = {
  expires_at: string;
};

export type FacilitySelection =
  | { ok: true; facilityId: string }
  | { ok: false; reason: 'facility_required' | 'facility_forbidden' | 'owner_required' };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_BILLING_STATUSES = new Set(['active', 'trialing', 'past_due', 'incomplete', 'paused']);

export function isBillingPlan(value: unknown): value is BillingPlan {
  return typeof value === 'string' && BILLING_PLANS.includes(value as BillingPlan);
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && BILLING_CYCLES.includes(value as BillingCycle);
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Resolve the facility whose billing may be changed. A user with more than one
 * facility membership must name one explicitly; every selected facility must
 * also have a fresh, server-read owner membership.
 */
export function selectBillingFacility(
  requestedFacilityId: unknown,
  memberships: readonly FacilityMembership[],
): FacilitySelection {
  if (requestedFacilityId == null || requestedFacilityId === '') {
    if (memberships.length !== 1) return { ok: false, reason: 'facility_required' };
    return memberships[0].role === 'owner'
      ? { ok: true, facilityId: memberships[0].facility_id }
      : { ok: false, reason: 'owner_required' };
  }

  if (!isUuid(requestedFacilityId)) return { ok: false, reason: 'facility_forbidden' };
  const membership = memberships.find((row) => row.facility_id === requestedFacilityId);
  if (!membership) return { ok: false, reason: 'facility_forbidden' };
  if (membership.role !== 'owner') return { ok: false, reason: 'owner_required' };
  return { ok: true, facilityId: membership.facility_id };
}

export function normalizeStripeSubscriptionStatus(status: string): string {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'incomplete':
      return 'incomplete';
    case 'paused':
      return 'paused';
    case 'unpaid':
    case 'incomplete_expired':
    case 'canceled':
      return 'canceled';
    default:
      return 'unrecognized_status';
  }
}

export function hasManagedBilling(facility: {
  plan: string | null;
  plan_status: string | null;
  stripe_subscription_id: string | null;
}): boolean {
  const status = facility.plan_status?.trim().toLowerCase() ?? '';
  if (status === 'lifetime') return true;
  if (facility.stripe_subscription_id && status !== 'canceled') return true;
  return isBillingPlan(facility.plan) && ACTIVE_BILLING_STATUSES.has(status);
}

export function checkoutAttemptMatches(
  attempt: CheckoutAttemptIdentity,
  requestedBy: string,
  plan: BillingPlan,
  cycle: BillingCycle,
): boolean {
  return (
    attempt.requested_by === requestedBy &&
    attempt.plan === plan &&
    attempt.billing_cycle === cycle
  );
}

export function checkoutAttemptExpired(attempt: ExpiringCheckoutAttempt, now = Date.now()): boolean {
  const expiresAt = new Date(attempt.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export function stripeKeyLivemode(key: string | null | undefined): boolean | null {
  const match = key?.trim().match(/^(?:sk|rk)_(live|test)_/);
  if (!match) return null;
  return match[1] === 'live';
}
