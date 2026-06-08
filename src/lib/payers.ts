import type { PayerType } from '@/lib/constants';

// Canonical payer reference for the /insurance/* pages and the /match coverage
// step. Mirrored into the Supabase `payers` table (migration 12). `payerType`
// maps a named carrier onto one of the 5 matchable types in facility_payers.
//
// ACCURACY NOTE (YMYL): per-plan insurance pricing is NOT public — it depends on
// the member's deductible/coinsurance/in-network status. So coverage copy is the
// general, parity-law-backed truth, and the only real numbers we show are the
// publicly-reported SELF-PAY ranges below, always framed as estimates to confirm.

export type PayerKind = 'public' | 'commercial' | 'military' | 'self';

export type Payer = {
  slug: string;
  name: string;
  payerType: PayerType; // for matching against facility_payers.payer_type
  kind: PayerKind;
  common: boolean; // surfaced as a quick option in /match
  coverage: string; // general, accurate coverage summary
  pricingNote: string; // what to say about cost on the page
};

const PARITY =
  'Under federal parity laws (MHPAEA) and the Affordable Care Act, most plans must cover medically necessary substance-use and mental-health treatment.';

const plan = (carrier: string): string =>
  `Your out-of-pocket cost depends entirely on your specific ${carrier} plan — deductible, coinsurance, and whether the program is in-network. It is not a fixed public price. The program can verify your exact benefits, usually in a single phone call.`;

const commercialCoverage = (carrier: string): string =>
  `${carrier} is one of the largest U.S. health insurers. ${PARITY} Most ${carrier} plans cover the full continuum of care — medical detox, residential, partial hospitalization (PHP), intensive outpatient (IOP), and standard outpatient — when it is medically necessary. Specifics vary by plan.`;

