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
