import { expect, test } from '@playwright/test';

const MOBILE_PUBLIC_ROUTES = [
  '/',
  '/programs',
  '/treatment',
  '/insurance',
  '/guides',
  '/resources',
  '/library',
  '/data',
  '/contact',
  '/pricing',
  '/claim',
  '/match',
  '/login',
];

test.describe('MOBILE-LAYOUT · 320px public-route regression', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'One explicit 320px pass avoids duplicating the mobile project.');
    await page.setViewportSize({ width: 320, height: 740 });
  });

  for (const path of MOBILE_PUBLIC_ROUTES) {
    test(`${path} stays inside the visual viewport`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toHaveCount(1);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
        .toBeLessThanOrEqual(1);
    });
  }

  test('homepage hero content is not silently clipped', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    for (const locator of [
      page.getByRole('heading', { level: 1 }),
      page.getByRole('button', { name: /search treatment/i }).first(),
    ]) {
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(321);
    }
  });

  test('facility contact action sits above the public tab bar', async ({ page }) => {
    await page.goto('/programs', { waitUntil: 'domcontentloaded' });
    const firstProgram = page.locator('a[href^="/programs/"]').first();
    test.skip((await firstProgram.count()) === 0, 'No published program exists in this environment.');
    await firstProgram.click();
    await expect(page).toHaveURL(/\/treatment\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const contact = page.locator('[data-sticky-contact]');
    await expect.poll(() => contact.evaluate((element) =>
      Object.keys(element).some((key) => key.startsWith('__reactProps')),
    )).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 650));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(480);
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await expect(contact).toHaveClass(/translate-y-0/);

    const tabs = page.getByRole('navigation', { name: 'Primary' });
    await expect(contact).toBeVisible();
    await expect(tabs).toBeVisible();
    await expect.poll(async () => {
      const [contactBox, tabBox] = await Promise.all([contact.boundingBox(), tabs.boundingBox()]);
      if (!contactBox || !tabBox) return Number.POSITIVE_INFINITY;
      return contactBox.y + contactBox.height - tabBox.y;
    }).toBeLessThanOrEqual(2);
  });
});
