import { freshnessTone, isBedBased } from '@/lib/constants';
import type { IntakeExtraction } from '@/lib/intake/prompt';

/**
 * Deterministic facility ranking for a de-identified intake. Pure functions over
 * Project A data — no DB, no network, no identity — so the scoring is unit-testable.
 *
 * Hard filters (a facility must clear all): not gated, OFFERS the needed level of
 * care, and accepts the person's payer type. A facility that offers the level but
 * has no confirmed beds is still recommended ("call to confirm") — we never leave a
 * seeker with nothing — it just ranks below facilities with fresh, confirmed beds.
 * Soft ranking: bed availability (binary — beds or none) + capacity freshness (the
 * moat) + same-region + in-network. Raw bed count is only a tiebreaker.
 */

export type ReferralContact = { name?: string; email?: string; phone?: string };

export type FacilityForMatch = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  zip3: string | null;
  is_gated: boolean;
  is_faith_based: boolean;
  referral_contact: ReferralContact | null;
  capacity: { level_of_care: string; beds_available: number; last_updated: string }[];
  payers: { payer_type: string; in_network: boolean }[];
};

export type RankedFacility = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  referral_contact: ReferralContact | null;
  level: string; // the matched level of care
  bed_based: boolean; // false for php/iop/op (outpatient — no beds)
  beds_available: number;
  last_updated: string;
  freshness: 'green' | 'amber' | 'red';
  in_network: boolean;
  region_match: boolean;
  score: number;
};

const FRESHNESS_POINTS = { green: 3, amber: 1, red: 0 } as const;

// Availability is binary — beds or no beds — not a per-bed count, so a facility
// with one open bed isn't out-ranked by a bigger one purely on headcount. The raw
// bed count only breaks ties in rankFacilities().
const AVAILABILITY_POINTS = 3;

/** Score a single facility for an intake, or null if it fails a hard filter. */
export function scoreFacility(
  intake: IntakeExtraction,
  facility: FacilityForMatch
): RankedFacility | null {
  if (facility.is_gated) return null; // gated facilities are not open-matched

  const cap = facility.capacity.find((c) => c.level_of_care === intake.care_level_needed);
  if (!cap) return null; // doesn't offer the needed level of care at all

  const payer = facility.payers.find((p) => p.payer_type === intake.payer_type);
  if (!payer) return null; // can't be paid for with this coverage

  const bed_based = isBedBased(intake.care_level_needed);
  // Outpatient (php/iop/op) has no beds — treat as available. For bed levels, no
  // confirmed beds means availability is unknown → "call to confirm" (red).
  const freshness = !bed_based
    ? freshnessTone(cap.last_updated)
    : cap.beds_available > 0
      ? freshnessTone(cap.last_updated)
      : 'red';
  const region_match = !!facility.zip3 && facility.zip3 === intake.region_zip3;

  // Outpatient is always "accepting"; for bed levels, any open bed counts. Flat —
  // one bed and ten beds score the same here (bed count is only a tiebreaker).
  const has_availability = !bed_based || cap.beds_available > 0;

  // Proximity dominates: a same-region facility should outrank a distant one even
  // if the distant one has fresher beds. Freshness + availability then break ties
  // WITHIN a region (that's where the moat lives).
  const score =
    (region_match ? 12 : 0) +
    FRESHNESS_POINTS[freshness] +
    (has_availability ? AVAILABILITY_POINTS : 0) +
    (payer.in_network ? 2 : 0.5);

  return {
    id: facility.id,
    name: facility.name,
    city: facility.city,
    state: facility.state,
    referral_contact: facility.referral_contact,
    level: intake.care_level_needed,
    bed_based,
    beds_available: cap.beds_available,
    last_updated: cap.last_updated,
    freshness,
    in_network: payer.in_network,
    region_match,
    score,
  };
}

/** Rank facilities for an intake, best first. Returns at most `limit` (default 3). */
export function rankFacilities(
  intake: IntakeExtraction,
  facilities: FacilityForMatch[],
  limit = 3
): RankedFacility[] {
  return facilities
    .map((f) => scoreFacility(intake, f))
    .filter((r): r is RankedFacility => r !== null)
    .sort((a, b) => b.score - a.score || b.beds_available - a.beds_available)
    .slice(0, limit);
}
