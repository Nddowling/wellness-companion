import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, 'supabase/project-a/migrations/32_match_directory_options.sql'),
  'utf8',
);
const sql = migration.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
const nearbyMigration = fs.readFileSync(
  path.join(root, 'supabase/project-a/migrations/20261013181809_guided_nearby_match.sql'),
  'utf8',
);
const nearbySql = nearbyMigration.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
const route = fs.readFileSync(path.join(root, 'src/app/api/match/route.ts'), 'utf8');
const handoffRoute = fs.readFileSync(path.join(root, 'src/app/api/handoff/route.ts'), 'utf8');
const handoffToken = fs.readFileSync(path.join(root, 'src/lib/matching/handoff-token.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/app/(public)/match/page.tsx'), 'utf8');

test('MATCH-SQL-1 · legacy ZIP3 matcher remains bounded and service-role-only', () => {
  expect(sql).toContain('create or replace function public.match_directory_options(');
  expect(sql).toContain('from public.facilities f');
  expect(sql.match(/\blimit\b/g)).toHaveLength(1);
  expect(sql).toContain('limit least(greatest(coalesce(p_limit, 3), 1), 10)');
  expect(sql).toContain('security invoker');
  expect(sql).toContain('set search_path = public, pg_temp');
  expect(sql).toContain(
    'revoke all on function public.match_directory_options(text, text, text, text, text, integer) from public, anon, authenticated',
  );
  expect(sql).toContain(
    'grant execute on function public.match_directory_options(text, text, text, text, text, integer) to service_role',
  );
});

test('MATCH-SQL-2 · legacy hard filters use source-backed directory fields without monetization influence', () => {
  expect(sql).toContain("p_concern_category <> 'mental_health'");
  expect(sql).toContain("p_concern_category <> 'co_occurring'");
  expect(sql).toContain('yes|co.?occurring|dual|integrated|both');
  expect(sql).toContain('no|none|not[[:space:]_-]+offered');
  expect(sql).toContain('p_care_level = any(f.levels_of_care)');
  expect(sql).toContain('from public.facility_payers fp');
  expect(sql).toContain('fp.payer_type = p_payer_type');
  expect(sql).toContain('lower(listed_carrier.name) = lower(p_payer_carrier)');
  expect(sql).not.toMatch(/\b(?:is_gated|is_faith_based|in_network|cash_rate|plan)\b/);
});

test('MATCH-SQL-3 · legacy availability ranking uses only timely residential reports', () => {
  expect(sql).toContain("p_care_level = 'residential'");
  expect(sql).toContain("c.level_of_care = 'residential'");
  expect(sql).toContain('e.reported_beds > 0');
  expect(sql).toContain("e.reported_at >= now() - interval '7 days'");
  expect(sql).toContain("e.reported_at <= now() + interval '5 minutes'");
  expect(sql).toContain("e.reported_at >= now() - interval '3 days'");
  expect(sql).toContain('case when n.region_match then 12 else 0 end');
  expect(sql).toContain(
    'order by s.score desc, s.beds_available desc, lower(s.name) asc, s.name asc, s.id asc',
  );
});

