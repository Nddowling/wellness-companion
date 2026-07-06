import { test, expect } from '@playwright/test';

import { PUBLIC_ROUTES, APP_ROUTES } from './routes';

/**
 * §1 Access-control matrix — the anon slice.
 *
 * These need NO seeded users, so they run everywhere out of the box:
 *   - public routes render for anon (AC-P*)
 *   - every authed-shell route bounces anon to /login (AC-A0)
 *
 * The role-lane cross-checks (AC-1..AC-19, a signed-in user hitting another lane)
 * require seeded users — see access-control.authed.spec.ts, which self-skips until
 * test credentials are wired in.
 */

test.describe('§1a public routes render for anon', () => {
  for (const { id, path } of PUBLIC_ROUTES) {
    test(`${id} · GET ${path} · anon · 200`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(res, `no response for ${path}`).not.toBeNull();
      expect(res!.status(), `${path} should render`).toBeLessThan(400);
      // Landed on the intended page, not bounced to login.
      expect(page.url()).not.toContain('/login?');
    });
  }
});

test.describe('§1b authed shell bounces anon', () => {
  for (const { id, path } of APP_ROUTES) {
    test(`AC-A0/${id} · GET ${path} · anon · →login`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
