import { test, expect } from '@playwright/test';

import { detectCrisis, type CrisisCategory } from '../../src/lib/intake/crisis';
import { expectCrisisReachable } from './helpers';

/**
 * SMOKE-CRISIS (P0) — for a recovery directory, unreachable crisis resources is a
 * site-down-level failure. Merged from clearbed-qa-agent, routes corrected to the
 * real public pages.
 */

const KEY_PAGES = ['/', '/programs', '/match', '/for-providers', '/about', '/privacy'];

for (const path of KEY_PAGES) {
  test(`CRISIS-P0 · 988 reachable on ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expectCrisisReachable(page);
  });
}

test('CRISIS-P0 · 988 + 911 visible in homepage footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="tel:988"]').first()).toBeVisible();
  await expect(page.locator('a[href="tel:911"]').first()).toBeVisible();
});

test('CRISIS-GATE · retired AI intake cannot accept a treatment or crisis narrative', async ({ request }) => {
  const response = await request.post('/api/intake', {
    data: {
      step: 'need',
      messages: [{ role: 'user', content: 'A narrative that must not reach a model.' }],
    },
  });
  expect(response.status()).toBe(410);
});

const nonCrisisStatements = [
  'I am not suicidal.',
  'I do not self-harm.',
  'I survived an overdose ten years ago.',
  'My brother died by suicide years ago.',
  'I am not withdrawing from alcohol.',
  'I am no longer suicidal and am looking for outpatient programs.',
  'I did not overdose. I am looking for residential treatment.',
];

for (const content of nonCrisisStatements) {
  test(`CRISIS-PRECISION · does not latch clearly negated or remote statement: ${content}`, () => {
    expect(detectCrisis([{ role: 'user', content }])).toBeNull();
  });
}

const currentOrAmbiguousStatements: Array<{
  content: string;
  category: CrisisCategory;
}> = [
  { content: 'I am not sure whether I might be suicidal.', category: 'suicide_or_self_harm' },
  { content: 'I am not suicidal, but I plan to hurt myself tonight.', category: 'suicide_or_self_harm' },
  { content: 'I cannot promise I am not suicidal.', category: 'suicide_or_self_harm' },
  { content: 'I want to die after what happened years ago.', category: 'suicide_or_self_harm' },
  { content: 'I am suicidal, and my brother died years ago.', category: 'suicide_or_self_harm' },
  { content: 'My brother died by suicide years ago, but I might be suicidal now.', category: 'suicide_or_self_harm' },
  { content: 'My roommate may have overdosed and I cannot wake him.', category: 'overdose_or_medical_emergency' },
  { content: 'Years ago I overdosed, and I overdosed again.', category: 'overdose_or_medical_emergency' },
  { content: 'I survived an overdose years ago and overdosed again today.', category: 'overdose_or_medical_emergency' },
  { content: 'Someone may have poisoned me.', category: 'poisoning' },
  { content: 'I may be withdrawing from alcohol.', category: 'dangerous_withdrawal' },
  { content: 'He has a weapon and is threatening to hurt me now.', category: 'violence_or_immediate_danger' },
];

for (const { content, category } of currentOrAmbiguousStatements) {
  test(`CRISIS-PRECISION · latches current or ambiguous danger: ${content}`, () => {
    expect(detectCrisis([{ role: 'user', content }])?.categories).toContain(category);
  });
}
