// Single source of truth for the facility subscription tiers, what each unlocks,
// and the seat model. Mirrors the pricing in /pricing and /for-providers.
//
// EKRA guardrail: paid tiers unlock PROFILE richness, ANALYTICS, TOOLS, and
// clearly-labeled ad PLACEMENT only — NEVER preferential treatment in the
// patient-matching algorithm. Matching stays need-based for every tier.

export type Plan = 'free' | 'verified' | 'premium';

export const PLAN_RANK: Record<Plan, number> = { free: 0, verified: 1, premium: 2 };
export const PLAN_LABEL: Record<Plan, string> = {
  free: 'Free',
  verified: 'Verified',
  premium: 'Premium',
};

/** Coerce any stored value (incl. legacy/null) to a valid plan. */
export function normalizePlan(value: string | null | undefined): Plan {
  return value === 'verified' || value === 'premium' ? value : 'free';
}

// Each gated feature → the minimum plan that unlocks it.
export const FEATURE_MIN_PLAN = {
  photos: 'verified',
  description: 'verified',
  respondReviews: 'verified',
  basicAnalytics: 'verified',
  website: 'premium',
  video: 'premium',
  fullAnalytics: 'premium',
  featuredPlacement: 'premium',
  multiLocation: 'premium',
} as const satisfies Record<string, Plan>;

export type Feature = keyof typeof FEATURE_MIN_PLAN;

export function planAllows(plan: Plan, feature: Feature): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}

/** The plan a feature requires (for "Upgrade to X" copy). */
export function requiredPlan(feature: Feature): Plan {
  return FEATURE_MIN_PLAN[feature];
}

/** How many photos a plan may publish (Free shows none). */
export function photoLimit(plan: Plan): number {
  return plan === 'premium' ? 20 : plan === 'verified' ? 8 : 0;
}

// ── Seats ────────────────────────────────────────────────────────────────────
// Every tier (incl. Free) includes 2 seats: the Admin/owner + 1 BD/other person.
// Additional seats are a flat add-on, billed per seat regardless of tier.
export const INCLUDED_SEATS = 2;
export const EXTRA_SEAT_PRICE_MONTHLY = 69.99;

/** Total seats a facility may fill = the 2 included + any purchased extras. */
export function seatLimit(extraSeats: number | null | undefined): number {
  return INCLUDED_SEATS + Math.max(0, extraSeats ?? 0);
}
