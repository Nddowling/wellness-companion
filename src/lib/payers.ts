import type { PayerType } from '@/lib/constants';

// Canonical payer reference for the /insurance/* pages and the /match coverage
// step. Mirrored into the Supabase `payers` table (migration 12). `payerType`
// maps a named carrier onto one of the 5 matchable types in facility_payers.
//
// ACCURACY NOTE (YMYL): per-plan insurance pricing is NOT public — it depends on
// the member's deductible/coinsurance/in-network status. Coverage copy therefore
// stays general and directs people to confirm with both the plan and the program.

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

const PLAN_VARIATION =
  'Many plans include behavioral-health benefits, but covered services, medical-necessity criteria, authorization, exclusions, network rules, and member cost vary.';

const plan = (carrier: string): string =>
  `Your out-of-pocket cost depends on your specific ${carrier} plan — including deductible, copay or coinsurance, authorization, exclusions, and network. A benefits check can help estimate coverage but is not a guarantee of payment; confirm with both the plan and program.`;

const commercialCoverage = (carrier: string): string =>
  `${carrier} offers plans that may include substance-use and mental-health benefits. ${PLAN_VARIATION} Do not assume that every level of care or program is covered by a particular plan.`;

export const PAYERS: Payer[] = [
  {
    slug: 'medicaid',
    name: 'Medicaid',
    payerType: 'medicaid',
    kind: 'public',
    common: true,
    brand: { bg: '#1f7a70', mark: 'Md' },
    coverage:
      'State Medicaid programs may cover substance-use and mental-health services. Benefits, managed-care networks, authorization rules, covered levels of care, and participating programs vary by state and plan.',
    pricingNote:
      'Member cost and coverage vary by state program, managed-care plan, eligibility, service, and provider. Confirm before admission.',
  },
  {
    slug: 'medicare',
    name: 'Medicare',
    payerType: 'medicare',
    kind: 'public',
    common: true,
    brand: { bg: '#2b5d8b', mark: 'Mc' },
    coverage:
      'Medicare may cover eligible inpatient, outpatient, and medication services under different parts of the program. Coverage depends on the service, provider, medical-necessity rules, and the person’s plan.',
    pricingNote:
      'Member cost depends on the service, setting, provider participation, other coverage, and whether the person uses Original Medicare or a Medicare Advantage plan. Confirm before admission.',
  },
  {
    slug: 'tricare',
    name: 'TRICARE',
    payerType: 'tricare',
    kind: 'military',
    common: true,
    brand: { bg: '#12395e', mark: '★' },
    coverage:
      'TRICARE plans may cover eligible substance-use disorder services. Covered levels, authorization, referral rules, network, and member cost depend on the plan and beneficiary category.',
    pricingNote:
      'Cost-shares depend on the TRICARE plan, beneficiary category, service, authorization, and network. Confirm with TRICARE and the program.',
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
      'Kaiser Permanente offers plans that may include addiction and mental-health treatment, often delivered through Kaiser facilities and network providers. ' +
      PLAN_VARIATION +
      ' Access to outside programs varies by plan and region.',
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
      'Optum (the behavioral-health arm of UnitedHealth Group) administers mental-health and substance-use benefits for some plans. ' +
      PLAN_VARIATION,
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
      'Magellan Health manages behavioral-health and substance-use benefits for some employers and plans. ' + PLAN_VARIATION,
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
      'Carelon Behavioral Health (formerly Beacon Health Options) administers behavioral-health benefits for some plans. ' +
      PLAN_VARIATION,
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
      'Molina Healthcare offers Medicaid, Marketplace, and Medicare plans that may include substance-use and mental-health benefits. ' +
      PLAN_VARIATION,
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
      'Paying out of pocket means the program does not bill an insurance plan for the service. Some programs may offer payment plans, sliding-scale fees, scholarships, or publicly funded options; availability and eligibility vary.',
    pricingNote:
      'Ask the program for a written estimate, what services and time period it covers, its refund policy, and whether any payment assistance is available.',
  },
];

/** Named commercial carriers a facility can list on its profile (drives the editor). */
export const COMMERCIAL_CARRIERS = PAYERS.filter((p) => p.kind === 'commercial');
export const COMMERCIAL_CARRIER_NAMES = COMMERCIAL_CARRIERS.map((p) => p.name);

/** Keep provider-entered carrier names on the canonical, publicly explained list. */
export function normalizeCommercialCarrierNames(values: readonly string[]): string[] {
  const allowed = new Set(COMMERCIAL_CARRIER_NAMES);
  return [...new Set(values.map((value) => value.trim()).filter((value) => allowed.has(value)))];
}

/**
 * A provider checkbox is a program-listed payment option. It is not evidence that
 * the program is in network for any particular product or member.
 */
export function programListedPayerRecord(facilityId: string, payerType: PayerType) {
  return {
    facility_id: facilityId,
    payer_type: payerType,
    in_network: false,
    verification_confidence: 'low' as const,
    source_url: null,
  };
}

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
