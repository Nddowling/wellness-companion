#!/usr/bin/env node
// CI guard: no beta code path under src/app may import the PHI vault client.
// Fails the build if it does. See the plan's "Cross-cutting" verification.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src/app', import.meta.url).pathname;
const NEEDLE = /supabase\/vault/;
const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(t|j)sx?$/.test(entry) && NEEDLE.test(readFileSync(p, 'utf8'))) {
      offenders.push(p);
    }
  }
}

walk(ROOT);

if (offenders.length) {
  console.error('❌ PHI vault client imported in beta code path:');
  offenders.forEach((f) => console.error('   ' + f));
  console.error('The vault (Project B) must stay dark until BAA + legal review are complete.');
  process.exit(1);
}
console.log('✓ vault guard: no PHI vault imports under src/app');
