// Preview the computed-differentiation block against LIVE data, so we can eyeball
// that it reads like real value (not filler) before wiring it into pages / shipping.
// Mirrors src/lib/facility/context.ts (city -> county -> state tier + accr tweak).
//
//   node scripts/seo-context-preview.mjs --state GA

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file = '.env.local') {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv();
const flag = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const STATE = String(flag('state', 'GA')).toUpperCase();
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const LEVELS_OF_CARE = ['detox', 'residential', 'php', 'iop', 'op'];
const LEVEL_LABELS = { detox: 'Detox', residential: 'Residential', php: 'PHP (Partial Hospitalization)', iop: 'IOP (Intensive Outpatient)', op: 'Outpatient' };
const PAYER_LABELS = { medicaid: 'Medicaid', medicare: 'Medicare', commercial: 'Commercial', tricare: 'TRICARE', self_pay: 'Self-pay' };
const KEY_PAYERS = ['medicaid', 'medicare', 'tricare', 'self_pay'];
const MIN_AREA = 3;

const ACCR = [
  [/\bcarf\b|commission on accreditation of rehabilitation/i, 'CARF', true],
  [/joint commission|\bjcaho\b/i, 'Joint Commission', true],
  [/\bhfap\b|healthcare facilities accreditation/i, 'HFAP', true],
  [/council on accreditation|\bcoa\b/i, 'COA', true],
  [/\bncqa\b|national committee for quality/i, 'NCQA', true],
  [/samhsa|opioid treatment program|\botp\b/i, 'SAMHSA-certified', true],
  [/federally qualified health center|\bfqhc\b/i, 'FQHC', true],
  [/\bdea\b|drug enforcement/i, 'DEA', false],
  [/state[ _-]?licens|state substance|state department of health|state mental health|hospital licensing/i, 'state-licensed', false],
];
const normAccr = (raw) => { const b = new Set(); for (const r of raw ?? []) { const h = ACCR.find(([m]) => m.test(r)); if (h && h[2]) b.add(h[1]); } return [...b]; };
function computeAreaStats(facs) {
  const byLevel = {}, byPayer = {}; let accredited = 0;
  for (const f of facs) {
    for (const l of f.levels_of_care ?? []) byLevel[l] = (byLevel[l] ?? 0) + 1;
    for (const p of new Set((f.facility_payers ?? []).map((x) => x.payer_type))) byPayer[p] = (byPayer[p] ?? 0) + 1;
    if (normAccr(f.accreditations).length > 0) accredited++;
  }
  return { total: facs.length, byLevel, byPayer, accredited };
}
const accrLabel = (f) => { const b = normAccr(f.accreditations); return b.length ? b.join(', ') : null; };

function facilityContextLines(f, ctx) {
  const lines = [];
  const levels = f.levels_of_care ?? [];
  const primary = LEVELS_OF_CARE.find((l) => levels.includes(l));
  const area = ctx.city.total >= MIN_AREA ? { name: ctx.cityName, stats: ctx.city, isCity: true }
    : (ctx.county && ctx.county.total >= MIN_AREA && ctx.countyName) ? { name: `${ctx.countyName} County`, stats: ctx.county, isCity: false } : null;
  if (area) {
    lines.push(`One of ${area.stats.total} treatment programs listed in ${area.name}${area.isCity ? `, ${ctx.stateCode}` : `, ${ctx.stateName}`}.`);
    if (primary && (area.stats.byLevel[primary] ?? 0) >= 2) lines.push(`One of ${area.stats.byLevel[primary]} ${LEVEL_LABELS[primary].toLowerCase()} programs in ${area.name}.`);
    const payers = new Set((f.facility_payers ?? []).map((p) => p.payer_type));
    if (payers.has('medicaid') && (area.stats.byPayer.medicaid ?? 0) >= 2) lines.push(`One of ${area.stats.byPayer.medicaid} programs in ${area.name} that accept Medicaid.`);
    const accr = accrLabel(f);
    if (accr) { const below = area.stats.total - area.stats.accredited >= 3 && area.stats.accredited >= 2; lines.push(below ? `${accr}-accredited — one of ${area.stats.accredited} accredited programs in ${area.name}.` : `${accr}-accredited.`); }
  } else {
    if (primary && ctx.stateLevelCount >= MIN_AREA) lines.push(`One of ${ctx.stateLevelCount} ${LEVEL_LABELS[primary].toLowerCase()} programs listed in ${ctx.stateName}.`);
    const accr = accrLabel(f); if (accr) lines.push(`${accr}-accredited.`);
  }
  return [...new Set(lines)];
}
function cityContextLines(cityName, stateCode, stats) {
  const lines = [`${cityName}, ${stateCode} has ${stats.total} addiction and mental-health treatment program${stats.total === 1 ? '' : 's'} listed on Clear Bed Recovery.`];
  const lp = LEVELS_OF_CARE.filter((l) => stats.byLevel[l]).map((l) => `${stats.byLevel[l]} ${LEVEL_LABELS[l].toLowerCase()}`);
  if (lp.length) lines.push(`Levels of care available: ${lp.join(', ')}.`);
  const pp = KEY_PAYERS.filter((p) => stats.byPayer[p]).map((p) => `${stats.byPayer[p]} accept ${PAYER_LABELS[p]}`);
  if (pp.length) lines.push(`Insurance: ${pp.join(' · ')}.`);
  if (stats.accredited) lines.push(`${stats.accredited} ${stats.accredited === 1 ? 'program is' : 'programs are'} accredited (CARF, The Joint Commission, or state licensure).`);
  return lines;
}

async function main() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('facilities')
      .select('id, name, city, county, state, levels_of_care, accreditations, facility_payers(payer_type)')
      .ilike('state', STATE).eq('is_published', true).order('name').range(from, from + 999);
    if (error) throw error; rows.push(...data); if (data.length < 1000) break;
  }
  const stateName = { GA: 'Georgia', FL: 'Florida' }[STATE] ?? STATE;
  const byCity = new Map(), byCounty = new Map();
  for (const f of rows) {
    const c = f.city ?? '—'; if (!byCity.has(c)) byCity.set(c, []); byCity.get(c).push(f);
    if (f.county) { if (!byCounty.has(f.county)) byCounty.set(f.county, []); byCounty.get(f.county).push(f); }
  }
  const stateByLevel = {}; for (const f of rows) for (const l of f.levels_of_care ?? []) stateByLevel[l] = (stateByLevel[l] ?? 0) + 1;
  const primaryOf = (f) => LEVELS_OF_CARE.find((l) => (f.levels_of_care ?? []).includes(l));
  const ctxFor = (f) => ({
    cityName: f.city, countyName: f.county, stateCode: STATE, stateName,
    city: computeAreaStats(byCity.get(f.city) ?? [f]),
    county: f.county ? computeAreaStats(byCounty.get(f.county)) : null,
    stateLevelCount: stateByLevel[primaryOf(f)] ?? 0,
  });
  const show = (t, lines) => { console.log(`\n${t}`); for (const l of lines) console.log(`  • ${l}`); };
  console.log('═══ COMPUTED DIFFERENTIATION PREVIEW (city→county→state) — live', STATE, '═══');

  const cities = [...byCity.entries()].map(([c, fs]) => ({ c, n: fs.length })).sort((a, b) => b.n - a.n);
  const mid = cities.find((x) => x.n >= 6 && x.n <= 15) ?? cities[1];
  show(`CITY HUB → ${mid.c}`, cityContextLines(mid.c, STATE, computeAreaStats(byCity.get(mid.c))));

  const big = byCity.get(cities[0].c);
  const bex = big.find((f) => (f.facility_payers ?? []).some((p) => p.payer_type === 'medicaid') && (f.accreditations ?? []).length) ?? big[0];
  show(`PROFILE (big city) → ${bex.name} — ${bex.city}, ${STATE}`, facilityContextLines(bex, ctxFor(bex)));

  const solo = rows.find((f) => (byCity.get(f.city)?.length ?? 0) === 1 && f.county && (byCounty.get(f.county)?.length ?? 0) >= 3);
  if (solo) show(`PROFILE (single-facility city → COUNTY tier) → ${solo.name} — ${solo.city}, ${STATE} (${solo.county} County)`, facilityContextLines(solo, ctxFor(solo)));
  const rural = rows.find((f) => (byCity.get(f.city)?.length ?? 0) === 1 && (!f.county || (byCounty.get(f.county)?.length ?? 0) < 3));
  if (rural) show(`PROFILE (rural → STATE fallback + own facts) → ${rural.name} — ${rural.city}, ${STATE}`, facilityContextLines(rural, ctxFor(rural)));
}
main().catch((e) => { console.error(e); process.exit(1); });
