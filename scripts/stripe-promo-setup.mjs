#!/usr/bin/env node
// One-off, idempotent setup for Clear Bed Recovery's promo codes in Stripe.
//
// Configures:
//   • FOUNDING50 — 50% off for 12 months, capped at 10 total redemptions.
//   • GODMODE    — lifetime free (100% off, forever), ONE redemption, locked to a
//                  single customer ("samba"). Prints the coupon id to set as
//                  STRIPE_LIFETIME_COUPON (the webhook reads it to flag lifetime).
//
// Codes are entered in Stripe's hosted coupon box at checkout (allow_promotion_codes),
// so this only creates the coupons + promotion codes with the right limits/restrictions.
//
// Usage:
//   STRIPE_SECRET_KEY=sk_live_... SAMBA_EMAIL=you@example.com node scripts/stripe-promo-setup.mjs
// or pin the customer directly:
//   STRIPE_SECRET_KEY=sk_live_... SAMBA_STRIPE_CUSTOMER=cus_123 node scripts/stripe-promo-setup.mjs
//
// Re-running is safe: existing coupons (by fixed id) are reused; a promotion code with
// the wrong redemption cap is deactivated and recreated.

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('Set STRIPE_SECRET_KEY (use a TEST key first: sk_test_...).');
  process.exit(1);
}

const FOUNDING_COUPON_ID = 'founding50-50pct-12mo';
const LIFETIME_COUPON_ID = 'godmode-lifetime-forever';

async function stripe(path, params, method = 'POST') {
  const opts = { method, headers: { Authorization: `Bearer ${KEY}` } };
  if (params) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) body.set(k, String(v));
    opts.body = body;
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, opts);
  const data = await res.json();
  if (!res.ok) {
    const e = new Error(data?.error?.message ?? `Stripe ${path} failed`);
    e.code = data?.error?.code;
    throw e;
  }
  return data;
}

// Create a coupon with a fixed id; if it already exists, fetch and reuse it.
async function ensureCoupon(id, params) {
  try {
    const c = await stripe('coupons', { id, ...params });
    console.log(`✓ created coupon ${id}`);
    return c;
  } catch (e) {
    if (e.code === 'resource_already_exists') {
      console.log(`• coupon ${id} already exists — reusing`);
      return stripe(`coupons/${id}`, null, 'GET');
    }
    throw e;
  }
}

// Ensure a promotion code (by code string) exists with the desired cap/restriction.
async function ensurePromotionCode(code, params) {
  const list = await stripe(`promotion_codes?code=${encodeURIComponent(code)}&limit=10`, null, 'GET');
  const existing = (list.data ?? []).find((p) => p.code === code && p.active);
  const capOk = existing && (existing.max_redemptions ?? null) === (params.max_redemptions ?? null);
  const custOk = existing && (existing.customer ?? null) === (params.customer ?? null);
  if (existing && capOk && custOk) {
    console.log(`• promotion code ${code} already configured — leaving as is`);
    return existing;
  }
  if (existing) {
    await stripe(`promotion_codes/${existing.id}`, { active: 'false' });
    console.log(`• deactivated old ${code} (cap/restriction changed)`);
  }
  const created = await stripe('promotion_codes', { code, ...params });
  console.log(`✓ created promotion code ${code}`);
  return created;
}

async function resolveSambaCustomer() {
  if (process.env.SAMBA_STRIPE_CUSTOMER) return process.env.SAMBA_STRIPE_CUSTOMER;
  const email = process.env.SAMBA_EMAIL;
  if (!email) return null;
  const list = await stripe(`customers?email=${encodeURIComponent(email)}&limit=1`, null, 'GET');
  if (list.data?.[0]) return list.data[0].id;
  const c = await stripe('customers', { email });
  console.log(`✓ created customer for ${email}`);
  return c.id;
}

async function main() {
  // FOUNDING50 — 50% off, 12 months, 10 total redemptions.
  const founding = await ensureCoupon(FOUNDING_COUPON_ID, {
    percent_off: 50,
    duration: 'repeating',
    duration_in_months: 12,
    name: 'Founding facilities — 50% off first year',
  });
  await ensurePromotionCode('FOUNDING50', { coupon: founding.id, max_redemptions: 10 });

  // GODMODE — lifetime free, one use, samba-only.
  const samba = await resolveSambaCustomer();
  if (!samba) {
    console.warn('\n⚠ No SAMBA_EMAIL/SAMBA_STRIPE_CUSTOMER given — skipping GODMODE.');
    console.warn('  Re-run with SAMBA_EMAIL=... to create the samba-locked GODMODE code.');
  } else {
    const lifetime = await ensureCoupon(LIFETIME_COUPON_ID, {
      percent_off: 100,
      duration: 'forever',
      name: 'GOD MODE — lifetime free',
    });
    await ensurePromotionCode('GODMODE', { coupon: lifetime.id, max_redemptions: 1, customer: samba });
    console.log(`\n➡ Set this in your env (Vercel + .env.local):\n   STRIPE_LIFETIME_COUPON=${lifetime.id}\n`);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error('Stripe setup failed:', e.message);
  process.exit(1);
});
