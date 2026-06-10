// Shared domain vocabularies. Keep in sync with the CHECK constraints in
// supabase/project-a/migrations/01_core.sql.

export const LEVELS_OF_CARE = ['detox', 'residential', 'php', 'iop', 'op'] as const;
export type LevelOfCare = (typeof LEVELS_OF_CARE)[number];

// Bed-based levels are overnight (beds matter). PHP/IOP/OP are outpatient — there
// are no beds, so availability is "accepting clients," not a bed count.
export const BED_BASED_LEVELS: readonly string[] = ['detox', 'residential'];
export function isBedBased(level: string): boolean {
  return BED_BASED_LEVELS.includes(level);
}

export const LEVEL_LABELS: Record<LevelOfCare, string> = {
  detox: 'Detox',
  residential: 'Residential',
  php: 'PHP (Partial Hospitalization)',
  iop: 'IOP (Intensive Outpatient)',
  op: 'Outpatient',
};

// Plain-language "what is this level of care" answers, used in landing-page FAQs.
export const LEVEL_BLURB: Record<LevelOfCare, string> = {
  detox:
    'Medical detox is short-term, supervised care to safely manage withdrawal — usually the first step before ongoing treatment.',
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

export function freshnessTone(lastUpdated: string | null): 'green' | 'amber' | 'red' {
  if (!lastUpdated) return 'red';
  const ageDays = (Date.now() - new Date(lastUpdated).getTime()) / 86_400_000;
  if (ageDays <= FRESHNESS.greenMaxDays) return 'green';
  if (ageDays <= FRESHNESS.amberMaxDays) return 'amber';
  return 'red';
}

/** ISO timestamp for N days ago — for "last 30 days" style query windows. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export type CapacityRow = { level_of_care: string; beds_available: number; last_updated: string };

// One-line bed indicator for a facility card. Sums beds across overnight (bed-based)
// levels and reads freshness from the freshest open level. Outpatient-only programs
// show "Accepting clients"; bed programs with no current openings/data say "call".
export function bedSummary(
  caps: CapacityRow[] | null | undefined,
  levels: string[] | null | undefined
): { label: string; tone: 'green' | 'amber' | 'red' } {
  const openBeds = (caps ?? []).filter((c) => isBedBased(c.level_of_care) && c.beds_available > 0);
  if (openBeds.length) {
    const total = openBeds.reduce((s, c) => s + c.beds_available, 0);
    const rank = { green: 0, amber: 1, red: 2 } as const;
    const tone = openBeds.reduce<'green' | 'amber' | 'red'>(
      (best, c) => (rank[freshnessTone(c.last_updated)] < rank[best] ? freshnessTone(c.last_updated) : best),
      'red'
    );
    return { label: `${total} ${total === 1 ? 'bed' : 'beds'} open`, tone };
  }
  if ((levels ?? []).some(isBedBased)) return { label: 'Call to confirm beds', tone: 'red' };
  return { label: 'Accepting clients', tone: 'green' };
}
