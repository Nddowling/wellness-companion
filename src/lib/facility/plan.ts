// Single source of truth for the facility subscription tiers, what each unlocks,
// and the seat model. Mirrors /pricing (Free / Starter / Growth / Anchor).
//
// EKRA guardrail: paid tiers unlock PROFILE richness, ANALYTICS, TOOLS, and
// clearly-labeled ad PLACEMENT only — NEVER preferential treatment in the
// patient-matching algorithm. Matching stays need-based for every tier.

export type Plan = 'free' | 'starter' | 'growth' | 'anchor';

export const PLAN_RANK: Record<Plan, number> = { free: 0, starter: 1, growth: 2, anchor: 3 };
export const PLAN_LABEL: Record<Plan, string> = {
  free: 'Free',
  starter: 'Starter',
  growth: 'Growth',
  anchor: 'Anchor',
};

/** Coerce any stored value (incl. legacy verified/premium or null) to a valid plan. */
export function normalizePlan(value: string | null | undefined): Plan {
  if (value === 'starter' || value === 'growth' || value === 'anchor') return value;
  // Legacy 3-tier names map onto the closest current paid tiers.
  if (value === 'verified') return 'starter';
  if (value === 'premium') return 'growth';
  return 'free';
}

// Each gated feature → the minimum plan that unlocks it. Derived from the tier
// sheet: Starter = the claimed profile (photos, about, website, reviews); Growth =
// growth tooling (analytics, follow-up, labeled placement, video); Anchor = the
// heavy data/integration features.
export const FEATURE_MIN_PLAN = {
  photos: 'starter',
  description: 'starter',
  website: 'starter',
  callIntake: 'starter',
  respondReviews: 'starter',
  basicAnalytics: 'growth',
  followUpWorkflow: 'growth',
  seekerContacts: 'growth', // see matched seekers' consented contact details in-app
  video: 'growth',
  featuredPlacement: 'growth',
  fullAnalytics: 'anchor',
  apiBedBoard: 'anchor',
  multiLocation: 'anchor',
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
  return plan === 'anchor' ? 30 : plan === 'growth' ? 15 : plan === 'starter' ? 8 : 0;
}

// ── Seats ────────────────────────────────────────────────────────────────────
// Every tier (incl. Free) includes 2 seats: the Admin/owner + 1 BD/other person.
// Additional seats are a flat $69.99/mo add-on, billed per seat regardless of tier.
export const INCLUDED_SEATS = 2;
export const EXTRA_SEAT_PRICE_MONTHLY = 69.99;

/** Total seats a facility may fill = the 2 included + any purchased extras. */
export function seatLimit(extraSeats: number | null | undefined): number {
  return INCLUDED_SEATS + Math.max(0, extraSeats ?? 0);
}
