// Send branded "claim your free listing" cold emails to facilities that HAVE an
// email on file. Dry-run by default — prints what it WOULD send. Add --send to
// actually deliver. Throttled, and a local sent-log prevents double-sends.
//
//   npx tsx scripts/send-claim-invites.ts                 # preview 25 (dry run)
//   npx tsx scripts/send-claim-invites.ts --state GA --limit 50
//   npx tsx scripts/send-claim-invites.ts --send --limit 200 --throttle 1500 \
//       --from-name "Nick" --address "Clear Bed Recovery, 123 Main St, Atlanta, GA 30301"
//
// Needs (from .env.local, auto-loaded): SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// (Clear Bed), RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_SITE_URL.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { facilityClaimInviteEmail } from '@/lib/email/templates';

// ── env + flags ──────────────────────────────────────────────────────────────
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

const flag = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  if (i === -1) return d;
  return process.argv[i + 1]?.startsWith('--') || i + 1 >= process.argv.length ? 'true' : process.argv[i + 1];
};
const SEND = process.argv.includes('--send');
const SHORT = process.argv.includes('--short');
const LIMIT = Number(flag('limit', '25'));
const STATE = (flag('state', '') || '').toUpperCase();
const THROTTLE = Number(flag('throttle', '1500'));
const FROM_NAME = flag('from-name', process.env.CBR_FROM_NAME || 'Nick')!;
const ADDRESS = flag('address', process.env.CBR_MAILING_ADDRESS || '')!;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://clearbedrecovery.com';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Clear Bed Recovery <hello@clearbedrecovery.com>';
const REPLY_TO = (EMAIL_FROM.match(/<(.+)>/)?.[1] || 'hello@clearbedrecovery.com').trim();
const SENT_LOG = 'scripts/.invite-sent.json';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('  ✗ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
if (SEND && (!process.env.RESEND_API_KEY || !ADDRESS)) {
  console.error(
    '  ✗ Real send needs RESEND_API_KEY (env) AND a CAN-SPAM mailing address.\n' +
      '    Add --address "Clear Bed Recovery, <street>, <city>, <state> <zip>" (or set CBR_MAILING_ADDRESS).'
  );
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── load who we've already emailed ───────────────────────────────────────────
const sent: Record<string, string> = existsSync(SENT_LOG) ? JSON.parse(readFileSync(SENT_LOG, 'utf8')) : {};

// ── fetch candidates (published, has an email, not yet invited) ──────────────
let q = supabase
  .from('facilities')
  .select('id, name, city, state, referral_contact')
  .eq('is_published', true)
  .not('referral_contact->>email', 'is', null)
  .order('name')
  .limit(LIMIT + Object.keys(sent).length + 50);
if (STATE) q = q.ilike('state', STATE);
const { data, error } = await q;
if (error) {
  console.error('  ✗ query failed:', error.message);
  process.exit(1);
}

const candidates = (data ?? [])
  .filter((f) => {
    const c = (f.referral_contact ?? {}) as { email?: string };
    return c.email && c.email.includes('@') && !sent[f.id];
  })
  .slice(0, LIMIT);

console.log(
  `\n  ${SEND ? '📤 SENDING' : '🔎 DRY RUN'} — ${candidates.length} facilities` +
    `${STATE ? ` in ${STATE}` : ''} · ${SHORT ? 'short' : 'full'} copy · throttle ${THROTTLE}ms\n`
);

let ok = 0;
let failed = 0;
for (const [i, f] of candidates.entries()) {
  const c = (f.referral_contact ?? {}) as { email?: string; name?: string };
  const to = c.email!.trim();
  const firstName = c.name ? c.name.trim().split(/\s+/)[0] : null;
  const listingUrl = `${SITE}/programs/${f.id}`;
  const unsubscribeUrl = `mailto:${REPLY_TO}?subject=${encodeURIComponent(`Unsubscribe ${f.name}`)}`;
  const msg = facilityClaimInviteEmail({
    facilityName: f.name,
    city: f.city,
    state: f.state,
    listingUrl,
    firstName,
    fromName: FROM_NAME,
    unsubscribeUrl,
    mailingAddress: ADDRESS || '[mailing address required before real send]',
    short: SHORT,
  });

  const label = `${String(i + 1).padStart(3)}/${candidates.length}  ${f.name} → ${to}`;
  if (!SEND) {
    console.log(`  ·  ${label}\n        “${msg.subject}”`);
    continue;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to, reply_to: REPLY_TO, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      sent[f.id] = new Date().toISOString();
      ok++;
      console.log(`  ✓  ${label}  (${j.id ?? 'sent'})`);
    } else {
      failed++;
      console.log(`  ✗  ${label}  — ${res.status} ${await res.text()}`);
    }
  } catch (e) {
    failed++;
    console.log(`  ✗  ${label}  — ${(e as Error).message}`);
  }
  writeFileSync(SENT_LOG, JSON.stringify(sent, null, 2)); // persist after each send
  await sleep(THROTTLE);
}

console.log(
  SEND
    ? `\n  Done. ${ok} sent · ${failed} failed · log → ${SENT_LOG}\n`
    : `\n  Dry run only. Re-run with --send to deliver (and set --from-name / --address).\n`
);
