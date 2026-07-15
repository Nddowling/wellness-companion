import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

test('AUTHZ-INVITE-1 · facility staff invites are owner-only and cannot grant ownership', () => {
  const action = read('src/app/(app)/facility/actions.ts');
  const page = read('src/app/(app)/facility/[id]/invite/page.tsx');
  const layout = read('src/app/(app)/layout.tsx');

  expect(action).toContain('await requireFacilityOwner(facilityId)');
  expect(action).toContain("role: 'staff'");
  expect(action).not.toMatch(/formData\.get\(['"]role['"]\)/);
  expect(page).toContain('await requireFacilityOwner(id)');
  expect(page).not.toContain('<option value="owner">');
  expect(layout).toContain("membership.role === 'owner'");
});

test('AUTH-INVITE-1 · staff onboarding never relays passwords or contact data in redirect URLs', () => {
  const action = read('src/app/(app)/facility/actions.ts');
  const page = read('src/app/(app)/facility/[id]/invite/page.tsx');
  const template = read('src/lib/email/templates.ts');
  const staffTemplate = template.slice(
    template.indexOf('export function staffInviteEmail'),
    template.indexOf('// Provider claim approved'),
  );

  expect(action).toContain('generateSetPasswordUrl(admin, email)');
  expect(action).not.toMatch(/[?&](?:tmp|email)=/);
  expect(action).not.toContain('tempPw');
  expect(page).not.toContain('Temporary password');
  expect(staffTemplate).not.toContain('Temporary password');
  expect(staffTemplate).not.toContain('password?:');
});

test('AUTHZ-CLAIM-1 · approved ownership claims receive owner role, including historical repair', () => {
  const action = read('src/app/(app)/admin/actions.ts');
  const migration = read('supabase/project-a/migrations/34_promote_approved_claim_owners.sql');

  expect(action).toContain("{ facility_id: claim.facility_id, user_id: userId, role: 'owner' }");
  expect(migration).toContain("claim.status = 'approved'");
  expect(migration).toContain("set role = 'owner'");
  expect(migration).toContain('from auth.users as auth_user');
});
