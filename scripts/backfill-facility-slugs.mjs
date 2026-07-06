// One-time backfill of facilities.slug for SEO-friendly URLs.
//
//   slug = slugify(name)-city-state    e.g. "coastal-recovery-savannah-ga"
//   lowercase · hyphenated · punctuation stripped · collisions get -2, -3, …
//
// Requires migration 21_facility_slugs.sql (nullable slug column + partial unique
// index) to be applied first.
//
//   node scripts/backfill-facility-slugs.mjs              # dry run — preview, no writes
//   node scripts/backfill-facility-slugs.mjs --write      # persist slugs
//   node scripts/backfill-facility-slugs.mjs --write --limit 500
//
// IDEMPOTENT: only rows where slug IS NULL are assigned, and the "taken" set is
// seeded from every slug already in the table — so a re-run (or a run that resumes
// after an interruption) never reshuffles or duplicates an existing slug. Slugs are
// therefore permanent once written, which is what you want for canonical SEO URLs.
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
const WRITE = process.argv.includes('--write');
const LIMIT = Number(flag('limit', '0')); // 0 = no cap

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env/.env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Mirrors src/lib/geo.ts slugify() exactly: lowercase, any run of non-alphanumerics
// → single hyphen, trim leading/trailing hyphens. (Duplicated here so this plain .mjs
// script needn't import the TS module.)
function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// base = slugify(name)-city-state, dropping any empty part so we never get a stray
// double/leading hyphen. Falls back to the row id if name/city/state are all blank.
function baseSlug(row) {
  const base = [row.name, row.city, row.state]
    .map((part) => slugify(part))
    .filter(Boolean)
    .join('-');
  return base || `facility-${row.id}`;
}

// Fetch all rows in pages (PostgREST caps a single response near 1,000).
async function fetchAll(columns, { onlyNullSlug = false } = {}) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from('facilities')
      .select(columns)
      .order('id', { ascending: true }) // deterministic order → stable suffix assignment
      .range(from, from + PAGE - 1);
    if (onlyNullSlug) query = query.is('slug', null);
    const { data, error } = await query;
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

async function main() {
  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY RUN'}${LIMIT ? ` · limit ${LIMIT}` : ''}`);

  // Seed the "taken" set from EVERY existing slug so we never collide with, or
  // reshuffle, slugs assigned on a previous run.
  const existing = await fetchAll('id, slug');
  const taken = new Set(existing.map((r) => r.slug).filter(Boolean));
  const already = taken.size;

  // Only rows still missing a slug get one → inherently idempotent.
  let todo = await fetchAll('id, name, city, state, slug', { onlyNullSlug: true });
  if (LIMIT) todo = todo.slice(0, LIMIT);

  console.log(`Total facilities: ${existing.length} · already slugged: ${already} · to assign: ${todo.length}`);
  if (todo.length === 0) {
    console.log('Nothing to do. ✅');
    return;
  }

  // Assign a unique slug to each, resolving collisions with -2, -3, …
  const assignments = [];
  for (const row of todo) {
    const base = baseSlug(row);
    let slug = base;
    let n = 2;
    while (taken.has(slug)) slug = `${base}-${n++}`;
    taken.add(slug);
    assignments.push({ id: row.id, slug });
  }

  // Show a preview either way.
  console.log('\nSample:');
  for (const a of assignments.slice(0, 10)) console.log(`  ${a.slug}`);
  const suffixed = assignments.filter((a) => /-\d+$/.test(a.slug)).length;
  if (suffixed) console.log(`(${suffixed} needed a -N collision suffix)`);

  if (!WRITE) {
    console.log(`\nDRY RUN — no writes. Re-run with --write to persist ${assignments.length} slugs.`);
    return;
  }

  // Per-row updates (each slug is distinct, so no bulk upsert). Batched for speed.
  const BATCH = 25;
  let done = 0;
  for (let i = 0; i < assignments.length; i += BATCH) {
    const chunk = assignments.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map((a) =>
        supabase.from('facilities').update({ slug: a.slug }).eq('id', a.id).is('slug', null),
      ),
    );
    for (let j = 0; j < results.length; j++) {
      if (results[j].error) console.error(`  ✗ ${chunk[j].id}: ${results[j].error.message}`);
      else done++;
    }
    if ((i / BATCH) % 8 === 0 || i + BATCH >= assignments.length) {
      console.log(`  …${Math.min(i + BATCH, assignments.length)}/${assignments.length}`);
    }
  }
  console.log(`\nDone. Wrote ${done} slugs. ✅`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
