import { defineConfig, devices } from '@playwright/test';

/**
 * Clear Bed Recovery E2E config.
 *
 * Target selection (priority): QA_TARGET_URL → PLAYWRIGHT_BASE_URL → localhost:3000.
 *   - localhost            → boots `next dev` for you, runs the full suite
 *   - a Vercel preview URL  → full suite incl. previewOnly() data-writing tests
 *   - clearbedrecovery.com  → previewOnly() tests auto-skip (read-only against prod)
 *
 * Never point write/checkout/handoff/match-submit specs at production PHI.
 * See docs/qa/QA-TEST-CATALOG.md §8.
 */
const baseURL =
  process.env.QA_TARGET_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const isRemote = baseURL.startsWith('http') && !baseURL.includes('localhost');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'qa-results.json' }], // consumed by scripts/report-to-supabase.ts
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Seekers are often on a phone in a hard moment — cover the mobile viewport too.
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  // Only boot a local dev server when targeting localhost.
  webServer: isRemote
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
