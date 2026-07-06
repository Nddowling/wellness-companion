#!/usr/bin/env node
/**
 * Parses qa-results.json (Playwright JSON reporter) and inserts one summary row into
 * the Project A `qa_runs` table. Runs in CI after the suite (always, even on failure).
 *
 *   node scripts/report-to-supabase.mjs
 *
 * Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Project A). No-ops with a warning if
 * either is missing so local runs don't fail.
 */
import fs from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !KEY) {
  console.warn('⚠ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping qa_runs report.');
  process.exit(0);
}
if (!fs.existsSync('qa-results.json')) {
  console.warn('⚠ qa-results.json not found — run the suite first. Skipping.');
  process.exit(0);
}

const results = JSON.parse(fs.readFileSync('qa-results.json', 'utf8'));

let passed = 0,
  failed = 0,
  skipped = 0;
const failures = [];

function walk(suite) {
  for (const s of suite.suites ?? []) walk(s);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const status = t.results?.at(-1)?.status ?? t.status;
      if (status === 'passed' || status === 'expected') passed++;
      else if (status === 'skipped') skipped++;
      else {
        failed++;
        failures.push({
          title: spec.title,
          project: t.projectName ?? '',
          error: (t.results?.at(-1)?.error?.message ?? 'unknown').slice(0, 500),
        });
      }
    }
  }
}
for (const suite of results.suites ?? []) walk(suite);

const row = {
  target_url: process.env.QA_TARGET_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
  total: passed + failed + skipped,
  passed,
  failed,
  skipped,
  duration_ms: Math.round(results.stats?.duration ?? 0),
  failures,
  ci: !!process.env.CI,
};

const res = await fetch(`${SUPABASE_URL}/rest/v1/qa_runs`, {
  method: 'POST',
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  },
  body: JSON.stringify(row),
});

if (!res.ok) {
  console.error(`✖ qa_runs insert failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`✔ qa_runs: ${passed} passed, ${failed} failed, ${skipped} skipped → Supabase`);
