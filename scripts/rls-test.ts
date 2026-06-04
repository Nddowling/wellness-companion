/**
 * Wellness Companion — Project A RLS test suite.
 *
 * The Milestone-1 gate: prove the database itself rejects cross-tenant access,
 * not the app layer. Run AFTER 01_core.sql + 02_rls.sql are applied to a live
 * Project A.
 *
 *   npm run rls-test          (needs the env vars below)
 *
 * Requires (from .env.local / shell):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY  — anon/user clients
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY                  — admin seeding/teardown
 *
 * It seeds throwaway auth users + facilities, runs assertions as each role, then
 * tears everything down (try/finally). Exits non-zero on the first failed gate.
 *
 * How RLS denial shows up via PostgREST:
 *   - SELECT  → rows that fail USING are silently filtered out (empty data, no error)
 *   - INSERT  → a row failing WITH CHECK returns an error (code 42501)
 *   - UPDATE  → rows failing USING are not matched (empty data, no error)
 * So read-isolation is asserted as "no rows", write-isolation as "error or no rows".
 */
import {
  createClient,
  type SupabaseClient,
  type PostgrestError,
} from '@supabase/supabase-js';

type Resp = { data: unknown; error: PostgrestError | null };

// ── tiny assertion harness ────────────────────────────────────────────────────
const checks: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? `  — ${detail}` : ''}`);
}

function rows(resp: Resp): unknown[] {
  return Array.isArray(resp.data) ? resp.data : [];
}

/** A read that must return zero rows (RLS filtered the cross-tenant rows out). */
function expectNoRows(name: string, resp: Resp) {
  if (resp.error) return record(name, false, `unexpected error: ${resp.error.message}`);
  record(name, rows(resp).length === 0, rows(resp).length ? `leaked ${rows(resp).length} row(s)` : '');
}

/** A read that must return at least one row (positive control — not vacuous). */
function expectRows(name: string, resp: Resp) {
  if (resp.error) return record(name, false, `unexpected error: ${resp.error.message}`);
  record(name, rows(resp).length > 0, rows(resp).length ? '' : 'expected rows, got none');
}

/** A write that must be rejected: either an error, or zero rows affected. */
function expectDenied(name: string, resp: Resp) {
  const denied = resp.error !== null || rows(resp).length === 0;
  record(name, denied, denied ? '' : 'write was allowed');
}

/** A write that must succeed (positive control). */
function expectAllowed(name: string, resp: Resp) {
  record(name, resp.error === null, resp.error ? resp.error.message : '');
}

// ── env ───────────────────────────────────────────────────────────────────────
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error(
    'Missing env. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TAG = `rlstest-${Date.now()}`;
const PASS = 'rls-test-pw-9f3k!';
const email = (who: string) => `${TAG}-${who}@example.test`;

// Track created rows for teardown.
const createdUserIds: string[] = [];
const createdMatchIds: string[] = [];

async function makeUser(who: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: email(who),
    password: PASS,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${who}) failed: ${error?.message}`);
  createdUserIds.push(data.user.id);
  return data.user.id;
}

/** A Supabase client authenticated as the given user (subject to RLS). */
async function userClient(who: string): Promise<SupabaseClient> {
  const c = createClient(URL!, ANON!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email: email(who), password: PASS });
  if (error) throw new Error(`signIn(${who}) failed: ${error.message}`);
  return c;
}

