import { US_STATES, stateSlug } from '@/lib/geo';
import { commonPayers } from '@/lib/payers';

export type DirectorySearchFilter = {
  key: 'carrier' | 'level' | 'payment' | 'specialty' | 'population' | 'region' | 'availability';
  value: string;
  label: string;
};

export type DirectorySearchInterpretation = {
  href: string;
  filters: DirectorySearchFilter[];
  recognized: boolean;
  needsApproximateState: boolean;
  destination: 'directory' | 'insurance-guide';
};

const CARRIER_SEARCH_ALIASES: Record<string, string[]> = {
  aetna: ['aetna'],
  'blue-cross-blue-shield': ['blue cross blue shield', 'blue cross', 'blue shield', 'bcbs'],
  cigna: ['cigna'],
  unitedhealthcare: ['unitedhealthcare', 'united healthcare', 'united health care', 'uhc'],
  humana: ['humana'],
  'kaiser-permanente': ['kaiser permanente', 'kaiser'],
};

type Term = {
  value: string;
  label: string;
  aliases: string[];
};

// More-specific terms come before broader ones (for example, IOP must win over
// the word "outpatient" inside "intensive outpatient"). The output remains a
// small allow-list of directory facets; the visitor's raw sentence never leaves
// the browser or enters analytics, request logs, or browser history.
const LEVEL_TERMS: Term[] = [
  {
    value: 'detox',
    label: 'Detox services',
    aliases: ['detox', 'detoxification', 'withdrawal management', 'withdrawal help'],
  },
  {
    value: 'residential',
    label: 'Residential',
    aliases: [
      'residential',
      'inpatient',
      'live in treatment',
      'overnight treatment',
      'overnight rehab',
      '30 day program',
      '60 day program',
      '90 day program',
    ],
  },
  {
    value: 'php',
    label: 'PHP (Partial Hospitalization)',
    aliases: ['php', 'partial hospitalization', 'day treatment', 'day program'],
  },
  {
    value: 'iop',
    label: 'IOP (Intensive Outpatient)',
    aliases: ['iop', 'intensive outpatient', 'evening outpatient'],
  },
  {
    value: 'op',
    label: 'Outpatient',
    aliases: ['outpatient', 'weekly counseling', 'regular counseling'],
  },
];

const PAYMENT_TERMS: Term[] = [
  { value: 'medicaid', label: 'Medicaid', aliases: ['medicaid'] },
  { value: 'medicare', label: 'Medicare', aliases: ['medicare'] },
  { value: 'tricare', label: 'TRICARE', aliases: ['tricare'] },
  {
    value: 'self_pay',
    label: 'Self-pay',
    aliases: ['self pay', 'cash pay', 'cash payment', 'out of pocket', 'uninsured', 'no insurance'],
  },
  {
    value: 'commercial',
    label: 'Commercial insurance',
    aliases: ['commercial insurance', 'private insurance', 'employer insurance', 'insurance through work'],
  },
];

const SPECIALTY_TERMS: Term[] = [
  {
    value: 'occurring',
    label: 'Co-occurring / dual diagnosis',
    aliases: ['co occurring', 'dual diagnosis', 'mental health and addiction'],
  },
  { value: 'trauma', label: 'Trauma', aliases: ['trauma', 'ptsd'] },
  {
    value: 'mat',
    label: 'Medication-assisted treatment (MAT)',
    aliases: ['mat', 'medication assisted treatment', 'medication assisted', 'suboxone', 'buprenorphine', 'methadone'],
  },
  { value: 'substance', label: 'Substance use', aliases: ['substance use'] },
];

const POPULATION_TERMS: Term[] = [
  { value: 'young adult', label: 'Young adults', aliases: ['young adult', 'young adults'] },
  { value: 'adolescent', label: 'Teens', aliases: ['teen', 'teens', 'teenager', 'teenagers', 'adolescent', 'adolescents', 'youth'] },
  { value: 'women', label: 'Women', aliases: ['women', 'woman', 'female'] },
  { value: 'men', label: 'Men', aliases: ['men', 'man', 'male'] },
  { value: 'veteran', label: 'Veterans', aliases: ['veteran', 'veterans', 'military', 'active duty', 'service member'] },
  { value: 'senior', label: 'Seniors', aliases: ['senior', 'seniors', 'older adult', 'older adults', 'age 65'] },
  { value: 'pregnant', label: 'Pregnant / postpartum', aliases: ['pregnant', 'pregnancy', 'postpartum', 'expecting mother'] },
];

const APPROXIMATE_LOCATION_TERMS = [
  'near me',
  'nearby',
  'close to me',
  'around me',
  'in my area',
  'use my location',
];

const AVAILABILITY_TERMS = [
  'open bed',
  'open beds',
  'bed available',
  'beds available',
  'current availability',
  'available now',
  'taking admissions',
  'accepting admissions',
];

function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

function includesPhrase(input: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase);
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'i').test(input);
}

function findTerm(input: string, terms: Term[]): Term | undefined {
  return terms.find((term) => term.aliases.some((alias) => includesPhrase(input, alias)));
}

