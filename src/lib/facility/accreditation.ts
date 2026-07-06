// Normalize the messy raw `accreditations` array into clean short badges, and split
// real ACCREDITATIONS (CARF, Joint Commission, …) from licensing/registration noise
// (state licensing, DEA). Used by the differentiation block so pages never render
// "COMMISSION ON ACCREDITATION OF REHABILITATION FACILITIES (CARF), STATE SUBSTANCE
// USE TREATMENT AGENCY-accredited" — and so "N accredited" counts real accreditation,
// not "has any entry" (which was ~95% and therefore meaningless).

type Entry = { match: RegExp; label: string; accrediting: boolean };

const ENTRIES: Entry[] = [
  { match: /\bcarf\b|commission on accreditation of rehabilitation/i, label: 'CARF', accrediting: true },
  { match: /joint commission|\bjcaho\b/i, label: 'Joint Commission', accrediting: true },
  { match: /\bhfap\b|healthcare facilities accreditation/i, label: 'HFAP', accrediting: true },
  { match: /council on accreditation|\bcoa\b/i, label: 'COA', accrediting: true },
  { match: /\bncqa\b|national committee for quality/i, label: 'NCQA', accrediting: true },
  { match: /samhsa|opioid treatment program|\botp\b/i, label: 'SAMHSA-certified', accrediting: true },
  { match: /federally qualified health center|\bfqhc\b/i, label: 'FQHC', accrediting: true },
  // Not accreditations — licensing / registration. Tracked separately, not badged.
  { match: /\bdea\b|drug enforcement/i, label: 'DEA', accrediting: false },
  { match: /state[ _-]?licens|state substance|state department of health|state mental health|hospital licensing/i, label: 'state-licensed', accrediting: false },
];

export function normalizeAccreditations(raw: string[] | null | undefined): { badges: string[]; licensed: boolean } {
  const badges = new Set<string>();
  let licensed = false;
  for (const r of raw ?? []) {
    const hit = ENTRIES.find((e) => e.match.test(r));
    if (!hit) continue;
    if (hit.accrediting) badges.add(hit.label);
    else if (hit.label === 'state-licensed') licensed = true;
  }
  return { badges: [...badges], licensed };
}

/** True if the facility holds a real accreditation (not just a license). */
export function isAccredited(raw: string[] | null | undefined): boolean {
  return normalizeAccreditations(raw).badges.length > 0;
}
