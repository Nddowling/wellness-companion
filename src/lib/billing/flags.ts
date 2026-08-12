// Master switch for facility billing / the paywall UX.
//
// Default OFF = launch / list-building mode: every facility gets the full toolset
// for free, all upgrade prompts are hidden, and the checkout endpoint is closed.
// The Stripe plumbing (checkout route, webhook, price env) stays fully intact — this
// flag only gates the paywall. Flip NEXT_PUBLIC_BILLING_ENABLED="true" in the
// environment to re-enable paid tiers with zero code changes.
export const BILLING_ENABLED =
  (process.env.NEXT_PUBLIC_BILLING_ENABLED ?? '').trim().toLowerCase() === 'true';