function findState(rawInput: string, normalized: string): [string, string] | undefined {
  // Prefer the longest full state name so "West Virginia" cannot collapse to
  // "Virginia". Washington, D.C. normalizes to "washington d c".
  const byName = Object.entries(US_STATES)
    .map(([code, name]) => [code, name, normalize(name)] as const)
    .sort((a, b) => b[2].length - a[2].length)
    .find(([, , name]) => includesPhrase(normalized, name));
  if (byName) return [byName[0], byName[1]];

  // Two-letter codes are accepted when the visitor capitalizes them, enters the
  // code alone, or uses a location preposition ("in ga", "near FL"). This avoids
  // treating ordinary words such as "in", "or", and "me" as state codes.
  const capitalized = rawInput.match(/\b[A-Z]{2}\b/g)?.find((code) => Object.hasOwn(US_STATES, code));
  if (capitalized) return [capitalized, US_STATES[capitalized]];

  const exactCode = normalized.length === 2 ? normalized.toUpperCase() : '';
  if (exactCode && Object.hasOwn(US_STATES, exactCode)) return [exactCode, US_STATES[exactCode]];

  const afterLocationWord = /(?:^|\s)(?:in|near|around|within|from)\s+([a-z]{2})(?=\s|$)/i.exec(normalized)?.[1]?.toUpperCase();
  if (afterLocationWord === 'ME' && APPROXIMATE_LOCATION_TERMS.some((term) => includesPhrase(normalized, term))) {
    return undefined;
  }
  if (afterLocationWord && Object.hasOwn(US_STATES, afterLocationWord)) {
    return [afterLocationWord, US_STATES[afterLocationWord]];
  }
  return undefined;
}

export function insuranceDestination(payer: {
  slug: string;
  kind: string;
  payerType: string;
}): string {
  // A generic commercial facility row does not establish acceptance of a named
  // carrier, so named carriers go to their source-grounded coverage guide.
  return payer.kind === 'commercial' ? `/insurance/${payer.slug}` : `/programs?pay=${payer.payerType}`;
}

/**
 * Interpret a conversational treatment request as canonical, allow-listed
 * directory filters. Unknown narrative text is discarded, never transmitted.
 */
export function parseDirectoryLanguage(input: string): DirectorySearchInterpretation {
  const normalized = normalize(input);
  if (!normalized) {
    return {
      href: '/programs',
      filters: [],
      recognized: false,
      needsApproximateState: false,
      destination: 'directory',
    };
  }

  const needsApproximateState = APPROXIMATE_LOCATION_TERMS.some((term) => includesPhrase(normalized, term));
  const state = findState(input, normalized);
  const namedCarrier = commonPayers().find(
    (payer) =>
      payer.kind === 'commercial' &&
      (CARRIER_SEARCH_ALIASES[payer.slug] ?? [payer.name]).some((alias) => includesPhrase(normalized, alias)),
  );

  if (namedCarrier) {
    const baseHref = insuranceDestination(namedCarrier);
    const filters: DirectorySearchFilter[] = [
      { key: 'carrier', value: namedCarrier.slug, label: `${namedCarrier.name} coverage guide` },
    ];
    if (state) filters.push({ key: 'region', value: state[0], label: state[1] });
    else if (needsApproximateState) filters.push({ key: 'region', value: 'approximate', label: 'Your approximate state' });
    return {
      href: state ? `${baseHref}/${stateSlug(state[0])}` : baseHref,
      filters,
      recognized: true,
      needsApproximateState: needsApproximateState && !state,
      destination: 'insurance-guide',
    };
  }

  const params = new URLSearchParams();
  const filters: DirectorySearchFilter[] = [];
  const level = findTerm(normalized, LEVEL_TERMS);
  const payment = findTerm(normalized, PAYMENT_TERMS);
  const specialty = findTerm(normalized, SPECIALTY_TERMS);
  const population = findTerm(normalized, POPULATION_TERMS);

  if (level) {
    params.set('level', level.value);
    filters.push({ key: 'level', value: level.value, label: level.label });
  }
  if (payment) {
    params.set('pay', payment.value);
    filters.push({ key: 'payment', value: payment.value, label: payment.label });
  }
  if (specialty) {
    params.set('spec', specialty.value);
    filters.push({ key: 'specialty', value: specialty.value, label: specialty.label });
  }
  if (population) {
    params.set('pop', population.value);
    filters.push({ key: 'population', value: population.value, label: population.label });
  }
  if (state) {
    params.set('region', state[0]);
    filters.push({ key: 'region', value: state[0], label: state[1] });
  } else if (needsApproximateState) {
    filters.push({ key: 'region', value: 'approximate', label: 'Your approximate state' });
  }

  // Current availability is meaningful only for the directory's normalized
  // residential setting. With no level selected, the server can still return
  // residential rows with a fresh positive report.
  const wantsAvailability = AVAILABILITY_TERMS.some((term) => includesPhrase(normalized, term));
  if (wantsAvailability && (!level || level.value === 'residential')) {
    params.set('open', '1');
    filters.push({ key: 'availability', value: '1', label: 'Fresh bed report (7 days)' });
  }

  const query = params.toString();
  return {
    href: query ? `/programs?${query}` : '/programs',
    filters,
    recognized: filters.length > 0,
    needsApproximateState: needsApproximateState && !state,
    destination: 'directory',
  };
}

/** Add Vercel's coarse request-region result without exposing a raw location. */
export function withApproximateState(
  interpretation: DirectorySearchInterpretation,
  state: string,
): string {
  const code = state.toUpperCase();
  if (!Object.hasOwn(US_STATES, code)) return interpretation.href;
  if (interpretation.destination === 'insurance-guide') {
    return `${interpretation.href.replace(/\/$/, '')}/${stateSlug(code)}`;
  }
  const url = new URL(interpretation.href, 'https://clearbed.local');
  url.searchParams.set('region', code);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function coarseDirectoryHref(input: string): string {
  return parseDirectoryLanguage(input).href;
}
