// Computed differentiation — the uncopyable moat. Every profile and city hub gets a
// block of FACTUAL sentences assembled from the real dataset (counts, positions,
// coverage) so no two pages read the same and each adds genuine value. Nothing here
// is AI-originated or invented — it's arithmetic over first-party data. This is what
// clears Google's "unique value per page" bar and is the exact shape AI answer
// engines cite (original statistics from our own directory).
//
// Positioning uses a city → county → state tier so even single-facility-city profiles
// (the thinnest pages) get a real "one of N in {County} County" line before falling
// back to state framing.

import {
  LEVEL_LABELS,
  PAYER_LABELS,
  LEVELS_OF_CARE,
  type LevelOfCare,
  type PayerType,
} from '@/lib/constants';
import { normalizeAccreditations, isAccredited } from '@/lib/facility/accreditation';

export type ContextFacility = {
  levels_of_care: string[] | null;
  accreditations?: string[] | null;
  facility_payers?: { payer_type: string }[] | null;
};

export type AreaStats = {
  total: number;
  byLevel: Record<string, number>; // level -> # of programs in the area offering it
  byPayer: Record<string, number>; // payer_type -> # of programs accepting it
  accredited: number; // # with ≥1 accreditation
};

const KEY_PAYERS: PayerType[] = ['medicaid', 'medicare', 'tricare', 'self_pay'];
const MIN_AREA = 3; // an area needs ≥3 programs to be worth positioning against

export function computeAreaStats(facilities: ContextFacility[]): AreaStats {
  const byLevel: Record<string, number> = {};
  const byPayer: Record<string, number> = {};
  let accredited = 0;
  for (const f of facilities) {
    for (const l of f.levels_of_care ?? []) byLevel[l] = (byLevel[l] ?? 0) + 1;
    for (const p of new Set((f.facility_payers ?? []).map((x) => x.payer_type))) {
      byPayer[p] = (byPayer[p] ?? 0) + 1;
    }
    if (isAccredited(f.accreditations)) accredited++; // real accreditation only, not licensing
  }
  return { total: facilities.length, byLevel, byPayer, accredited };
}

export type ContextInput = {
  cityName: string;
  countyName: string | null;
  stateCode: string;
  stateName: string;
  city: AreaStats; // facility's city
  county: AreaStats | null; // facility's county (superset of city)
  stateLevelCount: number; // # same-primary-level programs statewide
};

/**
 * Factual sentences positioning ONE facility. Picks the most specific area that's a
 * real cluster (city if ≥3, else county if ≥3), and falls back to a single state line
 * otherwise. Returns 0–4 deduped lines.
 */
export function facilityContextLines(f: ContextFacility, ctx: ContextInput): string[] {
  const lines: string[] = [];
  const levels = (f.levels_of_care ?? []) as string[];
  const primary = LEVELS_OF_CARE.find((l) => levels.includes(l)) as LevelOfCare | undefined;

  // Most specific real cluster to position against.
  const area =
    ctx.city.total >= MIN_AREA
      ? { name: ctx.cityName, stats: ctx.city }
      : ctx.county && ctx.county.total >= MIN_AREA && ctx.countyName
        ? { name: `${ctx.countyName} County`, stats: ctx.county }
        : null;

  if (area) {
    // 1. Scale
    lines.push(`One of ${area.stats.total} treatment programs listed in ${area.name}${area.name === ctx.cityName ? `, ${ctx.stateCode}` : `, ${ctx.stateName}`}.`);
    // 2. Level position
    if (primary && (area.stats.byLevel[primary] ?? 0) >= 2) {
      lines.push(`One of ${area.stats.byLevel[primary]} ${LEVEL_LABELS[primary].toLowerCase()} programs in ${area.name}.`);
    }
    // 3. Medicaid access
    const payers = new Set((f.facility_payers ?? []).map((p) => p.payer_type));
    if (payers.has('medicaid') && (area.stats.byPayer.medicaid ?? 0) >= 2) {
      lines.push(`One of ${area.stats.byPayer.medicaid} programs in ${area.name} that accept Medicaid.`);
    }
    // 4. Accreditation — only cite the count when it's MEANINGFULLY below the total
    //    (otherwise "one of 47 accredited" is redundant next to "47 programs").
    const accr = accrLabel(f);
    if (accr) {
      const meaningfullyBelow = area.stats.total - area.stats.accredited >= 3 && area.stats.accredited >= 2;
      lines.push(
        meaningfullyBelow
          ? `${accr}-accredited — one of ${area.stats.accredited} accredited programs in ${area.name}.`
          : `${accr}-accredited.`
      );
    }
  } else {
    // Rural fallback: single true state line + accreditation badge; the profile's own
    // facts (levels, payers, verified date) carry the rest of the uniqueness.
    if (primary && ctx.stateLevelCount >= MIN_AREA) {
      lines.push(`One of ${ctx.stateLevelCount} ${LEVEL_LABELS[primary].toLowerCase()} programs listed in ${ctx.stateName}.`);
    }
    const accr = accrLabel(f);
    if (accr) lines.push(`${accr}-accredited.`);
  }

  return [...new Set(lines)];
}

function accrLabel(f: ContextFacility): string | null {
  const { badges } = normalizeAccreditations(f.accreditations);
  return badges.length ? badges.join(', ') : null;
}

/** Factual, citation-friendly summary stats for a CITY hub. */
export function cityContextLines(cityName: string, stateCode: string, stats: AreaStats): string[] {
  const lines: string[] = [
    `${cityName}, ${stateCode} has ${stats.total} addiction and mental-health treatment program${stats.total === 1 ? '' : 's'} listed on Clear Bed Recovery.`,
  ];
  const levelParts = (LEVELS_OF_CARE as readonly LevelOfCare[])
    .filter((l) => stats.byLevel[l])
    .map((l) => `${stats.byLevel[l]} ${LEVEL_LABELS[l].toLowerCase()}`);
  if (levelParts.length) lines.push(`Levels of care available: ${levelParts.join(', ')}.`);
  const payerParts = KEY_PAYERS.filter((p) => stats.byPayer[p]).map((p) => `${stats.byPayer[p]} accept ${PAYER_LABELS[p]}`);
  if (payerParts.length) lines.push(`Insurance: ${payerParts.join(' · ')}.`);
  if (stats.accredited) {
    lines.push(`${stats.accredited} ${stats.accredited === 1 ? 'program is' : 'programs are'} accredited (CARF, The Joint Commission, or state licensure).`);
  }
  return lines;
}
