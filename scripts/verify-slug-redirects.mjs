// Pre-deploy safety check for the UUID → slug migration.
//
// Samples N random published facilities, then for each asserts the full journey:
//   GET /programs/<uuid>   → exactly 301, Location = the canonical slug URL
//   GET <slug URL>         → 200 (no further redirect = no chain, no 404)
//
// Any deviation (wrong status, redirect chain, 404, wrong target) is reported.
//
//   node scripts/verify-slug-redirects.mjs --base https://<preview>.vercel.app
//   node scripts/verify-slug-redirects.mjs --base http://localhost:3000 --n 200
//
// Run it against a build that ALREADY has the migration (a preview deploy or a
// local `next build && next start`) — production won't redirect until you ship.
//
// Needs (from .env.local, auto-loaded): SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

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

const flag = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  if (i === -1) return d;
  const nx = process.argv[i + 1];
  return !nx || nx.startsWith('--') ? 'true' : nx;
};
const BASE = String(flag('base', 'https://clearbedrecovery.com')).replace(/\/$/, '');
const N = Number(flag('n', '200'));
const CONCURRENCY = Number(flag('concurrency', '10'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env/.env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Mirrors src/lib/geo.ts.
const slugify = (s) =>
  String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};
const stateSlug = (code) => {
  const name = US_STATES[String(code).toUpperCase()];
  return name ? slugify(name) : String(code).toLowerCase();
};
const canonicalPath = (f) => `/treatment/${stateSlug(f.state)}/${slugify(f.city)}/${f.slug}`;

async function fetchAllFacilities() {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('facilities')
      .select('id, slug, city, state')
      .eq('is_published', true)
      .not('slug', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

function sample(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}

// Verify one facility's redirect journey. Returns { ok } or { ok:false, reason }.
async function check(f) {
  const oldUrl = `${BASE}/programs/${f.id}`;
  const expected = canonicalPath(f);

  let r1;
  try {
    r1 = await fetch(oldUrl, { redirect: 'manual', headers: { 'user-agent': 'slug-redirect-check' } });
  } catch (e) {
    return { ok: false, reason: `network error on /programs/${f.id}: ${e.message}` };
  }
  if (r1.status !== 301) {
    return { ok: false, reason: `expected 301 at /programs/${f.id}, got ${r1.status}` };
  }
  const loc = r1.headers.get('location');
  if (!loc) return { ok: false, reason: `301 at /programs/${f.id} had no Location header` };

  const locPath = new URL(loc, BASE).pathname;
  if (decodeURIComponent(locPath) !== decodeURIComponent(expected)) {
    return { ok: false, reason: `redirect target mismatch for ${f.id}: got ${locPath}, expected ${expected}` };
  }

  let r2;
  try {
    r2 = await fetch(new URL(loc, BASE), { redirect: 'manual', headers: { 'user-agent': 'slug-redirect-check' } });
  } catch (e) {
    return { ok: false, reason: `network error on ${locPath}: ${e.message}` };
  }
  if (r2.status >= 300 && r2.status < 400) {
    return { ok: false, reason: `redirect CHAIN: ${locPath} returned ${r2.status} → ${r2.headers.get('location')}` };
  }
  if (r2.status === 404) return { ok: false, reason: `slug URL 404s: ${locPath}` };
  if (r2.status !== 200) return { ok: false, reason: `slug URL ${locPath} returned ${r2.status} (expected 200)` };

  return { ok: true };
}

// Simple concurrency pool.
async function runPool(items, worker, size) {
  const results = new Array(items.length);
  let next = 0;
  async function loop() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
      if ((i + 1) % 25 === 0) console.log(`  …${i + 1}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, loop));
  return results;
}

async function main() {
  console.log(`Base: ${BASE} · sampling ${N} of the published facilities`);
  const all = await fetchAllFacilities();
  if (all.length === 0) {
    console.error('No published facilities with slugs found — did the backfill run?');
    process.exit(1);
  }
  const picks = sample(all, N);

  const results = await runPool(picks, check, CONCURRENCY);
  const failures = results
    .map((r, i) => ({ r, f: picks[i] }))
    .filter((x) => !x.r.ok);

  console.log(`\nChecked ${picks.length} · passed ${picks.length - failures.length} · failed ${failures.length}`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const { r, f } of failures) console.log(`  ✗ [${f.id}] ${r.reason}`);
    console.log('\n❌ Not safe to deploy — investigate the failures above.');
    process.exit(1);
  }
  console.log('\n✅ All sampled UUID URLs 301 to a live 200 slug URL, no chains or 404s. Safe to deploy.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
