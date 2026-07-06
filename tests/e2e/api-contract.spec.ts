import { test, expect } from '@playwright/test';

/**
 * §3/§5 API contract smoke — the checks that need no auth and no external services.
 * These catch the two most dangerous regressions: an unguarded cron endpoint and a
 * handoff/webhook that stops rejecting bad/unauthorized input.
 */

test('API-CRON-1 · /api/cron/weekly-reminders · no secret · 401', async ({ request }) => {
  const res = await request.get('/api/cron/weekly-reminders');
  expect(res.status(), 'cron must reject public calls').toBe(401);
});

test('PAY-3 · /api/stripe/webhook · unsigned · rejected', async ({ request }) => {
  const res = await request.post('/api/stripe/webhook', {
    data: { type: 'checkout.session.completed' },
    headers: { 'content-type': 'application/json' },
  });
  // 400 = bad signature (secret configured); 503 = secret not set (local/CI without Stripe).
  // Either way the event is rejected with NO DB write. In prod (secret set) this MUST be 400.
  expect([400, 503], 'unsigned webhook must be rejected, never 2xx').toContain(res.status());
});

test('MATCH-2a · /api/match · invalid JSON · 400', async ({ request }) => {
  const res = await request.post('/api/match', {
    data: Buffer.from('{ not json'),
    headers: { 'content-type': 'application/json' },
  });
  expect(res.status()).toBe(400);
});

test('MATCH-2b · /api/match · sparse valid body · 200 (resilient by design)', async ({ request }) => {
  // normalizeIntake fills coarse defaults so a completed conversation never fails on
  // a missing field. Empty {} is valid → 200, NOT 400. Guards against a regression that
  // would make the seeker AI brittle.
  const res = await request.post('/api/match', { data: {} });
  expect(res.status()).toBeLessThan(500);
  expect(res.status()).not.toBe(400);
});

test('MATCH-3 · /api/intake · empty body · 400', async ({ request }) => {
  const res = await request.post('/api/intake', { data: {} });
  expect(res.status()).toBe(400);
});

test('MATCH-5 · /api/handoff · no consent · 400', async ({ request }) => {
  // consent_share is a hard HIPAA / 42 CFR Part 2 gate — a handoff without it must fail.
  const res = await request.post('/api/handoff', { data: { consent_share: false } });
  expect(res.status(), 'handoff without consent must be blocked').toBe(400);
});

test('MATCH-8 · /api/conversations · unauth · 401', async ({ request }) => {
  const res = await request.post('/api/conversations', { data: {} });
  expect([400, 401]).toContain(res.status());
});
