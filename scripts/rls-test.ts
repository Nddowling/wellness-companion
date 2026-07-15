/**
 * Wellness Companion — Project A RLS test suite.
 *
 * The Milestone-1 gate: prove the database itself rejects cross-tenant access,
 * not the app layer. Run after the full Project A migration set is applied to a
 * disposable branch. The suite creates and deletes auth/data fixtures.
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

/**
 * A protected read may be denied either by RLS (zero rows) or by a privilege
 * revoke (PostgREST error). Both prove that the browser role cannot see data.
 */
function expectNoAccess(name: string, resp: Resp) {
  const denied = resp.error !== null || rows(resp).length === 0;
  record(
    name,
    denied,
    denied ? '' : `leaked ${rows(resp).length} row(s)`,
  );
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
  const rep1 = await makeUser('rep1');
  const claimant = await makeUser('claimant');
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
  await admin.from('rep_profiles').insert({
    user_id: rep1,
    slug: `${TAG}-rep1`,
    display_name: 'RLS Test Rep',
  });
  const { data: affiliation, error: affiliationError } = await admin
    .from('facility_affiliations')
    .insert({ user_id: rep1, facility_id: A, title: 'Admissions', status: 'pending' })
    .select('id')
    .single();
  if (affiliationError || !affiliation) throw new Error(`affiliation seed failed: ${affiliationError?.message}`);
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
  const repc1 = await userClient('rep1');
  const adminClient = await userClient('admin');

  // ── ANON: no private/direct-write access ────────────────────────────────────
  console.log('\nanon (no session):');
  expectNoAccess('anon cannot read facilities directly', await anon.from('facilities').select('id'));
  expectNoRows('anon cannot read matches', await anon.from('matches').select('id'));
  expectDenied(
    'anon cannot insert a facility',
    await anon.from('facilities').insert({ name: 'rogue' }).select(),
  );

  // Migration 28 removes both policies and table privileges from every vault
  // table. Test both anonymous and authenticated browser roles; service-role
  // seeding above is the positive control.
  console.log('\nvault isolation:');
  for (const table of [
    'vault_seekers',
    'vault_seeker_interest',
    'vault_email_log',
    'vault_conversations',
    'vault_consent_events',
  ]) {
    expectNoAccess(`anon cannot read ${table}`, await anon.from(table).select('*').limit(1));
    expectNoAccess(`authenticated user cannot read ${table}`, await faca.from(table).select('*').limit(1));
  }

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
  expectDenied(
    'A member cannot directly update own capacity',
    await faca.from('facility_capacity').update({ beds_available: 3 }).eq('facility_id', A).select(),
  );
  expectDenied(
    'A member cannot directly alter own billing or verification fields',
    await faca
      .from('facilities')
      .update({ plan: 'anchor', plan_status: 'lifetime', is_published: true, verified_at: new Date().toISOString() })
      .eq('id', A)
      .select(),
  );
  expectDenied(
    'A member cannot directly write own payer evidence',
    await faca.from('facility_payers').insert({ facility_id: A, payer_type: 'commercial', in_network: true }).select(),
  );
  expectDenied(
    'A member cannot directly change own routed lead status',
    await faca.from('match_routes').update({ status: 'accepted' }).eq('match_id', matchId).select(),
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

  // ── CANONICAL LANES + AFFILIATION VERIFICATION ───────────────────────────
  console.log('\ncanonical provider lanes:');
  expectDenied(
    'a Partner cannot self-create a Rep lane',
    await bdc1.from('rep_profiles').insert({
      user_id: bd1,
      slug: `${TAG}-forged-rep`,
      display_name: 'Forged rep',
    }).select(),
  );
  expectDenied(
    'a facility member cannot self-create a Partner lane',
    await faca.from('bd_users').insert({ user_id: facaOwner, employer: 'Forged partner' }).select(),
  );
  expectDenied(
    'a representative cannot self-verify an affiliation',
    await repc1
      .from('facility_affiliations')
      .update({ status: 'verified' })
      .eq('id', (affiliation as { id: string }).id)
      .select(),
  );
  expectDenied(
    'even service-role writes cannot cross canonical lanes',
    await admin.from('bd_users').insert({ user_id: facaOwner, employer: 'Cross lane' }).select(),
  );
  expectAllowed(
    'the canonical facility owner can verify through the status-only RPC',
    await faca.rpc('set_facility_affiliation_status', {
      p_affiliation_id: (affiliation as { id: string }).id,
      p_status: 'verified',
    }),
  );
  expectRows(
    'owner RPC persisted verified status',
    await admin
      .from('facility_affiliations')
      .select('id')
      .eq('id', (affiliation as { id: string }).id)
      .eq('status', 'verified'),
  );

  // ── ATOMIC CLAIM APPROVAL ─────────────────────────────────────────────────
  console.log('\nclaim approval transaction:');
  const { data: validClaim, error: validClaimError } = await admin
    .from('facility_claims')
    .insert({
      facility_id: B,
      claimant_email: email('claimant'),
      claimant_name: 'Claimant',
      status: 'pending',
    })
    .select('id')
    .single();
  if (validClaimError || !validClaim) throw new Error(`valid claim seed failed: ${validClaimError?.message}`);
  expectAllowed(
    'service-only claim RPC approves and links owner atomically',
    await admin.rpc('approve_facility_claim', {
      p_claim_id: (validClaim as { id: string }).id,
      p_user_id: claimant,
    }),
  );
  expectRows(
    'approved claim has its owner membership',
    await admin
      .from('facility_members')
      .select('id')
      .eq('facility_id', B)
      .eq('user_id', claimant)
      .eq('role', 'owner'),
  );

  const { data: crossLaneClaim, error: crossLaneClaimError } = await admin
    .from('facility_claims')
    .insert({
      user_id: bd1,
      facility_id: B,
      claimant_email: email('bd1'),
      status: 'pending',
    })
    .select('id')
    .single();
  if (crossLaneClaimError || !crossLaneClaim) {
    throw new Error(`cross-lane claim seed failed: ${crossLaneClaimError?.message}`);
  }
  expectDenied(
    'claim RPC rejects a Partner-to-facility lane takeover',
    await admin.rpc('approve_facility_claim', {
      p_claim_id: (crossLaneClaim as { id: string }).id,
      p_user_id: bd1,
    }),
  );
  expectRows(
    'rejected cross-lane claim remains pending',
    await admin
      .from('facility_claims')
      .select('id')
      .eq('id', (crossLaneClaim as { id: string }).id)
      .eq('status', 'pending'),
  );
  expectDenied(
    'an authenticated browser cannot insert an approved claim',
    await bdc1.from('facility_claims').insert({
      user_id: bd1,
      facility_id: A,
      status: 'approved',
    }).select(),
  );

  // ── ADMIN positive control ──────────────────────────────────────────────────
  console.log('\nadmin:');
  expectRows('admin reads unpublished facility B', await adminClient.from('facilities').select('id').eq('id', B));
  expectRows('admin reads matches', await adminClient.from('matches').select('id').eq('id', matchId));
  expectDenied(
    'admin browser session cannot bypass server-only facility writes',
    await adminClient.from('facilities').update({ plan: 'anchor' }).eq('id', B).select(),
  );
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
