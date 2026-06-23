// Lightweight IP geolocation for the "Current Location" tile. On Vercel, the edge
// network injects geo headers on every request (no API key, no external call). For
// US visitors `x-vercel-ip-country-region` is the 2-letter state code, which maps
// straight to facilities.state. Empty in local dev — the UI falls back to "all states".

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const h = request.headers;
  const country = h.get('x-vercel-ip-country') ?? '';
  const region = h.get('x-vercel-ip-country-region') ?? '';
  const rawCity = h.get('x-vercel-ip-city') ?? '';
  const zip = h.get('x-vercel-ip-postal-code') ?? '';

  return Response.json({
    country,
    state: country === 'US' ? region.toUpperCase() : '',
    city: rawCity ? decodeURIComponent(rawCity) : '',
    zip,
  });
}
