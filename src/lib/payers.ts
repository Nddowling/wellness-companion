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

// A "browser-tab favicon" style brand mark: a small rounded tile in the carrier's
// brand color with a 1–2 char monogram. We render these instead of the carriers'
// real trademarked logo files — recognizable + on-brand, with zero copyright/
// hotlink risk, and it always renders (no missing-image states).
export type PayerBrand = {
  bg: string; // tile background (brand color)
  mark: string; // 1–2 char monogram shown in the tile
  fg?: string; // text color on the tile (defaults to white)
};

export type Payer = {
  slug: string;
  name: string;
  payerType: PayerType; // for matching against facility_payers.payer_type
  kind: PayerKind;
  common: boolean; // surfaced as a quick option in /match
  brand: PayerBrand; // micro-logo shown wherever the payer is an option
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
    brand: { bg: '#1f7a70', mark: 'Md' },
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
    brand: { bg: '#2b5d8b', mark: 'Mc' },
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
    brand: { bg: '#12395e', mark: '★' },
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
    brand: { bg: '#7d3f98', mark: 'a' },
    coverage: commercialCoverage('Aetna'),
    pricingNote: plan('Aetna'),
  },
  {
    slug: 'blue-cross-blue-shield',
    name: 'Blue Cross Blue Shield',
    payerType: 'commercial',
    kind: 'commercial',
    common: true,
    brand: { bg: '#0066b3', mark: 'B' },
    coverage: commercialCoverage('Blue Cross Blue Shield (BCBS)'),
    pricingNote: plan('Blue Cross Blue Shield'),
  },
  {
    slug: 'cigna',
    name: 'Cigna',
    payerType: 'commercial',
    kind: 'commercial',
    common: true,
    brand: { bg: '#00857a', mark: 'C' },
    coverage: commercialCoverage('Cigna'),
    pricingNote: plan('Cigna'),
  },
  {
    slug: 'unitedhealthcare',
    name: 'UnitedHealthcare',
    payerType: 'commercial',
    kind: 'commercial',
    common: true,
    brand: { bg: '#0056b8', mark: 'U' },
    coverage: commercialCoverage('UnitedHealthcare'),
    pricingNote: plan('UnitedHealthcare'),
  },
  {
    slug: 'humana',
    name: 'Humana',
    payerType: 'commercial',
    kind: 'commercial',
    common: true,
    brand: { bg: '#64a70b', mark: 'H' },
    coverage: commercialCoverage('Humana'),
    pricingNote: plan('Humana'),
  },
  {
    slug: 'kaiser-permanente',
    name: 'Kaiser Permanente',
    payerType: 'commercial',
    kind: 'commercial',
    common: true,
    brand: { bg: '#0170c8', mark: 'K' },
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
    brand: { bg: '#00457c', mark: 'A' },
    coverage: commercialCoverage('Anthem (Elevance Health)'),
    pricingNote: plan('Anthem'),
  },
  {
    slug: 'optum',
    name: 'Optum',
    payerType: 'commercial',
    kind: 'commercial',
    common: false,
    brand: { bg: '#ff612b', mark: 'O' },
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
    brand: { bg: '#003f72', mark: 'M' },
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
    brand: { bg: '#007a7a', mark: 'C' },
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
    brand: { bg: '#5c2d91', mark: 'A' },
    coverage: commercialCoverage('Ambetter'),
    pricingNote: plan('Ambetter'),
  },
  {
    slug: 'molina',
    name: 'Molina Healthcare',
    payerType: 'commercial',
    kind: 'commercial',
    common: false,
    brand: { bg: '#009cde', mark: 'M' },
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
    brand: { bg: '#475569', mark: '$' },
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

// The common commercial carriers (Aetna, BCBS, Cigna, UnitedHealthcare, Humana,
// Kaiser) — used to replace the generic "Commercial" option with named, logo'd
// carriers. They all match facility_payers.payer_type = 'commercial'.
export function commercialCarriers(): Payer[] {
  return PAYERS.filter((p) => p.kind === 'commercial' && p.common);
}

// Brand mark to show for a bare payer_type (the 5 matchable buckets). The 4 non-
// commercial types map to their single canonical payer; "commercial" gets a neutral
// umbrella mark (individual carrier logos are shown alongside it where space allows).
const PAYER_TYPE_BRAND: Record<PayerType, PayerBrand> = {
  medicaid: getPayer('medicaid')!.brand,
  medicare: getPayer('medicare')!.brand,
  tricare: getPayer('tricare')!.brand,
  self_pay: getPayer('self-pay')!.brand,
  commercial: { bg: '#2f6f6a', mark: '+' }, // ClearBed teal umbrella for "commercial"
};

export function payerTypeBrand(type: PayerType): PayerBrand {
  return PAYER_TYPE_BRAND[type];
}

// Match a free-text chip/label (from /match quick-replies or a model suggestion) to a
// payer's brand mark, tolerant of the common shorthands people actually type. Returns
// undefined for non-payer chips (e.g. "Not sure") so they render as plain text.
export function payerBrandForLabel(label: string): PayerBrand | undefined {
  const l = label.trim().toLowerCase();
  if (!l || l === 'not sure' || l === 'unsure') return undefined;
  const alias: Record<string, string> = {
    'blue cross': 'blue-cross-blue-shield',
    'blue cross blue shield': 'blue-cross-blue-shield',
    bcbs: 'blue-cross-blue-shield',
    united: 'unitedhealthcare',
    'united healthcare': 'unitedhealthcare',
    uhc: 'unitedhealthcare',
    kaiser: 'kaiser-permanente',
    'self pay': 'self-pay',
    'self-pay': 'self-pay',
    'out of pocket': 'self-pay',
    cash: 'self-pay',
    anthem: 'anthem',
    'elevance': 'anthem',
  };
  const slug = alias[l];
  if (slug) return getPayer(slug)?.brand;
  const exact = PAYERS.find((p) => p.name.toLowerCase() === l);
  if (exact) return exact.brand;
  // Loose match: the label contains a carrier's name ("I have Aetna"), or a longer
  // label is contained in a carrier name. The length guard stops short need-words
  // ("op", "mat") from colliding with carriers ("Optum", "Magellan").
  const partial = PAYERS.find(
    (p) => l.includes(p.slug.replace(/-/g, ' ')) || (l.length >= 4 && p.name.toLowerCase().includes(l)),
  );
  return partial?.brand;
}

// Quick-reply options for the /match coverage step (the common payers + an out).
export const COMMON_PAYER_CHIPS: string[] = [...commonPayers().map((p) => p.name), 'Not sure'];
