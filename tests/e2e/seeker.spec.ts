import { test, expect } from '@playwright/test';

import { trackConsoleErrors, previewOnly, QA_TAG } from './helpers';

/**
 * Seeker journeys — merged from clearbed-qa-agent, selectors/routes verified against
 * the real app. Prod-safe reads run anywhere; the match WRITE is previewOnly().
 */

// ============ PROD-SAFE: read-only ============

test('SK-01 · homepage renders the core promise', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /you don.?t have to figure this out alone/i })
  ).toBeVisible();
  await expect(page.getByText(/no account required/i).first()).toBeVisible();
  expect(errors, `Console errors: ${errors.join(' | ')}`).toHaveLength(0);
});

test('SK-02 · directory hub pages load without error', async ({ page }) => {
  for (const path of ['/programs', '/insurance', '/guides', '/library', '/pricing', '/how-we-make-money']) {
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(res?.status(), `${path}`).toBeLessThan(400);
    await expect(page.locator('body')).not.toContainText(/application error|something went wrong/i);
  }
});

test('SK-03 · a program profile renders a heading and a way to act', async ({ page }) => {
  await page.goto('/programs');
  const firstCard = page.locator('a[href*="/programs/"]').first();
  // Empty directory is a valid state — only assert the detail contract if a card exists.
  if ((await firstCard.count()) === 0) test.skip(true, 'No programs listed on target');
  await firstCard.click();
  await expect(page.getByRole('heading').first()).toBeVisible();
  const action = page.locator('a[href^="tel:"], a:has-text("contact"), button:has-text("contact")');
  await expect(action.first()).toBeVisible();
});

test('SK-04 · homepage internal links respond (light crawl)', async ({ page, request }) => {
  test.slow();
  await page.goto('/');
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href));
  const origin = new URL(page.url()).origin;
  const internal = [...new Set(hrefs)]
    .filter((h) => h.startsWith(origin) && !h.startsWith('tel:') && !h.startsWith('mailto:'))
    .slice(0, 50);
  const broken: string[] = [];
  for (const url of internal) {
    const res = await request.get(url).catch(() => null);
    if (!res || res.status() >= 400) broken.push(`${url} → ${res?.status() ?? 'unreachable'}`);
  }
  expect(broken, `Broken links:\n${broken.join('\n')}`).toHaveLength(0);
});

// ============ PREVIEW-ONLY: writes to the seeker vault ============

test('SK-05 · match page loads the chat (no login wall)', async ({ page }) => {
  await page.goto('/match');
  await expect(page.locator('body')).not.toContainText(/sign in|log in/i);
});

test('SK-06 · match flow submits a QA-tagged seeker', async ({ page }) => {
  previewOnly(); // creates vault_seekers rows + may notify facilities — NEVER on prod
  await page.goto('/match');
  // TODO: drive the real conversational flow end-to-end. Always identify as QA so the
  // row is greppable/deletable — use a name containing QA_TAG and a qa+ email.
  test.fixme(true, `Map the /match conversation steps, then submit as "${QA_TAG} Seeker"`);
});
