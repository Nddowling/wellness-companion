// Single source of truth for the facility subscription tiers, what each unlocks,
// and the seat model. Mirrors /pricing (Free / Starter / Growth / Anchor).
//
// Paid tiers unlock only in-app analytics and workflow that the product currently
// enforces. They never affect matching, inclusion, or access to contact details a
// seeker explicitly chose to share with a program.

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

/**
 * Resolve the plan that may actually authorize paid tooling. Stored tier names are
 * inert unless billing is active or the account has an explicit lifetime grant.
 * Missing and legacy statuses fail closed to Free.
 */
export function effectivePlan(
  value: string | null | undefined,
  status: string | null | undefined,
): Plan {
  const plan = normalizePlan(value);
  if (plan === 'free') return 'free';
  const normalizedStatus = status?.trim().toLowerCase();
  return normalizedStatus === 'active' || normalizedStatus === 'lifetime' ? plan : 'free';
}

// Each gated feature → the minimum plan that unlocks it.
//
// New model: the FULL PROFILE is free. Claiming a facility (at no cost) unlocks every
// profile-content feature — description, photos, video, website, maps/directions, call
// button, and review responses. Paid tiers exist only for implemented in-app
// analytics and lead-status workflow, never for profile richness or a seeker's
// explicitly consented contact details.
export const FEATURE_MIN_PLAN = {
  // Profile content — free (unlocked by a free claim).
  photos: 'free',
  description: 'free',
  website: 'free',
  callIntake: 'free',
  respondReviews: 'free',
  video: 'free',
  // A seeker chose the program before consenting; payment cannot buy or block access.
  seekerContacts: 'free',
  // Implemented paid tooling.
  basicAnalytics: 'starter',
  followUpWorkflow: 'growth',
  fullAnalytics: 'anchor',
} as const satisfies Record<string, Plan>;

export type Feature = keyof typeof FEATURE_MIN_PLAN;

export function planAllows(plan: Plan, feature: Feature): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}

type FacilityClaimMarker = { status: string | null };

/** Only an admin-approved ownership claim unlocks the complete public profile. */
export function hasFullPublicProfile(
  claims: readonly FacilityClaimMarker[] | null | undefined,
): boolean {
  return claims?.some((claim) => claim.status === 'approved') ?? false;
}

/** The plan a feature requires (for "Upgrade to X" copy). */
export function requiredPlan(feature: Feature): Plan {
  return FEATURE_MIN_PLAN[feature];
}

/** A complete claimed profile gets the same gallery allowance on every plan. */
export function photoLimit(plan: Plan): number {
  void plan; // Keep the plan-shaped API while enforcing a payment-neutral limit.
  return 10;
}

// ── Seats ────────────────────────────────────────────────────────────────────
// Every tier (incl. Free) includes 2 seats: the Admin/owner + 1 BD/other person.
export const INCLUDED_SEATS = 2;

/** Extra seats exist only when a documented custom arrangement sets the stored allowance. */
export function seatLimit(extraSeats: number | null | undefined): number {
  return INCLUDED_SEATS + Math.max(0, extraSeats ?? 0);
}
