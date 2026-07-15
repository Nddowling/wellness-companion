import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

function serverAction(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  const next = source.indexOf('\nexport async function ', start + 1);
  expect(start, `${name} server action must exist`).toBeGreaterThanOrEqual(0);
  return source.slice(start, next === -1 ? undefined : next);
}

test('PROVIDER-RELIABILITY-1 · lead acceptance is exact, atomic, and monotonic downstream', () => {
  const actions = read('src/app/(app)/facility/actions.ts');
  const leadAction = serverAction(actions, 'setLeadStatus');
  const migration = read('supabase/project-a/migrations/43_provider_reliability_transactions.sql');

  expect(leadAction).toContain("admin.rpc('set_provider_lead_status'");
  expect(leadAction).toContain('await requireFacilityMember()');
  expect(leadAction).toContain('facilityIds.includes(facilityId)');
  expect(leadAction).toContain('p_route_id: routeId');
  expect(leadAction).toContain('p_facility_id: facilityId');
  expect(leadAction).toContain('transitionError || !transition');
  expect(leadAction).not.toMatch(/from\('match_routes'\)\.update/);

  expect(migration).toContain('where route.id = p_route_id');
  expect(migration).toContain('and route.facility_id = p_facility_id');
  expect(migration).toContain('for update;');
  expect(migration).toContain('security invoker');
  expect(migration).toContain("when match.status in ('open', 'routed') then 'connected'");
  expect(migration).toContain("and seeker.status = 'active'");
  expect(migration).toContain('and seeker.consent_share');
  expect(migration).toMatch(
    /revoke all on function public\.set_provider_lead_status\(uuid, uuid, text\)[\s\S]*from public, anon, authenticated;/,
  );
});

test('PROVIDER-RELIABILITY-2 · profile/contact writes prove one affected facility row', () => {
  const actions = read('src/app/(app)/facility/actions.ts');

  for (const name of ['updateProfile', 'updateContact']) {
    const body = serverAction(actions, name);
    expect(body, `${name} must request an affected-row result`).toContain(".select('id')");
    expect(body, `${name} must distinguish a missing row from success`).toMatch(/if \(error \|\| !updated\)/);
    expect(body, `${name} must report a safe operation failure`).toContain('providerDatabaseFailure(');
  }

  expect(actions).toContain("console.error('[provider-workspace] database operation failed'");
  expect(actions).not.toMatch(/\[provider-workspace\][\s\S]{0,240}error\.message/);
});

test('PROVIDER-RELIABILITY-3 · payer rows and named carriers replace atomically', () => {
  const actions = read('src/app/(app)/facility/actions.ts');
  const insuranceAction = serverAction(actions, 'updateInsurance');
  const migration = read('supabase/project-a/migrations/43_provider_reliability_transactions.sql');

  expect(insuranceAction).toContain("admin.rpc('replace_facility_insurance'");
  expect(insuranceAction).toContain('await requireFacilityMember()');
  expect(insuranceAction).toContain('facilityIds.includes(facilityId)');
  expect(insuranceAction).toContain('error ||');
  expect(insuranceAction).toContain('replacement.updated_facility_id !== facilityId');
  expect(insuranceAction).not.toContain("from('facility_payers')");
  expect(insuranceAction).not.toContain("from('facilities')");

  expect(migration).toContain('create or replace function public.replace_facility_insurance');
  expect(migration).toContain('delete from public.facility_payers');
  expect(migration).toContain('insert into public.facility_payers');
  expect(migration).toContain('update public.facilities as facility');
  expect(migration).toContain("'low'");
  expect(migration).toMatch(
    /revoke all on function public\.replace_facility_insurance\(uuid, text\[\], text\[\]\)[\s\S]*from public, anon, authenticated;/,
  );
});

test('PROVIDER-RELIABILITY-4 · facility contacts fail visibly on every database read error', () => {
  const contacts = read('src/lib/facility/contacts.ts');

  expect(contacts).toContain("if (routesError) contactReadFailure('routes', routesError)");
  expect(contacts).toContain("if (interestsError) contactReadFailure('interests', interestsError)");
  expect(contacts).toContain("if (seekersError) contactReadFailure('seekers', seekersError)");
  expect(contacts).not.toContain('fall back to de-identified only');
  expect(contacts).not.toMatch(/catch\s*\{\s*\/\* lead store unavailable/);
  expect(contacts).toContain("console.error('[facility-contacts] database read failed'");
  expect(contacts).not.toContain('error.message');
});
