import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import Stripe from 'stripe';

import {
  checkoutAttemptExpired,
  checkoutAttemptMatches,
  hasManagedBilling,
  selectBillingFacility,
  stripeKeyLivemode,
} from '../../src/lib/billing/guards';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const attackerFacility = '33333333-3333-4333-8333-333333333333';

test('BILL-AUTHZ-1 · multi-facility and tampered selections fail closed; owner is required', () => {
  const memberships = [
    { facility_id: ownerA, role: 'owner' },
    { facility_id: ownerB, role: 'staff' },
  ];

  expect(selectBillingFacility(null, memberships)).toEqual({ ok: false, reason: 'facility_required' });
  expect(selectBillingFacility(attackerFacility, memberships)).toEqual({
    ok: false,
    reason: 'facility_forbidden',
  });
  expect(selectBillingFacility(ownerB, memberships)).toEqual({ ok: false, reason: 'owner_required' });
  expect(selectBillingFacility(ownerA, memberships)).toEqual({ ok: true, facilityId: ownerA });
});

test('BILL-CHECKOUT-1 · active/lifetime billing and duplicate attempts cannot start a new subscription', () => {
  expect(hasManagedBilling({ plan: 'growth', plan_status: 'active', stripe_subscription_id: 'sub_1' })).toBe(true);
  expect(hasManagedBilling({ plan: 'anchor', plan_status: 'lifetime', stripe_subscription_id: null })).toBe(true);
  expect(hasManagedBilling({ plan: 'free', plan_status: 'canceled', stripe_subscription_id: 'sub_old' })).toBe(false);

  const attempt = { requested_by: 'user-a', plan: 'growth', billing_cycle: 'monthly' };
  expect(checkoutAttemptMatches(attempt, 'user-a', 'growth', 'monthly')).toBe(true);
  expect(checkoutAttemptMatches(attempt, 'user-b', 'growth', 'monthly')).toBe(false);
  expect(checkoutAttemptMatches(attempt, 'user-a', 'anchor', 'monthly')).toBe(false);
  expect(checkoutAttemptExpired({ expires_at: '2026-01-01T00:00:00.000Z' }, Date.parse('2026-01-01T00:00:01Z'))).toBe(
    true,
  );

  const route = read('src/app/api/checkout/route.ts');
  const migration = read('supabase/project-a/migrations/36_secure_billing_events.sql');
  expect(route).toContain(".select('facility_id, role')");
  expect(route).toContain('selectBillingFacility(input.facilityId, memberships ?? [])');
  expect(route).toContain(".from('billing_checkout_attempts')");
  expect(route).toContain('idempotencyKey: `clearbed-checkout-${currentAttempt.id}`');
  expect(route).toContain("error.param === 'expires_at'");
  expect(route).toContain('async function updateCheckoutAttempt(');
  expect(route).toContain(".select('id')");
  expect(route).not.toContain('checkoutAttemptExpired(currentAttempt) &&');
  expect(route).toContain('return createPortalResponse');
  expect(migration).toContain("add column if not exists plan text default 'free'");
  expect(migration).toContain("add column if not exists plan_status text default 'inactive'");
  expect(migration).toContain('add column if not exists stripe_customer_id text');
  expect(migration).toContain('add column if not exists stripe_subscription_id text');
  expect(migration).toContain('facilities_stripe_subscription_id_unique');
  expect(migration).toContain('billing_checkout_attempts_one_open_per_facility');
  expect(migration).toContain("where status in ('pending', 'open')");
});

test('BILL-WEBHOOK-1 · official SDK accepts multiple signatures and rejects stale signatures', () => {
  const stripe = new Stripe('sk_test_clearbed_signature_test');
  const secret = 'whsec_clearbed_signature_test';
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    id: 'evt_signature_test',
    object: 'event',
    api_version: null,
    created: now,
    data: { object: { id: 'cs_test' } },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: 'checkout.session.completed',
  });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: now });
  const validSignature = header.split(',').find((part) => part.startsWith('v1='));
  expect(validSignature).toBeTruthy();
  const multipleSignatureHeader = `t=${now},v1=${'0'.repeat(64)},${validSignature}`;

  expect(stripe.webhooks.constructEvent(payload, multipleSignatureHeader, secret, 300).id).toBe(
    'evt_signature_test',
  );

  const staleTimestamp = now - 301;
  const staleHeader = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: staleTimestamp,
  });
  expect(() => stripe.webhooks.constructEvent(payload, staleHeader, secret, 300)).toThrow();
  expect(stripeKeyLivemode('sk_test_example')).toBe(false);
  expect(stripeKeyLivemode('sk_live_example')).toBe(true);
  expect(stripeKeyLivemode('not-a-stripe-key')).toBeNull();
});

