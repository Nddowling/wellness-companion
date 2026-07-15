#!/usr/bin/env node
/**
 * Master QA test-case export → Excel (one test per row).
 *
 *   npm run qa:xlsx                 # writes to ~/Downloads
 *   QA_OUT=/some/path.xlsx npm run qa:xlsx
 *
 * The rows below are the single source of truth for the flat test list and mirror
 * docs/qa/QA-TEST-CATALOG.md. Add a test → add a row here (and, if it's automatable,
 * a matching test() in tests/e2e using the same ID).
 *
 * Columns: ID · Area · Route/Flow · Role · Precondition · Action · Expected · Priority · Layer · Automated · Status
 */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

// SheetJS recommends the CommonJS entry point for Node so filesystem support
// is configured automatically. The ESM build requires an explicit set_fs call.
const require = createRequire(import.meta.url);
const { utils, writeFile } = require('xlsx');

const H = ['ID', 'Area', 'Route / Flow', 'Role', 'Precondition', 'Action', 'Expected', 'Priority', 'Layer', 'Automated', 'Status'];

/** shorthand row builder */
const r = (id, area, route, role, pre, action, expected, pri, layer, auto) => ({
  ID: id, Area: area, 'Route / Flow': route, Role: role, Precondition: pre,
  Action: action, Expected: expected, Priority: pri, Layer: layer, Automated: auto, Status: '',
});

const P1 = 'P1', P2 = 'P2', P3 = 'P3';

// ── §1a Public routes (200 for everyone) ────────────────────────────────────
const publics = [
  ['AC-P1', '/'], ['AC-P2', '/about'], ['AC-P3', '/pricing'], ['AC-P4', '/how-we-make-money'],
  ['AC-P5', '/for-providers'], ['AC-P6', '/for-partners'], ['AC-P7', '/for-reps'], ['AC-P8', '/claim'],
  ['AC-P9', '/data'], ['AC-P10', '/guides + /guides/[slug]'], ['AC-P11', '/library'], ['AC-P12', '/resources'],
  ['AC-P13', '/insurance + /[payer]/[state]'], ['AC-P14', '/programs + /programs/[id]'],
  ['AC-P15', '/treatment/[state]/[seg]/[level]'], ['AC-P16', '/match + /match/nearby'],
  ['AC-P17', '/privacy, /terms'], ['AC-P18', '/login, /reset'], ['AC-P19', '/p/[slug]'], ['AC-P20', '/share/[token]'],
];
const rows = [];
for (const [id, path] of publics)
  rows.push(r(id, 'Public smoke', path, 'Anon + any', 'None', `GET ${path}`,
    'HTTP <400, page renders, not redirected to /login', P2, 'L2', 'Yes'));
rows.push(r('AC-P16-note', 'Public smoke', '/match', 'Anon', 'None', 'Open seeker AI chat',
  'Chat renders with NO login wall (anonymous-start by design)', P1, 'L2', 'Yes'));

// ── P0 Crisis reachability (recovery-site non-negotiable) ───────────────────
rows.push(r('CRISIS-P0a', 'Crisis (P0)', '/, /programs, /match, /for-providers, /about, /privacy', 'Anon',
  'None', 'Load each key page', '988 crisis line VISIBLE on every page (link or disclaimer text)', P1, 'L2', 'Yes'));
rows.push(r('CRISIS-P0b', 'Crisis (P0)', 'Homepage footer', 'Anon', 'None', 'Load /',
  'Tappable tel:988 AND tel:911 links visible', P1, 'L2', 'Yes'));

// ── Seeker journeys (prod-safe reads + preview-only match write) ─────────────
const seeker = [
  ['SK-01', '/', 'Homepage renders "you don’t have to figure this out alone" + "no account required"; zero console errors', 'Yes'],
  ['SK-02', '/programs,/insurance,/guides,/library,/pricing,/how-we-make-money', 'All hub pages load <400, no error page', 'Yes'],
  ['SK-03', '/programs/[id]', 'A program profile shows a heading + an action (tel or contact CTA)', 'Yes'],
  ['SK-04', '/ link crawl', 'All internal homepage links respond <400 (light crawl, 50 max)', 'Yes'],
  ['SK-05', '/match', 'Chat loads with no login wall', 'Yes'],
  ['SK-06', '/match submit', 'PREVIEW-ONLY: submit as "QA TEST" seeker → vault_seekers row; auto-skips on prod', 'Fixme'],
];
for (const [id, route, expected, auto] of seeker)
  rows.push(r(id, 'Seeker journey', route, 'Seeker/Anon', auto === 'Fixme' ? 'Preview target' : 'None',
    'Walk journey', expected, id === 'SK-06' ? P1 : P2, 'L2', auto));

