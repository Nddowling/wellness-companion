import { test, expect } from '@playwright/test';

import { APP_ROUTES } from './routes';

/**
 * §1c role-lane cross-checks — the anti-cross-profile guarantee.
 *
 * A signed-in user in lane X hitting lane Y's route must be redirected to X's OWN
 * home base (never shown another profile's page). Admin routes are the exception:
 * non-admins get /login?error=not_authorized.
 *
 * These need real seeded Supabase users, one per lane. Until those are wired in via
 * env, the whole file self-skips so CI stays green. To enable, set (against a NON-PROD
 * Supabase — never prod PHI):
 *   E2E_SEEKER_EMAIL / E2E_SEEKER_PASSWORD   (repeat for FACILITY, PARTNER, REP, ADMIN)
 *
 * Recommended: seed throwaway users the way scripts/rls-test.ts already does, log in
 * once per role in a global-setup, and save storageState per lane. Then replace the
 * `login()` stub below with a storageState load.
 */

const LANES = ['SEEKER', 'FACILITY', 'PARTNER', 'REP', 'ADMIN'] as const;
type Lane = (typeof LANES)[number];

function creds(lane: Lane) {
  const email = process.env[`E2E_${lane}_EMAIL`];
  const password = process.env[`E2E_${lane}_PASSWORD`];
  return email && password ? { email, password } : null;
}

const haveAnyCreds = LANES.some((l) => creds(l) !== null);

test.describe('§1c role-lane isolation', () => {
  test.skip(!haveAnyCreds, 'No E2E_*_EMAIL/PASSWORD set — seed non-prod users to enable. See file header.');

  // Home-base each lane should be redirected TO when out of lane.
  const HOME: Record<string, RegExp> = {
    seeker: /\/me/,
    facility: /\/facility/,
    partner: /\/partners/,
    rep: /\/rep/,
    admin: /\/admin/,
  };

  for (const lane of LANES) {
    const c = creds(lane);
    test.describe(`as ${lane}`, () => {
      test.skip(!c, `No creds for ${lane}`);

      for (const route of APP_ROUTES) {
        const laneKey = lane.toLowerCase();
        const inLane = route.lane === laneKey || route.lane === 'any';
        test(`${route.id} · ${route.path} · ${lane} · ${inLane ? '200' : 'redirect out'}`, async ({ page }) => {
          // TODO: replace with storageState-based auth from global-setup.
          await loginViaUi(page, c!.email, c!.password);
          await page.goto(route.path, { waitUntil: 'domcontentloaded' });

          if (inLane) {
            await expect(page).toHaveURL(new RegExp(route.path.replace(/\//g, '\\/')));
          } else if (route.lane === 'admin') {
            await expect(page).toHaveURL(/error=not_authorized/);
          } else {
            await expect(page).toHaveURL(HOME[laneKey]);
          }
        });
      }
    });
  }
});

/** Placeholder UI login. Swap for the app's real magic-link/password flow. */
async function loginViaUi(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  const pw = page.getByLabel(/password/i);
  if (await pw.count()) await pw.fill(password);
  await page.getByRole('button', { name: /sign in|log in|continue/i }).click();
  await page.waitForLoadState('networkidle');
}
