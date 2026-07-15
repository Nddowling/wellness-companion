// Shared domain vocabularies. Keep in sync with the CHECK constraints in
// supabase/project-a/migrations/01_core.sql.

export const LEVELS_OF_CARE = ['detox', 'residential', 'php', 'iop', 'op'] as const;
export type LevelOfCare = (typeof LEVELS_OF_CARE)[number];

// Residential is unambiguously overnight and bed-based. The imported `detox`
// category currently combines outpatient, residential, and hospital detoxification,
// so it MUST NOT be treated as a bed category until the setting is normalized.
// PHP/IOP/OP are outpatient and this schema does not assert current scheduling.
export const BED_BASED_LEVELS: readonly string[] = ['residential'];
export function isBedBased(level: string): boolean {
  return BED_BASED_LEVELS.includes(level);
}

export const LEVEL_LABELS: Record<LevelOfCare, string> = {
  detox: 'Detox services',
  residential: 'Residential',
  php: 'PHP (Partial Hospitalization)',
  iop: 'IOP (Intensive Outpatient)',
  op: 'Outpatient',
};

// Plain-language "what is this level of care" answers, used in landing-page FAQs.
export const LEVEL_BLURB: Record<LevelOfCare, string> = {
  detox:
    'Detoxification services support withdrawal management. Source records may describe outpatient, residential, or hospital inpatient detoxification, and this directory category does not yet distinguish those settings. Confirm whether a program provides overnight or 24-hour withdrawal management.',
  residential:
    'Residential (inpatient) rehab is live-in care with 24/7 support, typically lasting 30 to 90 days.',
  php: 'A partial hospitalization program (PHP) is intensive day treatment — several hours most days — while you live at home or in sober housing.',
  iop: 'An intensive outpatient program (IOP) offers structured therapy a few days a week, built around work, school, or family.',
  op: 'Outpatient treatment is regular counseling and medication management you attend while living at home.',
};

export const PAYER_TYPES = [
  'medicaid',
  'medicare',
  'commercial',
  'tricare',
  'self_pay',
] as const;
export type PayerType = (typeof PAYER_TYPES)[number];

export const PAYER_LABELS: Record<PayerType, string> = {
  medicaid: 'Medicaid',
  medicare: 'Medicare',
  commercial: 'Commercial',
  tricare: 'TRICARE',
  self_pay: 'Self-pay',
};

// Whether the seeker's insurance is currently active — the single most important
// signal for a facility. De-identified (a status, never a member ID).
export const COVERAGE_STATUSES = ['active', 'inactive', 'unsure'] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const COVERAGE_LABELS: Record<CoverageStatus, string> = {
  active: 'Active coverage',
  inactive: 'Inactive / lapsed coverage',
  unsure: 'Not sure',
};

// Freshness thresholds for the bed-availability moat (in days).
export const FRESHNESS = {
  greenMaxDays: 3,
  amberMaxDays: 7,
} as const;

// Permit only minor clock skew. A bad future timestamp must not remain "fresh"
// indefinitely or qualify a program for open-bed treatment.
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export function freshnessTone(lastUpdated: string | null): 'green' | 'amber' | 'red' {
  if (!lastUpdated) return 'red';
  const ageMs = Date.now() - new Date(lastUpdated).getTime();
  if (!Number.isFinite(ageMs) || ageMs < -MAX_FUTURE_SKEW_MS) return 'red';
  const ageDays = ageMs / 86_400_000;
  if (ageDays <= FRESHNESS.greenMaxDays) return 'green';
  if (ageDays <= FRESHNESS.amberMaxDays) return 'amber';
  return 'red';
}

/** ISO timestamp for N days ago — for "last 30 days" style query windows. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

// Bed availability is self-reported and can go stale fast. A family arriving to a
// phantom bed is a catastrophic trust failure — so past this window we STOP showing
// a live count and say so, everywhere availability renders.
export const AVAILABILITY_MAX_AGE_DAYS = 7;

export function availabilityAgeDays(lastUpdated: string | null): number | null {
  if (!lastUpdated) return null;
  const ageMs = Date.now() - new Date(lastUpdated).getTime();
  if (!Number.isFinite(ageMs) || ageMs < -MAX_FUTURE_SKEW_MS) return null;
  return Math.max(0, Math.floor(ageMs / 86_400_000));
}

/** True when availability is too old to display a live count (or was never set). */
export function availabilityStale(lastUpdated: string | null, maxDays = AVAILABILITY_MAX_AGE_DAYS): boolean {
  const age = availabilityAgeDays(lastUpdated);
  return age === null || age > maxDays;
}

/** Human "as of" label for a still-fresh availability timestamp. */
export function availabilityAsOf(lastUpdated: string | null): string {
  const age = availabilityAgeDays(lastUpdated);
  if (age === null) return 'not recently verified';
  if (age <= 0) return 'updated today';
  if (age === 1) return 'updated yesterday';
  return `updated ${age} days ago`;
}

/** Shown wherever a live bed count could otherwise read as a guarantee. */
export const AVAILABILITY_DISCLAIMER = 'Call to confirm current availability';

export type CapacityRow = {
  level_of_care: string;
  beds_available: number;
  last_updated: string;
  updated_by?: string | null;
};

// One-line bed indicator for a facility card. Sums beds across overnight (bed-based)
// levels and reads freshness from the freshest open level. Outpatient-only programs
// require a scheduling call; bed programs with no current openings/data say "call".
export function bedSummary(
  caps: CapacityRow[] | null | undefined,
  levels: string[] | null | undefined
): { label: string; tone: 'green' | 'amber' | 'red' } {
  const hasBedBasedLevel = (levels ?? []).some(isBedBased);
  if (!hasBedBasedLevel) return { label: 'Call for scheduling', tone: 'amber' };

  const openBeds = (caps ?? []).filter(
    (c) => isBedBased(c.level_of_care) && c.beds_available > 0 && !availabilityStale(c.last_updated)
  );
  if (openBeds.length) {
    const total = openBeds.reduce((s, c) => s + c.beds_available, 0);
    const rank = { green: 0, amber: 1, red: 2 } as const;
    const tone = openBeds.reduce<'green' | 'amber' | 'red'>(
      (best, c) => (rank[freshnessTone(c.last_updated)] < rank[best] ? freshnessTone(c.last_updated) : best),
      'red'
    );
    return { label: `${total} ${total === 1 ? 'bed' : 'beds'} recently reported`, tone };
  }
  return { label: 'Call to confirm beds', tone: 'red' };
}
