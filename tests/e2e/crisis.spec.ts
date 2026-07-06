import { test, expect } from '@playwright/test';

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