// ── §1b Anon bounced from authed shell ──────────────────────────────────────
rows.push(r('AC-A0', 'Access control', 'ALL /(app)/* routes', 'Anon', 'No session',
  'GET any app route', 'Redirect → /login', P1, 'L2', 'Yes'));

// ── §1c Role-lane matrix ────────────────────────────────────────────────────
const lane = [
  ['AC-1', '/me', 'Seeker', 'requireSeeker'],
  ['AC-2', '/conversations', 'Seeker', 'requireSeeker'],
  ['AC-3', '/conversations/[id]', 'Seeker (owner)', 'requireSeeker + RLS — other seeker’s convo must NOT render'],
  ['AC-4', '/facility', 'Facility', 'requireFacilityMember'],
  ['AC-5', '/facility/[id]', 'Facility member of [id]', 'guard + RLS — member of OTHER facility must NOT see this facility’s data'],
  ['AC-6', '/facility/[id]/contacts', 'Facility member', 'requireFacilityMember'],
  ['AC-7', '/facility/[id]/invite', 'Facility member', 'requireFacilityMember'],
  ['AC-8', '/partners', 'Partner', 'requirePartner'],
  ['AC-9', '/partners/search', 'Partner', 'requirePartner'],
  ['AC-10', '/partners/saved', 'Partner', 'requirePartner'],
  ['AC-11', '/partners/lists + /lists/[id]', 'Partner', 'requirePartner + RLS on other partner’s list'],
  ['AC-12', '/partners/history', 'Partner', 'requirePartner'],
  ['AC-13', '/partners/settings', 'Partner', 'requirePartner'],
  ['AC-14', '/partners/facility/[id]', 'Partner', 'requirePartner'],
  ['AC-15', '/rep', 'Rep', 'requireRep'],
];
for (const [id, path, owner, guard] of lane) {
  rows.push(r(id, 'Access control', path, owner, `Signed in as ${owner}`, `GET ${path}`,
    `Renders 200. ${guard}`, P1, 'L2/L1', 'Partial'));
  rows.push(r(`${id}x`, 'Access control', path, 'Other lanes', 'Signed in, wrong lane',
    `GET ${path}`, 'Redirect → own home base (never another profile’s page)', P1, 'L2', 'Partial'));
}
rows.push(r('AC-16', 'Access control', '/admin + /admin/*', 'Admin', 'platform_admins row', 'GET /admin/*',
  'Admin: 200. Non-admin: redirect → /login?error=not_authorized (ERROR redirect, not home)', P1, 'L2', 'Partial'));
rows.push(r('AC-17', 'Access control', '/get-started', 'Roleless', 'Signed in, no lane', 'GET /get-started',
  'Renders (onboarding). requireUser only', P2, 'L2', 'No'));
rows.push(r('AC-18', 'Routing', '/home', 'Any signed-in', 'Signed in', 'GET /home',
  'Redirect to lane home: seeker→/me, facility→/facility/{id}, partner→/partners, rep→/rep, admin→/admin', P2, 'L2', 'No'));
rows.push(r('AC-19', 'Routing', '/bd, /bd/[id]', 'Any', 'Retired lane', 'GET /bd*',
  'Always redirect → own home base (dormant lane, no entry point)', P3, 'L2', 'No'));