test('MATCH-SQL-3A · guided matcher filters first, then ranks by full-ZIP-origin miles', () => {
  expect(nearbySql).toContain('create function public.match_directory_options_nearby(');
  expect(nearbySql).toContain('from public.facilities f');
  expect(nearbySql).toContain('p_olat double precision');
  expect(nearbySql).toContain('p_olng double precision');
  expect(nearbySql).toContain('3958.7613 * acos(');
  expect(nearbySql).toMatch(/and f\.is_published.*?and p_concern_category <> 'mental_health'.*?and p_care_level = any\(f\.levels_of_care\).*?and exists \( select 1 from public\.facility_payers fp.*?\).*?and \( p_payer_carrier is null or exists \(/);
  expect(nearbySql).toContain("p_concern_category <> 'co_occurring'");
  expect(nearbySql).toContain('lower(listed_carrier.name) = lower(p_payer_carrier)');
  expect(nearbySql).toContain('from normalized n order by n.miles nulls last');
  expect(nearbySql).toContain('limit least(greatest(coalesce(p_limit, 3), 1), 10)');
  expect(nearbySql).not.toContain('zip3 = p_region_zip3');
  expect(nearbySql).not.toMatch(/\b(?:is_gated|is_faith_based|in_network|cash_rate|plan)\b/);
});

test('MATCH-SQL-3B · new distance RPC cannot be called directly by browser roles', () => {
  expect(nearbySql).toContain('security invoker');
  expect(nearbySql).toContain("set search_path = ''");
  expect(nearbySql).toContain(
    'revoke all on function public.match_directory_options_nearby( double precision, double precision, text, text, text, text, integer ) from public, anon, authenticated',
  );
  expect(nearbySql).toContain(
    'grant execute on function public.match_directory_options_nearby( double precision, double precision, text, text, text, text, integer ) to service_role',
  );
});

test('MATCH-SQL-4 · match API resolves full ZIP but persists only a coarse match summary', () => {
  expect(route).toMatch(/\.rpc\(\s*['"]match_directory_options_nearby['"]/);
  expect(route).toContain("resolveSearchLocation({ kind: 'zip', zip: zipCode })");
  expect(route).toContain('zip_code: zipCode');
  expect(route).toContain('p_region_zip3: intake.region_zip3');
  expect(route).not.toContain(".rpc('match_directory_options'");
  expect(route).not.toMatch(/\.from\(['"]facilities['"]\)/);
  expect(route).not.toContain('rankFacilities');
  expect(route).not.toContain('coverage_status');
  expect(route).toContain("return 'Unexpected intake field'");
  expect(route).toContain(".rpc('record_directory_match'");
  expect(route).not.toMatch(/\.from\(['"]matches['"]\)\s*\.insert\(/);
  expect(route).not.toMatch(/\.from\(['"]match_routes['"]\)\s*\.insert\(/);
  expect(route).toMatch(/keyedSecurityDigest\(\s*['"]match-idempotency['"]/);
  expect(route).toContain("keyedSecurityDigest('match-payload'");
  expect(route).toMatch(/issueHandoffToken\(\s*recorded\.recorded_match_id,\s*ranked\.map/);
  expect(route).toContain("responseHeaders.append('Set-Cookie', handoffCookie(token))");
  expect(route).toContain('miles: typeof r.miles');
  expect(route).toContain('distanceBasis:');
});

test('MATCH-SQL-5 · handoff capability is bound to exactly the displayed recipients', () => {
  expect(handoffToken).toContain('recipientFacilityIds: [...recipientFacilityIds]');
  expect(handoffToken).toContain('recipientFacilityIds: Object.freeze');
  expect(handoffRoute).toContain('capability.recipientFacilityIds');
  expect(handoffRoute).not.toMatch(/\.from\(['"]match_routes['"]\)/);
  expect(handoffRoute).toContain('recipientFacilityIds: facilities.map');
  expect(handoffRoute).toContain("consumeAnonymousBudget(request, 'handoff')");
  expect(handoffRoute).toContain('readBoundedJson(request, MAX_BODY_BYTES)');
});

test('MATCH-SQL-6 · browser retries are idempotent and distance semantics are explicit', () => {
  expect(page).toContain("const matchRequestKeyRef = useRef<string | null>(null)");
  expect(page).toContain("'Idempotency-Key': requestKey");
  expect(page).toContain('matchRequestKeyRef.current = null');
  expect(page).toContain('zip_code: zipCode');
  expect(page).toContain('ordered by approximate distance from ZIP');
  expect(page).toContain('Only the first three digits are saved with your match.');
  expect(page).not.toContain('Outside your requested ZIP3 region');
});
