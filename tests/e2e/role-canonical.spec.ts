import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

test('AUTHZ-LANE-1 · user metadata alone cannot grant Partner or Rep access', () => {
  const auth = source('src/lib/auth.ts');

  expect(auth).toContain('const isPartner = !!bdRes.data;');
  expect(auth).toContain('const isRep = !!repRes.data;');
  expect(auth).not.toMatch(/metaRole\s*===\s*['"]partner['"]/);
  expect(auth).not.toMatch(/metaRole\s*===\s*['"]rep['"]/);
});

test('AUTHZ-LANE-2 · a secondary membership cannot move an admin into the facility lane', () => {
  const auth = source('src/lib/auth.ts');
  const memberGate = auth.slice(
    auth.indexOf('export async function requireFacilityMember'),
    auth.indexOf('/** Gate owner-only team administration'),
  );

  expect(memberGate).toContain("profileType(roles) !== 'facility'");
  expect(memberGate).not.toContain('roles.facilityIds.length === 0');
});

test('AUTHZ-LANE-3 · legacy and representative actions cannot self-create a provider lane', () => {
  expect(fs.existsSync(path.join(process.cwd(), 'src/app/(app)/bd/actions.ts'))).toBe(false);

  const repActions = source('src/app/(app)/rep/actions.ts');
  for (const action of [
    'updateRepProfileAction',
    'addAffiliationAction',
    'removeAffiliationAction',
    'createInviteAction',
    'deleteInviteAction',
  ]) {
    const start = repActions.indexOf(`export async function ${action}`);
    expect(start, `${action} must exist`).toBeGreaterThan(-1);
    const next = repActions.indexOf('\nexport async function ', start + 1);
    const body = repActions.slice(start, next === -1 ? undefined : next);
    expect(body, `${action} must use the canonical Rep gate`).toContain('requireRep()');
  }
  expect(repActions).not.toMatch(/async function uid\(/);
});

test('AUTHZ-LANE-4 · seeker contact edits use the canonical seeker gate', () => {
  const meActions = source('src/app/(app)/me/actions.ts');
  expect(meActions).toContain('await requireSeeker()');
  expect(meActions).not.toContain('requireUser');
});

test('AUTH-LANE-1 · confirmed self-signups materialize canonical membership before routing', () => {
  const callback = source('src/app/auth/callback/route.ts');
  const provision = source('src/lib/auth/provision-canonical.ts');
  const provisionRoute = source('src/app/api/auth/provision/route.ts');
  const partnerSignup = source('src/components/partner/PartnerSignupForm.tsx');
  const repSignup = source('src/components/rep/RepSignupForm.tsx');

  expect(callback).toContain('provisionCanonicalLane');
  expect(provision).toContain('const admin = createAdminClient();');
  expect(provision).toContain("admin.from('bd_users').upsert");
  expect(provision).toContain("admin.from('rep_profiles').upsert");
  expect(provision).toContain('ignoreDuplicates: true');
  expect(callback).toContain('/login?error=profile_setup_failed');
  expect(provisionRoute).toContain('admin.auth.getUser(accessToken)');
  expect(partnerSignup).toContain("role: 'partner'");
  expect(partnerSignup).toContain('partner_type: form.partner_type');
  expect(partnerSignup).toContain("fetch('/api/auth/provision'");
  expect(repSignup).toContain("role: 'rep'");
  expect(repSignup).toContain('headline: form.headline.trim() || null');
  expect(repSignup).toContain("fetch('/api/auth/provision'");
});

test('AUTH-LANE-2 · recovery callbacks cannot overwrite canonical profile data', () => {
  const callback = source('src/app/auth/callback/route.ts');
  const provision = source('src/lib/auth/provision-canonical.ts');

  expect(callback).toContain('provisionCanonicalLane(user)');
  expect(provision).toContain("{ onConflict: 'user_id', ignoreDuplicates: true }");
  expect(provision).not.toMatch(/\.from\('(bd_users|rep_profiles)'\)\.update\(/);
  expect(provision).toContain('This is intentionally insert-only');
});

test('AUTH-LANE-3 · Rep invites are server-validated in both confirmation modes', () => {
  const page = source('src/app/(public)/for-reps/page.tsx');
  const signup = source('src/components/rep/RepSignupForm.tsx');
  const provision = source('src/lib/auth/provision-canonical.ts');

  expect(page).toContain('{ token: invite.token, facilityName: invite.facility.name }');
  expect(signup).toContain('rep_invite_token: invite?.token ?? null');
  expect(signup).toContain('data.session.access_token');
  expect(signup).not.toContain("supabase.from('facility_affiliations').insert");
  expect(provision).toContain(".from('rep_invites')");
  expect(provision).toContain(".eq('token', inviteToken)");
  expect(provision).toContain("admin.from('facility_affiliations').upsert");
});
