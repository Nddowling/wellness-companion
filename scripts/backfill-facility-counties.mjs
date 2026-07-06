// Backfill facilities.county from ZIP via the public census crosswalk
// (data/zip-county.csv). Idempotent: only fills rows where county is null.
//
//   node scripts/backfill-facility-counties.mjs            # dry run
//   node scripts/backfill-facility-counties.mjs --write
//
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).

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
const WRITE = process.argv.includes('--write');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Build zip(5) -> county map from the crosswalk.
function loadZipCounty() {
  const rows = readFileSync('data/zip-county.csv', 'utf8').split('\n');
  const map = new Map();
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(',');
    if (cols.length < 5) continue;
    const zip = cols[3]?.trim();
    const county = cols[4]?.trim();
    if (zip && county && !map.has(zip)) map.set(zip, county);
  }
  return map;
}
const zip5 = (z) => (String(z ?? '').match(/\d{5}/) ?? [''])[0];

async function fetchFacilities() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('facilities').select('id, zip, county').order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function main() {
  const z2c = loadZipCounty();
  console.log(`Crosswalk: ${z2c.size} ZIPs. Mode: ${WRITE ? 'WRITE' : 'DRY RUN'}`);
  const facs = await fetchFacilities();
  const todo = [];
  let matched = 0, unmatched = 0;
  for (const f of facs) {
    if (f.county) continue; // idempotent
    const county = z2c.get(zip5(f.zip));
    if (county) { matched++; todo.push({ id: f.id, county }); }
    else unmatched++;
  }
  console.log(`Facilities: ${facs.length} · to fill: ${todo.length} · matched: ${matched} · no-zip-match: ${unmatched}`);
  if (!WRITE) { console.log('DRY RUN — re-run with --write.'); return; }

  const BATCH = 25;
  let done = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    const res = await Promise.all(chunk.map((t) => sb.from('facilities').update({ county: t.county }).eq('id', t.id).is('county', null)));
    for (const r of res) if (!r.error) done++; else console.error(r.error.message);
    if (i % 500 === 0) console.log(`  …${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }
  console.log(`Done. Wrote county for ${done} facilities. ✅`);
}
main().catch((e) => { console.error(e); process.exit(1); });