async function main() {
  console.log(`\nRLS test run ${TAG}\n`);

  // ── seed (service role bypasses RLS) ────────────────────────────────────────
  const facaOwner = await makeUser('faca-owner');
  const facbOwner = await makeUser('facb-owner');
  const bd1 = await makeUser('bd1');
  const bd2 = await makeUser('bd2');
  const adminUser = await makeUser('admin');

  await admin.from('platform_admins').insert({ user_id: adminUser });

  // Facility A is PUBLISHED, Facility B is UNPUBLISHED — so read-isolation on B
  // is a real test (published rows are intentionally directory-visible).
  const { data: facA, error: eA } = await admin
    .from('facilities')
    .insert({ name: `${TAG} Facility A`, zip: '90210', is_published: true })
    .select('id')
    .single();
  const { data: facB, error: eB } = await admin
    .from('facilities')
    .insert({ name: `${TAG} Facility B`, zip: '10001', is_published: false })
    .select('id')
    .single();
  if (eA || eB || !facA || !facB) throw new Error(`facility seed failed: ${eA?.message ?? eB?.message}`);
  const A = (facA as { id: string }).id;
  const B = (facB as { id: string }).id;

  await admin.from('facility_members').insert([
    { facility_id: A, user_id: facaOwner, role: 'owner' },
    { facility_id: B, user_id: facbOwner, role: 'owner' },
  ]);
  await admin.from('facility_capacity').insert([
    { facility_id: A, level_of_care: 'detox', beds_available: 4 },
    { facility_id: B, level_of_care: 'residential', beds_available: 2 },
  ]);
  await admin.from('bd_users').insert([
    { user_id: bd1, employer: 'Acme Referrals' },
    { user_id: bd2, employer: 'Beta Referrals' },
  ]);
  await admin.from('bd_facility_notes').insert([
    { bd_user_id: bd1, facility_id: A, body: 'bd1 note on A' },
    { bd_user_id: bd2, facility_id: B, body: 'bd2 note on B' },
  ]);

  // A de-identified match routed ONLY to Facility A.
  const { data: match, error: eM } = await admin
    .from('matches')
    .insert({ region_zip3: '902', care_level_needed: 'detox', payer_type: 'medicaid' })
    .select('id')
    .single();
  if (eM || !match) throw new Error(`match seed failed: ${eM?.message}`);
  const matchId = (match as { id: string }).id;
  createdMatchIds.push(matchId);
  await admin.from('match_routes').insert({ match_id: matchId, facility_id: A, status: 'sent' });

  // ── role clients ────────────────────────────────────────────────────────────
  const anon = createClient(URL!, ANON!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const faca = await userClient('faca-owner');
  const facb = await userClient('facb-owner');
  const bdc1 = await userClient('bd1');
  const adminClient = await userClient('admin');

  // ── ANON: no direct table access ────────────────────────────────────────────
  console.log('\nanon (no session):');
  expectNoRows('anon cannot read facilities directory', await anon.from('facilities').select('id'));
  expectNoRows('anon cannot read matches', await anon.from('matches').select('id'));
  expectDenied(
    'anon cannot insert a facility',
    await anon.from('facilities').insert({ name: 'rogue' }).select(),
  );

  // ── FACILITY tenant isolation ───────────────────────────────────────────────
  console.log('\nfacility A member:');
  expectRows('A member reads OWN facility', await faca.from('facilities').select('id').eq('id', A));
  expectRows('A member reads OWN capacity', await faca.from('facility_capacity').select('id').eq('facility_id', A));
  expectNoRows(
    "A member cannot read B's (unpublished) facility",
    await faca.from('facilities').select('id').eq('id', B),
  );
  expectNoRows(
    "A member cannot read B's (unpublished) capacity",
    await faca.from('facility_capacity').select('id').eq('facility_id', B),
  );
  expectDenied(
    "A member cannot UPDATE B's facility",
    await faca.from('facilities').update({ name: 'hijacked' }).eq('id', B).select(),
  );
  expectDenied(
    "A member cannot INSERT capacity for B",
    await faca.from('facility_capacity').insert({ facility_id: B, level_of_care: 'op', beds_available: 9 }).select(),
  );
  expectAllowed(
    'A member CAN update own capacity',
    await faca.from('facility_capacity').update({ beds_available: 3 }).eq('facility_id', A).select(),
  );

  // ── MATCH routing visibility ────────────────────────────────────────────────
  console.log('\nmatch routing:');
  expectRows('A member sees match routed to A', await faca.from('matches').select('id').eq('id', matchId));
  expectNoRows('B member cannot see match routed only to A', await facb.from('matches').select('id').eq('id', matchId));
  expectNoRows("B member cannot see A's match_route", await facb.from('match_routes').select('id').eq('match_id', matchId));

  // ── BD isolation ────────────────────────────────────────────────────────────
  console.log('\nbd1:');
  expectRows('bd1 reads OWN notes', await bdc1.from('bd_facility_notes').select('id').eq('bd_user_id', bd1));
  expectNoRows("bd1 cannot read bd2's notes", await bdc1.from('bd_facility_notes').select('id').eq('bd_user_id', bd2));
  expectDenied(
    'bd1 cannot write a note as bd2',
    await bdc1.from('bd_facility_notes').insert({ bd_user_id: bd2, facility_id: A, body: 'forged' }).select(),
  );
  expectDenied(
    'bd1 cannot insert a facility',
    await bdc1.from('facilities').insert({ name: 'bd-rogue' }).select(),
  );
  expectDenied(
    'bd1 cannot update a facility',
    await bdc1.from('facilities').update({ name: 'bd-hijack' }).eq('id', A).select(),
  );
  expectDenied(
    'bd1 cannot insert a match_route (server-only)',
    await bdc1.from('match_routes').insert({ match_id: matchId, facility_id: A }).select(),
  );

  // ── ADMIN positive control ──────────────────────────────────────────────────
  console.log('\nadmin:');
  expectRows('admin reads unpublished facility B', await adminClient.from('facilities').select('id').eq('id', B));
  expectRows('admin reads matches', await adminClient.from('matches').select('id').eq('id', matchId));
}

async function teardown() {
  // Deleting facilities cascades to members/payers/capacity/notes/routes.
  // Matches have no facility FK, so remove them by our run tag.
  await admin.from('facilities').delete().like('name', `${TAG}%`);
  if (createdMatchIds.length) await admin.from('matches').delete().in('id', createdMatchIds);
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
}

main()
  .catch((err) => {
    console.error('\nFATAL:', err instanceof Error ? err.message : err);
    record('suite ran to completion', false, 'threw before finishing');
  })
  .finally(async () => {
    await teardown().catch((e) => console.error('teardown warning:', e));
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
    if (failed.length) {
      console.error('FAILED gates:');
      failed.forEach((f) => console.error(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`));
      process.exit(1);
    }
    console.log('✓ All RLS gates held.');
    process.exit(0);
  });
