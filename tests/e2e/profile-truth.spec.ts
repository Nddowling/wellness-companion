import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const root = process.cwd();
const profileSource = fs.readFileSync(
  path.join(root, 'src/components/facility/FacilityProfileView.tsx'),
  'utf8',
);
const providerEditorSource = fs.readFileSync(
  path.join(root, 'src/app/(app)/facility/[id]/page.tsx'),
  'utf8',
);
const providerActionsSource = fs.readFileSync(
  path.join(root, 'src/app/(app)/facility/actions.ts'),
  'utf8',
);
const planSource = fs.readFileSync(path.join(root, 'src/lib/facility/plan.ts'), 'utf8');
const pricingSource = fs.readFileSync(path.join(root, 'src/components/PricingTable.tsx'), 'utf8');
const forProvidersSource = fs.readFileSync(
  path.join(root, 'src/app/(public)/for-providers/page.tsx'),
  'utf8',
);

test('PROFILE-TRUTH-1 · generic update timestamps never become profile check dates', () => {
  expect(profileSource).not.toContain('f.updated_at');
  expect(profileSource).toContain('lastVerified={f.last_verified ?? null}');
  expect(profileSource).toContain('verifiedAt={f.verified_at ?? null}');
  expect(profileSource).toContain("verifiedBy === 'samhsa_import'");
  expect(profileSource).toContain('SAMHSA directory import');
  expect(profileSource).toContain('directory source imported');
  expect(profileSource).not.toContain('View directory source');
});

test('PROFILE-TRUTH-2 · unscoped legacy cash amounts are neither published nor newly edited', () => {
  expect(profileSource).not.toContain('f.cash_rate');
  expect(profileSource).not.toContain('priceRange');
  expect(providerEditorSource).not.toContain('name="cash_rate"');
  expect(providerActionsSource).not.toContain("formData.get('cash_rate')");
  expect(providerActionsSource).not.toMatch(/\.update\(\{[\s\S]*?\bcash_rate\b/);
});

test('PROFILE-TRUTH-3 · public profile richness has no subscription-plan gate', () => {
  expect(profileSource).not.toContain('normalizePlan');
  expect(profileSource).not.toContain('planAllows');
  expect(profileSource).toContain('hasFullPublicProfile(f.facility_claims)');
});

test('PROFILE-TRUTH-4 · larger-team seats require a documented custom arrangement', () => {
  expect(planSource).not.toContain('EXTRA_SEAT_PRICE_MONTHLY');
  expect(pricingSource).not.toContain('$69.99');
  expect(forProvidersSource).not.toContain('$69.99');
  expect(pricingSource).not.toContain('Most popular');
  expect(forProvidersSource).not.toContain('Most popular');
  expect(pricingSource).toContain('Larger teams require a documented custom arrangement');
  expect(pricingSource).toContain('Includes lead-status workflow');
});