// ── §2 Stripe / money ───────────────────────────────────────────────────────
const pay = [
  ['PAY-1', '/api/checkout', 'Facility', 'Signed-in facility, plan chosen', 'GET /api/checkout', '303 → Stripe Checkout URL; unauth → /login', P1, 'L2', 'No'],
  ['PAY-2', 'Checkout return', 'Facility', 'Test-mode payment completed', 'Finish Stripe checkout', 'facility.plan upgraded (via webhook, not redirect)', P1, 'L2', 'No'],
  ['PAY-3', '/api/stripe/webhook', 'System', 'No/invalid signature', 'POST unsigned event', 'Rejected, no DB write: 400 (secret set) or 503 (not configured). Prod MUST be 400', P1, 'L2', 'Yes'],
  ['PAY-4', '/api/stripe/webhook', 'System', 'Valid signed event', 'POST checkout.session.completed', 'Entitlement upgraded; idempotent on replay', P1, 'L2', 'No'],
  ['PAY-5', 'Upgrade pill', 'Facility (free)', 'plan=free', 'Load app shell', '"⬆ Upgrade" pill shows; hidden after upgrade', P2, 'L2', 'No'],
  ['PAY-6', 'EKRA guard', '—', 'Any', 'Review pricing/line items', 'Flat-fee per tier only — NO per-referral/volume pricing', P1, 'Manual', 'No'],
  ['PAY-7', 'Downgrade/cancel', 'Facility', 'Active sub', 'Cancel subscription', 'plan→free; gated features (seeker contacts) re-lock', P1, 'L2', 'No'],
];
for (const x of pay) rows.push(r(...x));

// ── §3 Match → handoff ──────────────────────────────────────────────────────
const match = [
  ['MATCH-1', '/match', 'Anon', 'None', 'Open /match', 'Chat renders, no login wall', P1, 'L2', 'Yes'],
  ['MATCH-2', '/api/match', 'Anon', 'None', 'POST invalid JSON vs sparse body', 'Invalid JSON → 400; sparse/empty valid JSON → 200 (normalizeIntake fills defaults, resilient by design)', P1, 'L2', 'Yes'],
  ['MATCH-3', '/api/intake', 'Anon', 'None', 'POST malformed body', 'HTTP 400; valid → 200 persists intake', P1, 'L2', 'Yes'],
  ['MATCH-4', '/api/facilities/in-bounds', 'Anon', 'Map view', 'GET missing bounds', 'HTTP 400; valid bounds → facilities in view', P2, 'L2', 'No'],
  ['MATCH-5', '/api/handoff', 'Seeker', 'consent_share=false', 'POST handoff without consent', 'HTTP 400 — consent is a hard HIPAA/42 CFR Part 2 gate', P1, 'L2', 'Yes'],
  ['MATCH-6', '/api/handoff', 'Seeker', 'consent_share=true', 'POST handoff with consent', '200, referral recorded, facility notified', P1, 'L2', 'No'],
  ['MATCH-7', 'Seeker contact visibility', 'Facility', 'plan × consent matrix', 'View seeker contact PII', 'Visible ONLY if Growth+ AND consent_share=true (both required)', P1, 'L1/L2', 'No'],
  ['MATCH-8', '/api/conversations', 'Anon vs Seeker', 'None / signed in', 'POST', 'Unauth → 401; authed seeker → 200', P1, 'L2', 'Yes'],
];
for (const x of match) rows.push(r(...x));

// ── §4 Parameterized-route robustness ───────────────────────────────────────
const param = [
  ['PARAM-1', '/programs/[id]', 'non-existent id'], ['PARAM-2', '/facility/[id]', 'garbage id'],
  ['PARAM-3', '/insurance/[payer]/[state]', 'unknown payer/state'], ['PARAM-4', '/treatment/[state]/[seg]/[level]', 'unknown seg/level'],
  ['PARAM-5', '/guides/[slug]', 'unknown slug'], ['PARAM-6', '/p/[slug]', 'unknown rep'],
  ['PARAM-7', '/share/[token]', 'expired/invalid token'], ['PARAM-8', '/go/[id]', 'unknown id'],
];
for (const [id, path, bad] of param)
  rows.push(r(id, 'Robustness', path, 'Anon', bad, `GET with ${bad}`, '404 or friendly page — NEVER 500', P2, 'L2', 'No'));

// ── §5 API contract ─────────────────────────────────────────────────────────
rows.push(r('API-CRON-1', 'API contract', '/api/cron/weekly-reminders', 'Public', 'No CRON_SECRET',
  'GET without secret', 'HTTP 401', P1, 'L2', 'Yes'));
rows.push(r('API-CONTACT-1', 'API contract', '/api/contact', 'Anon', 'None', 'POST malformed', 'HTTP 400; verify spam/rate-limit guard', P2, 'L2', 'No'));
rows.push(r('API-TRACK-1', 'API contract', '/api/track', 'Anon', 'None', 'POST junk payload', 'Never 500s on bad analytics input', P3, 'L2', 'No'));
rows.push(r('API-SEARCH-1', 'API contract', '/api/facilities/search', 'Anon', 'None', 'GET', 'Public directory results, published only', P2, 'L2', 'No'));

