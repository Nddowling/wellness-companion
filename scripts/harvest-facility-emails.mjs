// Harvest public contact emails for facilities that have a WEBSITE but no email.
// Fetches the homepage (+ a couple of contact pages), extracts the best public
// email, and (with --write) saves it to referral_contact.email so the claim-invite
// campaign can reach them. Dry-run by default. Throttled + per-request timeout.
//
//   node scripts/harvest-facility-emails.mjs                 # preview 50 (dry run)
//   node scripts/harvest-facility-emails.mjs --state GA --limit 200
//   node scripts/harvest-facility-emails.mjs --write --limit 500 --throttle 800
//
// Needs (from .env.local, auto-loaded): SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
//
// Note: harvesting public B2B contact emails is generally permissible, but you are
// still responsible for CAN-SPAM (clear unsubscribe + physical address — handled by
// the send script) and your ESP's policies. Quality varies; review before blasting.

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
const LIMIT = Number(flag('limit', '50'));
const STATE = (flag('state', '') || '').toUpperCase();
const THROTTLE = Number(flag('throttle', '1000'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('  ✗ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JUNK = /\.(png|jpe?g|gif|svg|webp|css|js)$|sentry|wixpress|example\.|yourdomain|domain\.com|email\.com|@2x|\.webp/i;
const ROLE_RANK = ['admissions', 'intake', 'info', 'contact', 'hello', 'office', 'help', 'care'];

function bestEmail(html) {
  const found = [...new Set((html.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))].filter((e) => !JUNK.test(e));
  if (!found.length) return null;
  // Prefer role-based intake-ish addresses; otherwise the first non-junk one.
  found.sort((a, b) => {
    const ra = ROLE_RANK.findIndex((r) => a.startsWith(r));
    const rb = ROLE_RANK.findIndex((r) => b.startsWith(r));
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
  });
  return found[0];
}

async function fetchText(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'ClearBedRecovery-DirectoryBot/1.0 (+https://clearbedrecovery.com)' },
    });
    if (!res.ok) return '';
    return (await res.text()).slice(0, 500_000);
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

function normalize(site) {
  let s = site.trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    return new URL(s).origin;
  } catch {
    return null;
  }
}

let q = supabase
  .from('facilities')
  .select('id, name, state, website, referral_contact')
  .eq('is_published', true)
  .not('website', 'is', null)
  .is('referral_contact->>email', null)
  .order('name')
  .limit(LIMIT);
if (STATE) q = q.ilike('state', STATE);
const { data, error } = await q;
if (error) {
  console.error('  ✗ query failed:', error.message);
  process.exit(1);
}
const rows = data ?? [];

console.log(`\n  ${WRITE ? '💾 HARVEST + WRITE' : '🔎 DRY RUN'} — ${rows.length} sites${STATE ? ` in ${STATE}` : ''}\n`);

let found = 0;
for (const [i, f] of rows.entries()) {
  const origin = f.website ? normalize(f.website) : null;
  const tag = `${String(i + 1).padStart(3)}/${rows.length}  ${f.name}`;
  if (!origin) {
    console.log(`  ?  ${tag}  — bad URL (${f.website})`);
    continue;
  }
  let email = null;
  for (const p of ['', '/contact', '/contact-us', '/about']) {
    const html = await fetchText(origin + p);
    email = html && bestEmail(html);
    if (email) break;
  }
  if (!email) {
    console.log(`  –  ${tag}  — none found (${origin})`);
    await sleep(THROTTLE);
    continue;
  }
  found++;
  console.log(`  ✓  ${tag}  → ${email}`);
  if (WRITE) {
    const merged = { ...(f.referral_contact || {}), email, source: 'website_harvest' };
    const { error: upErr } = await supabase.from('facilities').update({ referral_contact: merged }).eq('id', f.id);
    if (upErr) console.log(`        ✗ write failed: ${upErr.message}`);
  }
  await sleep(THROTTLE);
}

console.log(
  `\n  Done. ${found}/${rows.length} emails found${WRITE ? ' and saved' : ' (dry run — add --write to save)'}.\n`
);
