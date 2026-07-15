// Lightweight IP geolocation for the "Current Location" tile. On Vercel, the edge
// network injects geo headers on every request (no API key, no external call). For
// US visitors `x-vercel-ip-country-region` is the 2-letter state code, which maps
// straight to facilities.state. Empty in local dev — the UI falls back to "all states".

import { US_STATES } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const h = request.headers;
  const country = h.get('x-vercel-ip-country') ?? '';
  const region = h.get('x-vercel-ip-country-region') ?? '';
  const state = country === 'US' ? region.toUpperCase() : '';

  // The caller needs only a coarse state filter. Never echo IP-derived city or
  // postal data into JavaScript, logs, analytics, or browser state.
  return Response.json({ state: Object.hasOwn(US_STATES, state) ? state : '' });
}