export const PAYERS: Payer[] = [
  {
    slug: 'medicaid',
    name: 'Medicaid',
    payerType: 'medicaid',
    kind: 'public',
    common: true,
    coverage:
      'Medicaid covers substance-use and mental-health treatment in every state — including detox, outpatient, and, in most states, residential care. The exact services covered and the programs that accept Medicaid vary by state.',
    pricingNote:
      'Medicaid treatment is typically low- or no-cost to the member. Coverage and any small copays vary by state plan.',
  },
  {
    slug: 'medicare',
    name: 'Medicare',
    payerType: 'medicare',
    kind: 'public',
    common: true,
    coverage:
      'Medicare covers medically necessary behavioral-health and substance-use treatment: inpatient care under Part A, outpatient care under Part B, and medications under Part D, for those who qualify.',
    pricingNote:
      'Costs follow standard Medicare cost-sharing (deductibles and coinsurance). A Medigap or Advantage plan can change what you pay.',
  },
  {
    slug: 'tricare',
    name: 'TRICARE',
    payerType: 'tricare',
    kind: 'military',
    common: true,
    coverage:
      'TRICARE covers substance-use disorder treatment for active-duty service members, retirees, and their families — including detox, residential, PHP, IOP, and outpatient care that is medically necessary.',
    pricingNote:
      'Cost-shares depend on your TRICARE plan and beneficiary category. Many services have low or no out-of-pocket cost at in-network programs.',
  },
  {
    slug: 'aetna',
    name: 'Aetna',
    payerType: 'commercial',
    kind: 'commercial',
    common: true,
    coverage: commercialCoverage('Aetna'),
    pricingNote: plan('Aetna'),
  },
  {
    slug: 'blue-cross-blue-shield',
    name: 'Blue Cross Blue Shield',
    payerType: 'commercial',
    kind: 'commercial',
    common: true,
    coverage: commercialCoverage('Blue Cross Blue Shield (BCBS)'),
    pricingNote: plan('Blue Cross Blue Shield'),
  },
  {
    slug: 'cigna',
    name: 'Cigna',
    payerType: 'commercial',
    kind: 'commercial',
    common: true,
    coverage: commercialCoverage('Cigna'),
    pricingNote: plan('Cigna'),
  },
  {
    slug: 'unitedhealthcare',
    name: 'UnitedHealthcare',
    payerType: 'commercial',
    kind: 'commercial',
    common: true,
    coverage: commercialCoverage('UnitedHealthcare'),
    pricingNote: plan('UnitedHealthcare'),
  },
  {
    slug: 'humana',
    name: 'Humana',
    payerType: 'commercial',
    kind: 'commercial',
    common: true,
    coverage: commercialCoverage('Humana'),
    pricingNote: plan('Humana'),
  },
  {
    slug: 'kaiser-permanente',
    name: 'Kaiser Permanente',
    payerType: 'commercial',
    kind: 'commercial',
    common: true,
    coverage:
      'Kaiser Permanente plans cover addiction and mental-health treatment, often delivered through Kaiser facilities and network providers. ' +
      PARITY +
      ' Coverage for substance-use treatment varies by plan and region.',
    pricingNote: plan('Kaiser Permanente'),
  },
  {
    slug: 'anthem',
    name: 'Anthem (Elevance Health)',
    payerType: 'commercial',
    kind: 'commercial',
    common: false,
    coverage: commercialCoverage('Anthem (Elevance Health)'),
    pricingNote: plan('Anthem'),
  },
  {
    slug: 'optum',
    name: 'Optum',
    payerType: 'commercial',
    kind: 'commercial',
    common: false,
    coverage:
      'Optum (the behavioral-health arm of UnitedHealth Group) administers mental-health and substance-use benefits for many plans. ' +
      PARITY,
    pricingNote: plan('Optum'),
  },
  {
    slug: 'magellan',
    name: 'Magellan Health',
    payerType: 'commercial',
    kind: 'commercial',
    common: false,
    coverage:
      'Magellan Health manages behavioral-health and substance-use benefits for many employers and plans. ' + PARITY,
    pricingNote: plan('Magellan'),
  },
  {
    slug: 'carelon',
    name: 'Carelon Behavioral Health',
    payerType: 'commercial',
    kind: 'commercial',
    common: false,
    coverage:
      'Carelon Behavioral Health (formerly Beacon Health Options) administers behavioral-health benefits for many plans. ' +
      PARITY,
    pricingNote: plan('Carelon'),
  },
  {
    slug: 'ambetter',
    name: 'Ambetter',
    payerType: 'commercial',
    kind: 'commercial',
    common: false,
    coverage: commercialCoverage('Ambetter'),
    pricingNote: plan('Ambetter'),
  },
  {
    slug: 'molina',
    name: 'Molina Healthcare',
    payerType: 'commercial',
    kind: 'commercial',
    common: false,
    coverage:
      'Molina Healthcare offers Medicaid, Marketplace, and Medicare plans that cover substance-use and mental-health treatment. ' +
      PARITY,
    pricingNote: plan('Molina'),
  },
  {
    slug: 'self-pay',
    name: 'Self-pay',
    payerType: 'self_pay',
    kind: 'self',
    common: true,
    coverage:
      'Paying out of pocket — without billing insurance. Many programs offer payment plans, sliding-scale fees, or scholarships, and publicly funded programs may be low- or no-cost. The ranges below are typical self-pay estimates.',
    pricingNote:
      'Self-pay cost depends on the program, length of stay, and amenities. See the typical ranges below — and ask programs about payment plans, sliding scale, and scholarships.',
  },
];

// Publicly-reported 2025 self-pay ranges by level of care. Estimates only — shown
// to give a ballpark, never as a quote. (Sources: industry cost guides.)
export const SELF_PAY_RANGES: { level: string; label: string; range: string }[] = [
  { level: 'detox', label: 'Medical detox', range: '$250–$800 / day (outpatient detox often $1,000–$1,500 total; medical inpatient detox $5,000+)' },
  { level: 'residential', label: 'Residential / inpatient', range: '$6,000–$30,000 for a 30-day program (≈$12,500 average); 60–90 days $30,000+' },
  { level: 'php', label: 'Partial hospitalization (PHP)', range: '$350–$450 / day' },
  { level: 'iop', label: 'Intensive outpatient (IOP)', range: '$250–$650 / day (≈$3,000–$10,000 per program)' },
  { level: 'op', label: 'Standard outpatient', range: '$2,000–$10,000 per program, by intensity' },
];

export function getPayer(slug: string): Payer | undefined {
  return PAYERS.find((p) => p.slug === slug.toLowerCase());
}

export function commonPayers(): Payer[] {
  return PAYERS.filter((p) => p.common);
}

// Quick-reply options for the /match coverage step (the common payers + an out).
export const COMMON_PAYER_CHIPS: string[] = [...commonPayers().map((p) => p.name), 'Not sure'];
