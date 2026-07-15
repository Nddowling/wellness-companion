import { freshnessTone, isBedBased } from '@/lib/constants';
import type { IntakeExtraction } from '@/lib/intake/prompt';

/**
 * Deterministic facility ranking for a de-identified intake. Pure functions over
 * Project A data — no DB, no network, no identity — so the scoring is unit-testable.
 *
 * Hard filters (a facility must clear all): LISTS the needed level of care and
 * accepts the person's payer type. Physical campus attributes never exclude a
 * program. A facility that offers the level but
 * has no confirmed beds can still be displayed ("call to confirm") — we never leave a
 * seeker with nothing — it just ranks below facilities with fresh, confirmed beds.
 * Soft ranking: bed availability (binary — beds or none) + capacity freshness (the
 * moat) + same-region. Raw bed count is only a tiebreaker. A generic payer category
 * never proves member-specific network status, so `in_network` does not affect rank.
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
  levels_of_care: string[];
  co_occurring: string | null;
  referral_contact: ReferralContact | null;
  carriers_named: string[];
  capacity: { level_of_care: string; beds_available: number; last_updated: string; updated_by?: string | null }[];
  payers: { payer_type: string }[];
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
  last_updated: string | null;
  freshness: 'green' | 'amber' | 'red';
  provider_reported: boolean;
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
  // Clear Bed's source corpus is an addiction-treatment directory. Do not route a
  // standalone mental-health request as though it were a supported clinical match.
  if (intake.concern_category === 'mental_health') return null;
  if (intake.concern_category === 'co_occurring') {
    const claim = facility.co_occurring?.toLowerCase() ?? '';
    if (!claim || /\b(no|none|not offered)\b/.test(claim) || !/(yes|co.?occurring|dual|integrated|both)/.test(claim)) {
      return null;
    }
  }

  if (!facility.levels_of_care.includes(intake.care_level_needed)) return null;
  const cap = facility.capacity.find((c) => c.level_of_care === intake.care_level_needed);

  const payer = facility.payers.find((p) => p.payer_type === intake.payer_type);
  if (!payer) return null; // can't be paid for with this coverage

  // A generic `commercial` row does not prove that a facility accepts a named
  // carrier. When the person volunteered a carrier, require the facility's
  // source-backed/profile-reported named-carrier field to contain it.
  if (
    intake.payer_carrier &&
    !facility.carriers_named.some((carrier) => carrier.toLowerCase() === intake.payer_carrier!.toLowerCase())
  ) {
    return null;
  }

  const bed_based = isBedBased(intake.care_level_needed);
  // Outpatient rows prove only that the program lists the level; this schema has
  // no current-scheduling/accepting flag. Keep the date for display context but do
  // not turn it into an availability claim. For bed levels, a positive reported
  // count plus freshness can support the stronger availability treatment.
  const freshness = bed_based && cap && cap.beds_available > 0
    ? freshnessTone(cap.last_updated)
    : 'red';
  const region_match = !!facility.zip3 && facility.zip3 === intake.region_zip3;

  const beds_available = bed_based ? Math.max(0, cap?.beds_available ?? 0) : 0;
  const has_availability = bed_based && beds_available > 0 && freshness !== 'red';

  // Proximity dominates: a same-region facility should outrank a distant one even
  // if the distant one has fresher beds. Freshness + availability then break ties
  // WITHIN a region (that's where the moat lives).
  const score =
    (region_match ? 12 : 0) +
    (bed_based ? FRESHNESS_POINTS[freshness] : 0) +
    (has_availability ? AVAILABILITY_POINTS : 0);

  return {
    id: facility.id,
    name: facility.name,
    city: facility.city,
    state: facility.state,
    referral_contact: facility.referral_contact,
    level: intake.care_level_needed,
    bed_based,
    beds_available,
    last_updated: bed_based ? cap?.last_updated ?? null : null,
    freshness,
    provider_reported: bed_based && !!cap?.updated_by,
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
    .sort((a, b) => {
      const aFreshBeds = a.bed_based && a.freshness !== 'red' ? a.beds_available : 0;
      const bFreshBeds = b.bed_based && b.freshness !== 'red' ? b.beds_available : 0;
      return b.score - a.score || bFreshBeds - aFreshBeds || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