// ── §6 RLS / tenant isolation ───────────────────────────────────────────────
const rls = [
  ['RLS-1', 'platform_admins', 'Non-admin SELECT → 0 rows (isAdmin() depends on this)'],
  ['RLS-2', 'facilities (unpublished)', 'Anon/seeker cannot read; other facility cannot update'],
  ['RLS-3', 'facility_members', 'Facility A cannot read facility B members'],
  ['RLS-4', 'conversations / vault', 'Seeker A cannot read seeker B conversation'],
  ['RLS-5', 'seeker contact PII', 'Only Growth+ facility WITH consent_share can read — enforced in DB'],
  ['RLS-6', 'bd_users / partner lists', 'Partner A cannot read partner B saved lists'],
  ['RLS-7', 'rep_profiles', 'Rep cannot escalate to facility management (display-only)'],
  ['RLS-8', 'two-Supabase HIPAA seam', 'Project A cannot reach Project B PHI outside the vault path'],
];
for (const [id, table, expected] of rls)
  rows.push(r(id, 'RLS / isolation', table, 'Cross-tenant', 'Seeded users (rls-test.ts)',
    'SELECT/INSERT/UPDATE as wrong tenant', expected, P1, 'L1', 'Partial'));

// ── §7 Manual smoke ─────────────────────────────────────────────────────────
const manual = [
  ['SMOKE-1', 'Home hero + mobile search overlay (portal to body — regression)'],
  ['SMOKE-2', 'All public nav links resolve (no dead links)'],
  ['SMOKE-3', 'Library PDF downloads open (e.g. "The First 24 Hours")'],
  ['SMOKE-4', 'Guides render markdown correctly'],
  ['SMOKE-5', 'Login magic-link / reset email arrives (nodemailer)'],
  ['SMOKE-6', 'Post-login lands each role on correct home base'],
  ['SMOKE-7', 'Facility invite email arrives + invite link works'],
  ['SMOKE-8', 'Insurance/treatment SEO pages show correct payer/state content'],
  ['SMOKE-9', 'Responsive at 375 / 768 / 1280 on home, /match, /pricing, facility page'],
  ['SMOKE-10', 'No console errors on top 10 routes'],
  ['SMOKE-11', 'Vercel analytics fires without blocking render'],
];
for (const [id, action] of manual)
  rows.push(r(id, 'Manual smoke', '—', 'QA', 'Per release', action, 'Passes visual/functional check', P2, 'L3', 'No'));

// ── build workbook ──────────────────────────────────────────────────────────
const ws = utils.json_to_sheet(rows, { header: H });
ws['!cols'] = [
  { wch: 12 }, { wch: 16 }, { wch: 34 }, { wch: 20 }, { wch: 24 },
  { wch: 30 }, { wch: 52 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
];
ws['!autofilter'] = { ref: `A1:K${rows.length + 1}` };
ws['!freeze'] = { xSplit: 0, ySplit: 1 };

const wb = utils.book_new();
utils.book_append_sheet(wb, ws, 'Master Test Cases');

// A small summary sheet.
const areas = {};
for (const row of rows) areas[row.Area] = (areas[row.Area] ?? 0) + 1;
const summary = [
  { Metric: 'Total test cases', Value: rows.length },
  { Metric: 'P1 (critical)', Value: rows.filter((x) => x.Priority === 'P1').length },
  { Metric: 'Automated (Yes)', Value: rows.filter((x) => x.Automated === 'Yes').length },
  { Metric: '', Value: '' },
  ...Object.entries(areas).map(([Metric, Value]) => ({ Metric: `  ${Metric}`, Value })),
];
const ws2 = utils.json_to_sheet(summary);
ws2['!cols'] = [{ wch: 24 }, { wch: 10 }];
utils.book_append_sheet(wb, ws2, 'Summary');

const out = process.env.QA_OUT || join(homedir(), 'Downloads', 'ClearBed-QA-MasterTestCases.xlsx');
writeFile(wb, out);
console.log(`✔ Wrote ${rows.length} test cases → ${out}`);
