import { expect, test } from '@playwright/test';

import {
  effectivePlan,
  hasFullPublicProfile,
  INCLUDED_SEATS,
  normalizePlan,
  photoLimit,
  planAllows,
  seatLimit,
} from '../../src/lib/facility/plan';

test('PLAN-P0 · paid tooling requires an active subscription or lifetime grant', () => {
  expect(effectivePlan('growth', 'active')).toBe('growth');
  expect(effectivePlan('anchor', 'lifetime')).toBe('anchor');
  expect(effectivePlan('free', 'active')).toBe('free');

  for (const status of ['past_due', 'canceled', 'trialing', 'legacy', '', null, undefined]) {
    expect(effectivePlan('anchor', status)).toBe('free');
  }
});

test('PLAN-P0 · active legacy tier names normalize before authorization', () => {
  expect(effectivePlan('verified', 'active')).toBe('starter');
  expect(effectivePlan('premium', 'lifetime')).toBe('growth');
});

test('PROFILE-P0 · public profile entitlement matrix is claim-first and payment-neutral', () => {
  expect(hasFullPublicProfile(undefined)).toBe(false);
  expect(hasFullPublicProfile([])).toBe(false);
  expect(hasFullPublicProfile([{ status: 'pending' }, { status: 'rejected' }])).toBe(false);
  expect(hasFullPublicProfile([{ status: 'approved' }])).toBe(true);
});

test('PROFILE-P1 · payment never controls access to seeker-consented contact details', () => {
  expect(planAllows('free', 'seekerContacts')).toBe(true);
  expect(planAllows('starter', 'seekerContacts')).toBe(true);
  expect(planAllows('growth', 'seekerContacts')).toBe(true);
  expect(planAllows('anchor', 'seekerContacts')).toBe(true);
});

test('PLAN-P0 · paid entitlements map only to implemented dashboard consumers', () => {
  expect(planAllows('free', 'basicAnalytics')).toBe(false);
  expect(planAllows('starter', 'basicAnalytics')).toBe(true);
  expect(planAllows('starter', 'followUpWorkflow')).toBe(false);
  expect(planAllows('growth', 'followUpWorkflow')).toBe(true);
  expect(planAllows('growth', 'fullAnalytics')).toBe(false);
  expect(planAllows('anchor', 'fullAnalytics')).toBe(true);
});

test('PLAN-P1 · every plan has the same profile gallery and documented seat model', () => {
  expect(['free', 'starter', 'growth', 'anchor'].map((plan) => photoLimit(normalizePlan(plan)))).toEqual([
    10, 10, 10, 10,
  ]);
  expect(INCLUDED_SEATS).toBe(2);
  expect(seatLimit(0)).toBe(2);
  // A non-zero stored allowance represents a manually documented custom arrangement.
  expect(seatLimit(3)).toBe(5);
});
