/**
 * Turns the imported SAMHSA text fields (semicolon-delimited human-readable lists)
 * into clean, structured data for the Recovery.com-style profile sections.
 *
 * The values are already readable ("Cognitive behavioral therapy",
 * "Buprenorphine with naloxone"), so this mostly splits, trims, de-dupes, and drops
 * the "+N more" truncation markers the source leaves behind.
 */

type FacilityLike = Record<string, unknown>;

function str(f: FacilityLike, key: string): string | null {
  const v = f[key];
  return typeof v === 'string' && v.trim() ? v : null;
}

/** Split "A; B; C; +4 more" → ["A","B","C"] — trimmed, de-duped, truncation markers dropped. */
export function splitSemis(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[;|]/)) {
    const s = raw.trim();
    if (!s || /^\+\s*\d+\s*more$/i.test(s)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Light cleanup for medication names (drop the boilerplate "used in Treatment" suffix). */
function cleanMed(s: string): string {
  return s.replace(/\s+used in treatment$/i, '').trim();
}

/** Interpret the loose yes/no-ish SAMHSA flag strings. */
function truthy(text: string | null): boolean {
  if (!text) return false;
  return /\b(yes|true|available|offered|certified|permitted)\b/i.test(text);
}

export type MatGroup = { label: string; meds: string[] };

export type ProfileRich = {
  description: string | null;
  approaches: string[];
  mat: { groups: MatGroup[]; available: boolean };
  populations: string[];
  ageGroups: string[];
  sexAccepted: string | null;
  languages: string[];
  aftercare: string[];
  services: string[];
  smoking: string | null;
  vaping: string | null;
  telehealth: boolean;
  hasAny: boolean;
};

/** Extract every Recovery.com-style section from a facility row's SAMHSA fields. */
export function facilityRich(f: FacilityLike): ProfileRich {
  const description = str(f, 'description') ?? str(f, 'samhsa_description');
  const approaches = splitSemis(str(f, 'samhsa_treatment_approaches'));

  const oud = splitSemis(str(f, 'samhsa_medications_for_oud')).map(cleanMed);
  const aud = splitSemis(str(f, 'samhsa_medications_for_aud')).map(cleanMed);
  const pharma = splitSemis(str(f, 'samhsa_pharmacotherapies')).map(cleanMed);
  // Anything in the general pharmacotherapies list that isn't already an OUD/AUD med.
  const known = new Set([...oud, ...aud].map((m) => m.toLowerCase()));
  const other = pharma.filter((m) => !known.has(m.toLowerCase()));
  const matGroups: MatGroup[] = [
    { label: 'For opioid use disorder', meds: oud },
    { label: 'For alcohol use disorder', meds: aud },
    { label: 'Other medications', meds: other },
  ].filter((g) => g.meds.length > 0);
  const matAvailable = matGroups.length > 0 || truthy(str(f, 'samhsa_mat_moud_available'));

  const aftercare = [
    ...splitSemis(str(f, 'samhsa_recovery_support_services')),
    ...splitSemis(str(f, 'samhsa_transitional_services')),
  ].filter((v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i);

  const rich: Omit<ProfileRich, 'hasAny'> = {
    description,
    approaches,
    mat: { groups: matGroups, available: matAvailable },
    populations: splitSemis(str(f, 'samhsa_special_populations')),
    ageGroups: splitSemis(str(f, 'samhsa_age_groups')),
    sexAccepted: str(f, 'samhsa_sex_accepted'),
    languages: splitSemis(str(f, 'samhsa_language_services')),
    aftercare,
    services: splitSemis(str(f, 'samhsa_all_services_expanded')).slice(0, 24),
    smoking: str(f, 'samhsa_smoking_policy'),
    vaping: str(f, 'samhsa_vaping_policy'),
    telehealth: truthy(str(f, 'samhsa_telehealth_available')),
  };

  const hasAny =
    !!rich.description ||
    rich.approaches.length > 0 ||
    rich.mat.groups.length > 0 ||
    rich.populations.length > 0 ||
    rich.languages.length > 0 ||
    rich.aftercare.length > 0 ||
    !!rich.smoking;

  return { ...rich, hasAny };
}
