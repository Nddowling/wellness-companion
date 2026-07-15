import { defineConfig, devices } from '@playwright/test';

/**
 * Clear Bed Recovery E2E config.
 *
 * Target selection (priority): QA_TARGET_URL → PLAYWRIGHT_BASE_URL → localhost:3000.
 *   - localhost            → boots a fresh `next dev`; write specs still require QA_ALLOW_WRITES=1
 *   - a Vercel preview URL  → full suite incl. previewOnly() data-writing tests
 *   - clearbedrecovery.com  → previewOnly() tests auto-skip (read-only against prod)
 *
 * Never point write/checkout/handoff/match-submit specs at production PHI.
 * See docs/qa/QA-TEST-CATALOG.md §8.
 */
const baseURL =
  process.env.QA_TARGET_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100';
const isRemote = baseURL.startsWith('http') && !baseURL.includes('localhost');
const localPort = /^http:\/\/localhost:(\d+)(?:\/|$)/.exec(baseURL)?.[1] ?? '3100';

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
        command: `npm run dev -- --port ${localPort}`,
        url: baseURL,
        // Never attach tests to an unknown stale process. This is especially
        // important when a developer has a server connected to production data.
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
