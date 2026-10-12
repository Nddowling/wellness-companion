import { expect, test, type Page } from '@playwright/test';

const FACILITY_ID = '7fc84b7a-1b35-42a3-8d9f-13c012f03a78';
const FACILITY_NAME = '12 South Recovery';
const FACILITY_PATH = `/programs/${FACILITY_ID}`;

async function mockFacilityLookup(page: Page) {
  const requests: { method: string; url: string; query: unknown }[] = [];

  await page.route('**/api/facilities/search', async (route) => {
    const request = route.request();
    requests.push({
      method: request.method(),
      url: request.url(),
      query: request.method() === 'POST' ? request.postDataJSON()?.q : null,
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        facilities: [{ id: FACILITY_ID, name: FACILITY_NAME, city: 'Lake Forest', state: 'CA' }],
      }),
    });
  });

  // A synthetic lookup hit does not exist in the local database. Keep the test
  // on its requested destination rather than following the real legacy route's
  // database-backed redirect to the canonical profile.
  await page.route(`**${FACILITY_PATH}*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><h1>Mock profile</h1></body></html>',
    });
  });

  return requests;
}

async function openSearchDialog(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const trigger = page.getByRole('button', { name: /search treatment/i }).first();
  await expect.poll(() => trigger.evaluate((element) =>
    Object.keys(element).some((key) => key.startsWith('__reactProps')),
  )).toBe(true);
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Find treatment' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('facility-name search suggests matching programs and navigates on click', async ({ page }) => {
  const requests = await mockFacilityLookup(page);
  const dialog = await openSearchDialog(page);
  const name = dialog.getByRole('combobox', { name: 'Search by program name' });
  const location = dialog.getByRole('textbox', { name: 'City or ZIP code' });

  await expect(name).toBeVisible();
  await expect(location).toBeVisible();
  await name.fill(FACILITY_NAME);
  await expect(location).toHaveValue('');
  await expect(dialog.getByRole('listbox', { name: 'Program search results' })).toBeVisible();
  await expect(dialog.getByRole('option', { name: /12 south recovery/i })).toContainText('Lake Forest, CA');

  expect(requests).toEqual([{
    method: 'POST',
    url: new URL('/api/facilities/search', page.url()).toString(),
    query: FACILITY_NAME,
  }]);
  await dialog.getByRole('option', { name: /12 south recovery/i }).click();
  await expect(page).toHaveURL(new RegExp(`${FACILITY_PATH}$`));
  expect(page.url()).not.toContain(encodeURIComponent(FACILITY_NAME));
  expect(page.url()).not.toContain('?q=');
});

test('facility-name search supports ArrowDown and Enter without changing city search', async ({ page }) => {
  const requests = await mockFacilityLookup(page);
  const dialog = await openSearchDialog(page);
  const name = dialog.getByRole('combobox', { name: 'Search by program name' });

  await name.fill(FACILITY_NAME);
  await expect(dialog.getByRole('option', { name: /12 south recovery/i })).toBeVisible();
  await name.press('ArrowDown');
  await expect(dialog.getByRole('option', { name: /12 south recovery/i })).toHaveAttribute('aria-selected', 'true');
  await name.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${FACILITY_PATH}$`));
  expect(page.url()).not.toContain(FACILITY_NAME);
  expect(requests).toHaveLength(1);

  // The location input remains a distinct field; it does not issue a facility
  // name lookup simply because someone enters a city or ZIP.
  const newDialog = await openSearchDialog(page);
  const cityOrZip = newDialog.getByRole('textbox', { name: 'City or ZIP code' });
  await cityOrZip.fill('31401');
  await expect(newDialog.getByRole('combobox', { name: 'Search by program name' })).toHaveValue('');
  await expect(cityOrZip).toHaveValue('31401');
  await page.waitForTimeout(400); // longer than the name autocomplete's 250 ms debounce
  expect(requests).toHaveLength(1);
});

test('interior header preserves care-search focus while exposing program-name search', async ({ page }) => {
  // /guides and /programs share SiteHeader; /guides does not require the
  // directory's privileged server-side RPCs in this public-key-only test.
  await page.goto('/guides', { waitUntil: 'domcontentloaded' });
  const trigger = page.getByRole('button', { name: 'Search treatment' });
  await expect.poll(() => trigger.evaluate((element) =>
    Object.keys(element).some((key) => key.startsWith('__reactProps')),
  )).toBe(true);
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Find treatment' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Describe the treatment you are looking for' })).toBeFocused();
  await expect(dialog.getByRole('combobox', { name: 'Search by program name' })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'City or ZIP code' })).toBeVisible();
});
