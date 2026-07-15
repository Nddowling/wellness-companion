// Normalize the messy raw `accreditations` array into clean short badges, and split
// real ACCREDITATIONS (CARF, Joint Commission, …) from licensing/registration noise
// (state licensing, DEA). Used by the differentiation block so pages never render
// "COMMISSION ON ACCREDITATION OF REHABILITATION FACILITIES (CARF), STATE SUBSTANCE
// USE TREATMENT AGENCY-accredited" — and so "N accredited" counts real accreditation,
// not "has any entry" (which was ~95% and therefore meaningless).

export type CredentialKind = 'accreditation' | 'certification' | 'designation' | 'license' | 'registration';
export type CredentialBadge = { label: string; kind: CredentialKind };
type Entry = { match: RegExp; label: string; kind: CredentialKind };

const ENTRIES: Entry[] = [
  { match: /\bcarf\b|commission on accreditation of rehabilitation/i, label: 'CARF', kind: 'accreditation' },
  { match: /joint commission|\bjcaho\b/i, label: 'Joint Commission', kind: 'accreditation' },
  { match: /\bhfap\b|healthcare facilities accreditation/i, label: 'HFAP', kind: 'accreditation' },
  { match: /council on accreditation|\bcoa\b/i, label: 'COA', kind: 'accreditation' },
  { match: /\bncqa\b|national committee for quality/i, label: 'NCQA', kind: 'accreditation' },
  {
    match: /samhsa.{0,30}certif|certif.{0,30}samhsa|opioid treatment program|\botp\b/i,
    label: 'SAMHSA OTP',
    kind: 'certification',
  },
  { match: /federally qualified health center|\bfqhc\b/i, label: 'FQHC', kind: 'designation' },
  { match: /\bdea\b|drug enforcement/i, label: 'DEA', kind: 'registration' },
  {
    match: /state[ _-]?licens|state substance|state department of health|state mental health|hospital licensing/i,
    label: 'State',
    kind: 'license',
  },
];

/** Known credential claims, with their legal/operational type kept explicit. */
export function normalizeCredentials(raw: string[] | null | undefined): CredentialBadge[] {
  const seen = new Set<string>();
  const result: CredentialBadge[] = [];
  for (const value of raw ?? []) {
    const hit = ENTRIES.find((entry) => entry.match.test(value));
    if (!hit) continue;
    const key = `${hit.kind}:${hit.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ label: hit.label, kind: hit.kind });
  }
  return result;
}

export function credentialLabel(credential: CredentialBadge): string {
  return `${credential.label} ${credential.kind}`;
}

export function normalizeAccreditations(raw: string[] | null | undefined): { badges: string[]; licensed: boolean } {
  const credentials = normalizeCredentials(raw);
  return {
    badges: credentials.filter((c) => c.kind === 'accreditation').map((c) => c.label),
    licensed: credentials.some((c) => c.kind === 'license'),
  };
}

/** True if the facility holds a real accreditation (not just a license). */
export function isAccredited(raw: string[] | null | undefined): boolean {
  return normalizeAccreditations(raw).badges.length > 0;
}
