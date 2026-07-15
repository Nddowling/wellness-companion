import { test, expect, type Page } from '@playwright/test';

import { trackConsoleErrors } from './helpers';

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

test('SK-05 · match page loads deterministic directory choices (no login wall)', async ({ page }) => {
  await page.goto('/match');
  await expect(page.locator('body')).not.toContainText(/sign in|log in/i);
  await expect(page.getByRole('dialog', { name: /clear bed recovery companion/i })).toBeVisible();
});

const MOCK_MATCH = {
  match_id: '11111111-1111-4111-8111-111111111111',
  facilities: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Clear Path Recovery Center',
      city: 'Atlanta',
      state: 'GA',
      level: 'op',
      bed_based: false,
      beds_available: 0,
      freshness: 'red',
      provider_reported: false,
      region_match: true,
      referral_contact: { phone: '555-0100' },
    },
  ],
};

async function acknowledge(page: Page) {
  await page.goto('/match');
  await page.getByRole('checkbox', { name: /understand|reviewed|agree/i }).check();
  await page.getByRole('button', { name: /let.?s begin/i }).click();
}

async function completeDeterministicFilters(page: Page) {
  await page.getByRole('radio', { name: /^Outpatient/i }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('radio', { name: /^Substance-use treatment/i }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('textbox', { name: 'ZIP code' }).fill('30301');
  await page.getByRole('button', { name: /keep only my zip3/i }).click();
  await page.getByRole('radio', { name: /^Medicaid/i }).check();
  await page.getByRole('button', { name: /find directory options/i }).click();
}

test('SK-06 · deterministic match shows results before contact and never calls AI intake', async ({ page }) => {
  const intakeRequests: string[] = [];
  const handoffRequests: string[] = [];
  let matchPayload: Record<string, unknown> | null = null;
  let matchHeaders: Record<string, string> = {};

  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/intake') intakeRequests.push(request.url());
    if (pathname === '/api/handoff') handoffRequests.push(request.url());
  });
  await page.route('**/api/match', async (route) => {
    matchPayload = route.request().postDataJSON() as Record<string, unknown>;
    matchHeaders = route.request().headers();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MATCH) });
  });

  await acknowledge(page);
  await expect(page.locator('input[type="email"], input[type="tel"]')).toHaveCount(0);
  await completeDeterministicFilters(page);
  const resultsHeading = page.getByRole('heading', { name: /directory (?:options|matches)/i });
  await expect(resultsHeading).toBeVisible();

  expect(matchHeaders['idempotency-key']).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(matchPayload).toEqual({
    care_level_needed: 'op',
    concern_category: 'substance_use',
    region_zip3: '303',
    payer_type: 'medicaid',
  });
  expect(JSON.stringify(matchPayload)).not.toContain('30301');
  expect(matchPayload).not.toHaveProperty('phone');
  expect(matchPayload).not.toHaveProperty('email');
  expect(matchPayload).not.toHaveProperty('contact');
  expect(matchPayload).not.toHaveProperty('consents');
  expect(intakeRequests, 'the deterministic form must never invoke /api/intake').toEqual([]);
  expect(handoffRequests, 'contact/handoff must not run before explicit opt-in').toEqual([]);
});

test('SK-07 · checked connection choice directly controls handoff consent booleans', async ({ page }) => {
  const intakeRequests: string[] = [];
  let handoffPayload: Record<string, unknown> | null = null;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/intake') intakeRequests.push(request.url());
  });
  await page.route('**/api/match', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MATCH) }),
  );
  await page.route('**/api/handoff', async (route) => {
    handoffPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        mode: 'connect',
        contactSaved: true,
        shared: true,
        emailSent: true,
        facilities: MOCK_MATCH.facilities,
      }),
    });
  });

  await acknowledge(page);
  await completeDeterministicFilters(page);
  await page.getByRole('button', { name: /choose how to connect/i }).click();
  await page.getByRole('radio', { name: /^Both:/i }).check();
  await page.getByRole('textbox', { name: 'Email address' }).fill('seeker@example.com');
  await page.getByRole('button', { name: /confirm this permission/i }).click();

  await expect(page.getByText(/chosen contact method is available/i)).toBeVisible();
  expect(handoffPayload).toEqual({
    match_id: MOCK_MATCH.match_id,
    contact: { email: 'seeker@example.com' },
    consents: { email: true, share: true },
  });
  expect(intakeRequests, 'consent must not be interpreted by /api/intake or a model').toEqual([]);
});
