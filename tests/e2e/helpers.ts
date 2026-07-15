import { test, expect, type Page } from '@playwright/test';

/**
 * Shared QA helpers — merged from the standalone clearbed-qa-agent package, with
 * selectors/targets corrected against the real codebase.
 */

const TARGET =
  process.env.QA_TARGET_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100';

/** True when pointed at the live production domain (not a preview or localhost). */
export const IS_PROD =
  TARGET.includes('clearbedrecovery.com') && !TARGET.includes('vercel.app');

/**
 * Call at the top of any test that might write data (including a negative request
 * whose regressed handler could write). It requires an explicit opt-in even on
 * localhost/preview, so a stale server or production-backed local .env cannot be
 * targeted accidentally.
 */
export const previewOnly = () =>
  test.skip(
    IS_PROD || process.env.QA_ALLOW_WRITES !== '1',
    IS_PROD
      ? 'Writes data — never run against production'
      : 'Writes data — set QA_ALLOW_WRITES=1 only for an isolated preview database',
  );

/** Every record created by tests carries this tag → greppable, deletable. */
export const QA_TAG = 'QA TEST — DO NOT CONTACT';

/**
 * P0 for a recovery site: the 988 crisis line must be VISIBLE on every key page.
 * Some pages surface it as a tappable `tel:988` link (footer / SiteMenu), others as
 * inline disclaimer text (e.g. /privacy: "call or text 988"). Both count as reachable,
 * so assert the number is visible rather than requiring a specific element. The
 * homepage's tappable 988 + 911 links are asserted separately in crisis.spec.ts.
 */
export async function expectCrisisReachable(page: Page) {
  await expect(page.getByText(/988/).first()).toBeVisible();
}

/** Fail the test if the page throws console/page errors (catches broken JS fast). */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}