test('BILL-WEBHOOK-2 · replay and older events are durably ignored before entitlement changes', () => {
  const route = read('src/app/api/stripe/webhook/route.ts');
  const migration = read('supabase/project-a/migrations/36_secure_billing_events.sql');

  expect(route).toContain('const raw = await request.text()');
  expect(route).toContain('stripe.webhooks.constructEvent(raw, signature, secret, WEBHOOK_TOLERANCE_SECONDS)');
  expect(route).toContain('event.livemode !== expectedLivemode');
  expect(route).toContain('plan = planForPriceId(current.items.data[0]?.price.id);');
  expect(route).not.toContain('planForPriceId(current.items.data[0]?.price.id) ?? plan');
  expect(route).toContain("supabase.rpc('apply_stripe_billing_event'");
  expect(route).toContain("result.result === 'applied' || result.result === 'duplicate'");
  expect(route).toContain("return Response.json({ error: 'Could not refresh billing caches' }, { status: 500 })");
  expect(migration).toContain('event_id text primary key');
  expect(migration).toContain('on conflict (event_id) do nothing');
  expect(migration).toContain("return query select 'duplicate'::text");
  expect(migration).toContain('select event.facility_id into v_facility_id');
  expect(migration).toContain('p_event_created < v_last_created');
  expect(migration).toContain('v_precedence < v_last_precedence');
  expect(migration).toContain("outcome = 'older_event'");
  expect(migration).toContain("outcome = 'superseded_subscription'");
  expect(migration).toContain("outcome = 'subscription_binding_mismatch'");
  expect(migration).toContain("outcome = 'attempt_facility_mismatch'");
  expect(migration).toContain("outcome = 'price_mismatch'");
  expect(migration).toContain('p_plan is null or p_plan <> v_attempt_plan');
  expect(migration).toContain('v_current_subscription_id <> p_subscription_id');
  expect(migration).not.toContain('set facility_id = v_facility_id,\n      last_event_created');
  expect(migration).toContain('for update;');
  expect(migration).toContain('revoke all on table public.stripe_webhook_events from public, anon, authenticated');
});

test('BILL-PROMO-1 · tracked application source contains no promotion credentials or setup instructions', () => {
  const files: string[] = [];
  const visit = (directory: string) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(?:ts|tsx|js|mjs|md|sql)$/.test(entry.name)) files.push(full);
    }
  };
  visit(path.join(root, 'src'));
  visit(path.join(root, 'scripts'));

  const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  expect(source).not.toMatch(
    /FOUNDING50|RECOVERYNOW|GODMODE|STRIPE_LIFETIME_COUPON|allow_promotion_codes|promotion code|promo code/i,
  );
  expect(fs.existsSync(path.join(root, 'scripts/stripe-promo-setup.mjs'))).toBe(false);
});

test('BILL-ENTITLEMENT-1 · uploads resolve plan status on the server before applying limits', () => {
  const actions = read('src/app/(app)/facility/actions.ts');
  const photo = actions.slice(actions.indexOf('export async function uploadPhoto'), actions.indexOf('/** Remove a photo'));
  const video = actions.slice(actions.indexOf('export async function uploadVideo'), actions.indexOf('/** Remove a video'));

  expect(photo).toContain(".select('plan, plan_status, images')");
  expect(photo).toContain('effectivePlan(planRow?.plan, planRow?.plan_status)');
  expect(video).toContain(".select('plan, plan_status, videos')");
  expect(video).toContain('effectivePlan(planRow?.plan, planRow?.plan_status)');
  expect(video).toContain("planAllows(plan, 'video')");
  expect(actions).not.toContain('Upload a video (Growth+ feature)');
});
