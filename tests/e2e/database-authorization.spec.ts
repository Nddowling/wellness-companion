import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

const migration = () => source('supabase/project-a/migrations/38_enforce_provider_authorization_boundaries.sql');

test('DB-AUTHZ-1 · sensitive facility tables are read-only to browser roles', () => {
  const sql = migration();

  expect(sql).toContain('drop policy if exists facilities_update');
  expect(sql).toContain('drop policy if exists facility_payers_write');
  expect(sql).toContain('drop policy if exists facility_capacity_write');
  expect(sql).toContain('drop policy if exists match_routes_update');
  expect(sql).toContain('drop policy if exists matches_insert');
  expect(sql).toMatch(
    /revoke insert, update, delete, truncate, references, trigger on table[\s\S]*public\.facilities,[\s\S]*public\.facility_capacity,[\s\S]*public\.match_routes,[\s\S]*from authenticated;/,
  );
  expect(sql).toContain('and status = \'pending\'');
});

test('DB-AUTHZ-2 · canonical provider lanes are serialized and mutually exclusive', () => {
  const sql = migration();

  expect(sql).toContain('public.enforce_exclusive_provider_lane()');
  expect(sql).toContain('pg_catalog.pg_advisory_xact_lock');
  expect(sql).toContain('create schema if not exists private;');
  expect(sql).toContain("'public.is_admin()'");
  expect(sql).toContain("execute format('alter function %s set schema private', predicate)");
  expect(sql).toContain("tg_table_name <> 'platform_admins'");
  expect(sql).toContain("tg_table_name <> 'facility_members'");
  expect(sql).toContain("tg_table_name <> 'bd_users'");
  expect(sql).toContain("tg_table_name <> 'rep_profiles'");
  expect(sql).toContain('provider_lane_membership_archive');
  expect(sql).toContain('provider lane conflicts require manual review');
});

test('DB-AUTHZ-3 · affiliation verification is status-only and owner/admin authorized', () => {
  const sql = migration();
  const repActions = source('src/app/(app)/rep/actions.ts');

  expect(sql).toContain('public.enforce_facility_affiliation_integrity()');
  expect(sql).toContain('new affiliations must be pending');
  expect(sql).toContain('affiliation identity is immutable');
  expect(sql).toContain('public.set_facility_affiliation_status');
  expect(sql).toContain("member.role = 'owner'");
  expect(sql).toMatch(
    /revoke execute on function public\.set_facility_affiliation_status\(uuid, text\)[\s\S]*from public, anon;/,
  );
  expect(repActions).toContain("supabase.rpc('set_facility_affiliation_status'");
  expect(repActions).not.toMatch(/from\('facility_affiliations'\)[\s\S]{0,120}\.update\(\{ status \}\)/);
});

test('DB-AUTHZ-4 · claim approval links owner and status in one service-only transaction', () => {
  const sql = migration();
  const adminActions = source('src/app/(app)/admin/actions.ts');

  expect(sql).toContain('public.approve_facility_claim');
  expect(sql).toContain('for update;');
  expect(sql).toContain('claim email does not match the auth account');
  expect(sql).toContain('claim approval would cross canonical provider lanes');
  expect(sql).toContain("values (claim_row.facility_id, p_user_id, 'owner')");
  expect(sql).toContain("set status = 'approved', user_id = p_user_id");
  expect(sql).toContain('facility_claims_one_pending_user_request');
  expect(sql).toMatch(
    /revoke execute on function public\.approve_facility_claim\(uuid, uuid\)[\s\S]*from public, anon, authenticated;/,
  );
  expect(adminActions).toContain("admin.rpc('approve_facility_claim'");
  expect(adminActions).toContain('admin.auth.admin.getUserById(claim.user_id)');
  expect(adminActions).toContain('await admin.auth.admin.deleteUser(userId)');
});

test('DB-AUTHZ-5 · server actions preserve provider UI through controlled clients', () => {
  const facilityActions = source('src/app/(app)/facility/actions.ts');
  const partnerActions = source('src/app/(app)/partners/actions.ts');
  const callback = source('src/app/auth/callback/route.ts');
  const provisioning = source('src/lib/auth/provision-canonical.ts');

  for (const action of ['updateCapacity', 'updateProfile', 'updateInsurance', 'updateContact']) {
    const start = facilityActions.indexOf(`export async function ${action}`);
    const next = facilityActions.indexOf('\nexport async function ', start + 1);
    const body = facilityActions.slice(start, next === -1 ? undefined : next);
    expect(body, `${action} must cross the service boundary`).toContain('createAdminClient()');
  }

  expect(partnerActions).toMatch(/from\('bd_users'\)\s*\.update\(/);
  expect(partnerActions).not.toMatch(/from\('bd_users'\)\.upsert/);
  expect(callback).toContain('provisionCanonicalLane(user)');
  expect(provisioning).toContain('const admin = createAdminClient();');
  expect(provisioning).toContain("admin.from('bd_users').upsert");
  expect(provisioning).toContain("admin.from('rep_profiles').upsert");
  expect(provisioning).toContain('ignoreDuplicates: true');
});
