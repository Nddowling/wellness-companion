import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  coarseDirectoryHref,
  insuranceDestination,
  parseDirectoryLanguage,
  withApproximateState,
} from '../../src/lib/search/directory-language';

test('SEARCH-PRIVACY-1 · raw treatment text is reduced to allow-listed coarse filters', () => {
  const raw = 'Need detox after a relapse in Georgia with Medicaid';
  const href = coarseDirectoryHref(raw);

  expect(href).toBe('/programs?level=detox&pay=medicaid&region=GA');
  expect(href).not.toContain('relapse');
  expect(coarseDirectoryHref('A personal clinical story with no coarse filter')).toBe('/programs');
});

test('SEARCH-PAYER-1 · named carriers never widen to generic commercial results', () => {
  expect(insuranceDestination({ slug: 'aetna', kind: 'commercial', payerType: 'commercial' })).toBe(
    '/insurance/aetna',
  );
  expect(coarseDirectoryHref('detox that accepts Aetna')).toBe('/insurance/aetna');
  expect(insuranceDestination({ slug: 'medicaid', kind: 'public', payerType: 'medicaid' })).toBe(
    '/programs?pay=medicaid',
  );
  expect(coarseDirectoryHref('residential with Aetna in Georgia')).toBe('/insurance/aetna/georgia');
});

test('SEARCH-LANGUAGE-1 · common conversational terms become visible directory facets', () => {
  expect(coarseDirectoryHref('Residential in GA with Medicaid')).toBe(
    '/programs?level=residential&pay=medicaid&region=GA',
  );
  expect(coarseDirectoryHref('self-pay outpatient in Florida')).toBe(
    '/programs?level=op&pay=self_pay&region=FL',
  );
  expect(coarseDirectoryHref('medication-assisted treatment in Alabama')).toBe(
    '/programs?spec=mat&region=AL',
  );
  expect(coarseDirectoryHref('teen IOP near me with private insurance')).toBe(
    '/programs?level=iop&pay=commercial&pop=adolescent',
  );

  const nearby = parseDirectoryLanguage('residential with open beds near me');
  expect(nearby.needsApproximateState).toBe(true);
  expect(withApproximateState(nearby, 'FL')).toBe('/programs?level=residential&open=1&region=FL');
});

test('SEARCH-LANGUAGE-2 · visible natural-language action applies the typed sentence', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Search treatment/i }).click();

  const dialog = page.getByRole('dialog', { name: 'Find treatment' });
  const input = dialog.getByRole('textbox', { name: 'Describe the treatment you are looking for' });
  await input.fill('Teen IOP in Georgia with Medicaid');

  const recognized = dialog.locator('[data-search-filter]');
  await expect(recognized.filter({ hasText: /^IOP \(Intensive Outpatient\)$/ })).toBeVisible();
  await expect(recognized.filter({ hasText: /^Medicaid$/ })).toBeVisible();
  await expect(recognized.filter({ hasText: /^Teens$/ })).toBeVisible();
  await expect(recognized.filter({ hasText: /^Georgia$/ })).toBeVisible();

  await dialog.getByRole('button', { name: /Search the way you speak/i }).click();
  await expect(page).toHaveURL(/\/programs\?level=iop&pay=medicaid&pop=adolescent&region=GA$/);
  expect(page.url()).not.toContain('Teen');
});

test('SEARCH-LANGUAGE-3 · unknown narrative gets guidance instead of an unfiltered redirect', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Search treatment/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Find treatment' });
  await dialog.getByRole('textbox', { name: 'Describe the treatment you are looking for' }).fill(
    'A personal clinical story with no directory terms',
  );
  await dialog.getByRole('button', { name: /Search the way you speak/i }).click();
  await expect(dialog.getByRole('status')).toContainText('I could not match that yet');
  await expect(page).toHaveURL(/\/$/);
});

test('SEARCH-PRIVACY-2 · search and retired nearby route do not expose precise location', () => {
  const root = process.cwd();
  const searchSource = fs.readFileSync(
    path.join(root, 'src/components/search/FindTreatmentSearch.tsx'),
    'utf8',
  );
  const nearbyRouteSource = fs.readFileSync(
    path.join(root, 'src/app/(public)/match/nearby/page.tsx'),
    'utf8',
  );
  const retiredBoundsSource = fs.readFileSync(
    path.join(root, 'src/app/api/facilities/in-bounds/route.ts'),
    'utf8',
  );

  expect(searchSource).not.toContain('navigator.geolocation');
  expect(searchSource).not.toMatch(/[?&](?:lat|lng)=/i);
  expect(nearbyRouteSource).toContain("redirect('/treatment')");
  expect(nearbyRouteSource).not.toMatch(/searchParams|getNearby|maps\.googleapis|URLSearchParams/);
  expect(retiredBoundsSource).toContain("status: 410");
  expect(retiredBoundsSource).not.toMatch(/searchParams|facilities_in_bounds|p_(?:min|max|o)(?:lat|lng)/);
  expect(fs.existsSync(path.join(root, 'src/components/NearbyMap.tsx'))).toBe(false);
  expect(fs.existsSync(path.join(root, 'src/components/NearbyExplorer.tsx'))).toBe(false);
  expect(fs.existsSync(path.join(root, 'src/lib/matching/nearby.ts'))).toBe(false);
});

test('SEARCH-PRIVACY-3 · public program autocomplete keeps raw text out of URLs and analytics', () => {
  const root = process.cwd();
  const filterSource = fs.readFileSync(path.join(root, 'src/components/FilterBar.tsx'), 'utf8');
  const comboboxSource = fs.readFileSync(
    path.join(root, 'src/components/search/useProgramCombobox.ts'),
    'utf8',
  );
  const directorySource = fs.readFileSync(
    path.join(root, 'src/app/(public)/programs/page.tsx'),
    'utf8',
  );
  const apiSource = fs.readFileSync(
    path.join(root, 'src/app/api/facilities/search/route.ts'),
    'utf8',
  );
  const seoSource = fs.readFileSync(path.join(root, 'src/lib/seo.ts'), 'utf8');

  expect(comboboxSource).toContain("fetch('/api/facilities/search', {");
  expect(comboboxSource).toContain("method: 'POST'");
  expect(comboboxSource).toContain('body: JSON.stringify({ q })');
  expect(filterSource).toContain('router.push(`/programs/${id}`)');
  expect(filterSource).not.toMatch(/sp\.get\(['"]q['"]\)|push\(\{\s*q:|\/programs\?q=/);
  expect(apiSource).toContain('export async function POST(request: Request)');
  expect(apiSource).toContain('searchFacilities(body.q, body.state, true)');
  expect(apiSource).toContain("if (publishedOnly) query = query.eq('is_published', true)");
  expect(directorySource).toContain('q !== undefined');
  expect(directorySource).toContain('if (hasUnsafeOrNonCanonicalParam)');
  expect(directorySource).toContain('Object.hasOwn(US_STATES, region)');
  expect(directorySource).toContain("open === '1'");
  expect(directorySource).toContain('rowsRes.error || countRes.error || facetRes.error');
  expect(directorySource).toContain('p_q: null');
  expect(directorySource).toContain('hasQuery={false}');
  expect(seoSource).not.toContain('/programs?q=');
});
