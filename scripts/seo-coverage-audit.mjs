// §17.4 Enrichment coverage audit — per state, against the live schema.
// Reports the field-coverage numbers that gate Pass-1/enrichment/indexation.
// Reruns before every Pass batch and at each quarterly loop.
//
//   node scripts/seo-coverage-audit.mjs            # Georgia (default)
//   node scripts/seo-coverage-audit.mjs --state FL --write
//
// --write commits the report to docs/qa/enrichment-coverage-<state>-<date>.md.
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from .env.local).

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
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

const flag = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  if (i === -1) return d;
  const nx = process.argv[i + 1];
  return !nx || nx.startsWith('--') ? 'true' : nx;
};
const STATE = String(flag('state', 'GA')).toUpperCase();
const WRITE = process.argv.includes('--write');
const DATE = String(flag('date', '')) || new Date().toISOString().slice(0, 10);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const nonEmpty = (s) => typeof s === 'string' && s.trim() !== '';
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// 8-gram shingle set for a normalized description.
function shingles(text) {
  const toks = norm(text).split(' ').filter(Boolean);
  const set = new Set();
  for (let i = 0; i + 8 <= toks.length; i++) set.add(toks.slice(i, i + 8).join(' '));
  return set;
}
function overlap(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const s of small) if (big.has(s)) inter++;
  return inter / small.size; // fraction of the smaller set covered
}

async function fetchAll(state) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('facilities')
      .select('id, slug, is_published, main_phone, intake_line, website, levels_of_care, description, verified_at, facility_payers(payer_type)')
      .ilike('state', state)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

function pct(n, d) { return d === 0 ? '0.0' : ((100 * n) / d).toFixed(1); }

async function main() {
  const all = await fetchAll(STATE);
  const pub = all.filter((f) => f.is_published);
  const n = pub.length;

  const hasPhone = pub.filter((f) => nonEmpty(f.main_phone) || nonEmpty(f.intake_line)).length;
  const hasWebsite = pub.filter((f) => nonEmpty(f.website)).length;
  const hasLevel = pub.filter((f) => Array.isArray(f.levels_of_care) && f.levels_of_care.length >= 1).length;
  const hasPayer = pub.filter((f) => Array.isArray(f.facility_payers) && f.facility_payers.length >= 1).length;
  const withDesc = pub.filter((f) => nonEmpty(f.description));
  const hasDesc = withDesc.length;
  const hasVerifiedAt = pub.filter((f) => f.verified_at).length;

  // Slug collisions (should be 0 — global unique index).
  const slugCounts = new Map();
  for (const f of all) if (f.slug) slugCounts.set(f.slug, (slugCounts.get(f.slug) || 0) + 1);
  const slugCollisions = [...slugCounts.values()].filter((c) => c > 1).length;

  // Description uniqueness: exact-normalized dupes + 8-gram shingle overlap >30%.
  const normCounts = new Map();
  for (const f of withDesc) { const k = norm(f.description); normCounts.set(k, (normCounts.get(k) || 0) + 1); }
  const exactDupFacilities = [...normCounts.entries()].filter(([, c]) => c > 1).reduce((s, [, c]) => s + c, 0);

  const shg = withDesc.map((f) => ({ id: f.id, s: shingles(f.description) })).filter((x) => x.s.size > 0);
  const nearDup = new Set();
  for (let i = 0; i < shg.length; i++) {
    for (let j = i + 1; j < shg.length; j++) {
      if (overlap(shg[i].s, shg[j].s) > 0.30) { nearDup.add(shg[i].id); nearDup.add(shg[j].id); }
    }
  }
  const uniqueDesc = hasDesc - nearDup.size; // descriptions that are long-enough AND not near-dup
  const pctUniqueOfAll = pct(uniqueDesc, n);

  const lines = [];
  const P = (s) => { lines.push(s); console.log(s); };
  P(`# Enrichment coverage — ${STATE} — ${DATE}`);
  P('');
  P('_§17.4 coverage audit. Percentages are of PUBLISHED facilities in the state._');
  P('');
  P(`- Total ${STATE} facilities (all): **${all.length}**`);
  P(`- Total ${STATE} published: **${n}**`);
  P(`- Verified phone (has phone; no verification field yet — see note): **${hasPhone}** (${pct(hasPhone, n)}%)`);
  P(`- Verified website (has website; no verification field yet): **${hasWebsite}** (${pct(hasWebsite, n)}%)`);
  P(`- ≥1 level-of-care flag: **${hasLevel}** (${pct(hasLevel, n)}%)`);
  P(`- ≥1 payer boolean: **${hasPayer}** (${pct(hasPayer, n)}%)`);
  P(`- Has description: **${hasDesc}** (${pct(hasDesc, n)}%)`);
  P(`- Unique description (has desc AND not >30% 8-gram overlap): **${uniqueDesc}** (${pctUniqueOfAll}% of all)`);
  P(`- Exact-duplicate descriptions (facilities sharing an identical normalized description): **${exactDupFacilities}**`);
  P(`- Near-duplicate descriptions (>30% 8-gram shingle overlap): **${nearDup.size}**`);
  P(`- has verified_at (existing legacy flag): **${hasVerifiedAt}** (${pct(hasVerifiedAt, n)}%)`);
  P(`- Slug collisions (${STATE}): **${slugCollisions}**`);
  P(`- Closed facilities: **N/A** (no closed/status column yet — Pass-6 adds detection)`);
  P('');
  P('**Notes / caveats:**');
  P('- "Verified" phone/website cannot be measured yet: the `last_verified` / `verification_confidence` / `source_url` / `verified_by` columns do not exist (P0 enrichment-schema migration adds them). Numbers above are PRESENCE, not verification.');
  P('- Closed-facility count needs a status column (Pass-6).');

  if (WRITE) {
    const path = `docs/qa/enrichment-coverage-${STATE.toLowerCase()}-${DATE}.md`;
    writeFileSync(path, lines.join('\n') + '\n');
    console.log(`\nWrote ${path}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
