import { test, expect } from '@playwright/test';

import { previewOnly } from './helpers';

/**
 * §3/§5 API contract smoke — the checks that need no auth and no external services.
 * These catch the two most dangerous regressions: an unguarded cron endpoint and a
 * handoff/webhook that stops rejecting bad/unauthorized input.
 */

test('API-CRON-1 · /api/cron/weekly-reminders · recurring outreach retired · 410', async ({ request }) => {
  const res = await request.get('/api/cron/weekly-reminders');
  expect(res.status(), 'retired reminder route must never send email').toBe(410);
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

test('MATCH-2b · /api/match · missing de-identified fields · 400', async ({ request }) => {
  // A regressed/older handler may normalize missing fields and create a match.
  previewOnly();
  const res = await request.post('/api/match', { data: {} });
  expect(res.status()).toBe(400);
});

test('MATCH-2c · /api/match · prohibited identity field · 400', async ({ request }) => {
  // Never probe this contract on production: a regressed handler could ignore the
  // extra identity field and still create a match row.
  previewOnly();
  const res = await request.post('/api/match', {
    data: {
      region_zip3: '787',
      care_level_needed: 'residential',
      payer_type: 'self_pay',
      concern_category: 'unsure',
      email: 'must-not-enter-matching@example.com',
    },
  });
  expect(res.status()).toBe(400);
});

test('MATCH-2d · /api/match · retired coverage status field · 400', async ({ request }) => {
  // A regressed handler could persist this deprecated field, so never probe it on production.
  previewOnly();
  const res = await request.post('/api/match', {
    data: {
      region_zip3: '787',
      care_level_needed: 'residential',
      payer_type: 'self_pay',
      concern_category: 'unsure',
      coverage_status: 'active',
    },
  });
  expect(res.status()).toBe(400);
});

test('MATCH-3 · /api/intake · AI intake permanently retired · 410', async ({ request }) => {
  const res = await request.post('/api/intake', {
    data: {
      step: 'need',
      messages: [{ role: 'user', content: 'This must never be sent to a model.' }],
    },
  });
  expect(res.status()).toBe(410);
  expect(res.headers()['cache-control']).toContain('no-store');
});

test('MATCH-5 · /api/handoff · no browser-bound match capability · 403', async ({ request }) => {
  const res = await request.post('/api/handoff', {
    data: { match_id: crypto.randomUUID(), contact: { phone: '555-0100' }, consents: { share: true, email: false } },
  });
  expect(res.status(), 'handoff must be bound to the browser that created the match').toBe(403);
});

test('MATCH-6 · /api/contact · early lead capture retired · 410', async ({ request }) => {
  // The retired production predecessor persisted this payload before responding.
  previewOnly();
  const res = await request.post('/api/contact', { data: { full_name: 'No', email: 'store@example.com' } });
  expect(res.status()).toBe(410);
});

test('MATCH-8 · /api/conversations · transcript storage retired · 410', async ({ request }) => {
  const res = await request.post('/api/conversations', { data: {} });
  expect(res.status()).toBe(410);
});
