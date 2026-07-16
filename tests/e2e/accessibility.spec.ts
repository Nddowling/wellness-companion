import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const PUBLIC_PAGES = ['/', '/programs', '/match', '/privacy', '/pricing'];

for (const path of PUBLIC_PAGES) {
  test(`A11Y · ${path} · semantic landmark, named controls, and image alternatives`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading').first()).toBeVisible();
    expect(await page.locator('img:not([alt])').count()).toBe(0);

    const unnamedButtons = await page.locator('button').evaluateAll((buttons) =>
      buttons.filter((button) => {
        const name = button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent?.trim();
        return !name;
      }).length,
    );
    expect(unnamedButtons).toBe(0);
  });
}

test('A11Y · match acknowledgment is keyboard-operable with an accessible checkbox', async ({ page }) => {
  await page.goto('/match', { waitUntil: 'domcontentloaded' });
  const dialog = page.getByRole('dialog', { name: /clear bed recovery companion/i });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');

  const checkbox = page.getByRole('checkbox');
  await expect(checkbox).toHaveAccessibleName(/understand|reviewed|agree/i);
  await expect(checkbox).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Space');
  await page.getByRole('button', { name: /let.?s begin/i }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: /what kind of program/i })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Detox services/i })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: /directory questions progress/i })).toHaveAttribute(
    'aria-valuenow',
    /\d+/,
  );
  await expect(page.getByRole('region', { name: /clear bed directory guide/i })).toBeVisible();
});

test('A11Y · treatment search dialog focuses the field, closes on Escape, and restores focus', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const trigger = page.getByRole('button', { name: /search treatment/i }).first();
  await expect.poll(() => trigger.evaluate((element) =>
    Object.keys(element).some((key) => key.startsWith('__reactProps')),
  )).toBe(true);
  await trigger.focus();
  await trigger.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Find treatment' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('textbox', { name: /describe the treatment/i })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('A11Y · program autocomplete supports active-descendant keyboard navigation', async ({ page }) => {
  await page.goto('/programs', { waitUntil: 'domcontentloaded' });
  const combobox = page.getByRole('combobox', { name: /find a program by name or city/i });
  await expect.poll(() => combobox.evaluate((element) =>
    Object.keys(element).some((key) => key.startsWith('__reactProps')),
  )).toBe(true);

  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
      if (url.endsWith('/api/facilities/search')) {
        return Promise.resolve(new Response(JSON.stringify({
        facilities: [
          { id: 'program-one', name: 'Clear Path Center', city: 'Atlanta', state: 'GA' },
          { id: 'program-two', name: 'Clear Harbor', city: 'Savannah', state: 'GA' },
        ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return nativeFetch(input, init);
    };
  });

  await combobox.fill('Clear');
  await expect(page.getByRole('listbox', { name: /program search results/i })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('2 programs found');

  await combobox.press('ArrowDown');
  await combobox.press('ArrowDown');
  await expect(page.getByRole('option', { name: /clear harbor/i })).toHaveAttribute('aria-selected', 'true');
  await expect(combobox).toHaveAttribute('aria-activedescendant', /option-1$/);

  await combobox.press('Escape');
  await expect(page.getByRole('listbox', { name: /program search results/i })).toBeHidden();
  await expect(combobox).toHaveAttribute('aria-expanded', 'false');
});

test('A11Y · partner autocomplete and facility gallery retain semantic keyboard controls', () => {
  const lookup = source('src/components/partner/ProgramLookup.tsx');
  const combobox = source('src/components/search/useProgramCombobox.ts');
  const gallery = source('src/components/Gallery.tsx');

  expect(lookup).toContain('role="listbox"');
  expect(lookup).toContain('aria-activedescendant');
  expect(lookup).toContain('role="status"');
  expect(combobox).toContain("event.key === 'ArrowDown'");
  expect(gallery).toContain('<Dialog');
  expect(gallery).toContain('aria-label="Previous photo"');
  expect(gallery).toContain('aria-label="Next photo"');
  expect(gallery).toContain("event.key === 'ArrowLeft'");
});
