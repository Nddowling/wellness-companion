// One source of truth for what a clinical term means — written once, in plain
// language for a scared family member at 2am, and rendered wherever the term
// appears (defined chips, tooltips, snapshot explainers, filter option help).
// href points to the deepest ClearBed page that teaches the term, when one exists.

export type GlossaryEntry = {
  /** Short plain-English definition. Formula: "[what it is] — [why it matters to you]." */
  definition: string;
  /** Optional "Learn more" destination (a guide / browse page). */
  href?: string;
};

// Keys are lowercase canonical terms. Look up via glossaryLookup() which is
// punctuation/case-insensitive so "PHP", "php", and "P.H.P." all resolve.
export const GLOSSARY: Record<string, GlossaryEntry> = {
  // Levels of care
  detox: {
    definition: 'Withdrawal-management services. Directory source records may describe outpatient, residential, or hospital care, so confirm the setting and clinical service directly.',
    href: '/guides',
  },
  residential: {
    definition: 'Live-in treatment with round-the-clock support. Services and length vary, and a qualified provider determines whether this level is appropriate.',
    href: '/guides',
  },
  php: {
    definition: 'Partial Hospitalization Program — structured treatment during the day while the participant lives elsewhere. Schedules and services vary.',
    href: '/guides',
  },
  iop: {
    definition: 'Intensive Outpatient Program — scheduled treatment several times a week while the participant lives elsewhere. Schedules and services vary.',
    href: '/guides',
  },
  op: {
    definition: 'Outpatient — scheduled treatment visits while the participant lives elsewhere. Frequency and services vary by program.',
    href: '/guides',
  },
  // Payers / coverage
  medicaid: {
    definition: 'A joint federal-state health coverage program — eligibility, covered services, participating programs, and member costs vary by state and plan.',
    href: '/insurance',
  },
  medicare: {
    definition: 'Federal coverage mainly for people 65+ or with certain disabilities.',
    href: '/insurance',
  },
  commercial: {
    definition: 'Private insurance through an employer or the marketplace (Aetna, Blue Cross, Cigna, etc.).',
    href: '/insurance',
  },
  tricare: {
    definition: 'Health coverage for active-duty and retired military and their families.',
    href: '/insurance',
  },
  self_pay: {
    definition: 'Paying out of pocket (cash/card) without insurance — many facilities offer estimates and sliding-scale options.',
    href: '/insurance',
  },
  // Clinical concepts
  'co-occurring': {
    definition: 'Treating a substance use disorder and a mental-health condition (like anxiety or depression) at the same time — because they feed each other.',
    href: '/guides',
  },
  mat: {
    definition: 'Medication-Assisted Treatment — FDA-approved medication (e.g., buprenorphine, methadone) combined with counseling for opioid or alcohol use.',
    href: '/guides',
  },
  // Trust signals
  'joint commission': {
    definition: 'An independent accreditation that a facility meets national safety and quality standards.',
  },
  carf: {
    definition: 'CARF accreditation — an independent review confirming the program meets recognized rehabilitation quality standards.',
  },
  'samhsa-listed': {
    definition: 'Included in the federal SAMHSA treatment directory — the public dataset ClearBed is built on.',
    href: '/about',
  },
  'license verified': {
    definition: 'The directory record includes a dated, source-linked license check. Confirm current license status directly with the state regulator.',
    href: '/about',
  },
};

const normalize = (t: string) => t.toLowerCase().replace(/[.\s]+/g, (m) => (m.trim() === '.' ? '' : ' ')).trim();

export function glossaryLookup(term: string): GlossaryEntry | undefined {
  if (!term) return undefined;
  const key = normalize(term);
  return GLOSSARY[key] ?? GLOSSARY[key.replace(/\s+/g, '')] ?? GLOSSARY[key.replace(/\s+/g, '-')];
}
