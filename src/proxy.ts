import { NextResponse, type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';
import { stateSlug, slugify } from '@/lib/geo';

// Next 16 renamed the `middleware` file convention to `proxy`. This runs the
// Supabase session refresh before routes render, and 301-redirects legacy
// UUID profile URLs to their canonical slug URL. See:
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAINTENANCE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clear Bed Recovery — brief maintenance</title></head>
<body style="margin:0;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,sans-serif">
<main style="max-width:42rem;margin:12vh auto;padding:2rem">
<p style="color:#0f766e;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Clear Bed Recovery</p>
<h1 style="font-size:2rem;line-height:1.2">We’ll be right back.</h1>
<p style="font-size:1.05rem;line-height:1.7;color:#475569">We’re completing a brief directory update. Please try again in a few minutes.</p>
<p style="line-height:1.7;color:#475569">If this is an emergency, call 911. For immediate crisis support in the U.S., call or text 988.</p>
</main></body></html>`;

function maintenanceResponse(request: NextRequest): NextResponse {
  const headers = {
    'Cache-Control': 'no-store, max-age=0',
    'Retry-After': '300',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  };
  const acceptsHtml = request.headers.get('accept')?.includes('text/html');
  if (acceptsHtml) {
    return new NextResponse(request.method === 'HEAD' ? null : MAINTENANCE_HTML, {
      status: 503,
      headers: {
        ...headers,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  }
  return NextResponse.json(
    { error: 'Service temporarily unavailable', retryAfterSeconds: 300 },
    { status: 503, headers },
  );
}

// Only routes that actually read the signed-in user need the Supabase session
// refresh. Running updateSession on every request does cookie work that makes even
// static public pages uncacheable — so we scope it to authed prefixes and let all
// public content stay static/ISR cacheable. Server actions verify auth themselves.
const AUTHED_PREFIXES = /^\/(admin|facility|me|bd|partners|rep|conversations|get-started|home|account|login|reset)(\/|$)/;

// Best-effort in-process memo of uuid → canonical path. The mapping is IMMUTABLE
// (a facility's slug never changes once assigned), so entries never expire. This is
// only a warm-instance optimization and is NOT the correctness boundary — the real
// mechanism that keeps the DB out of the hot path is the CDN caching the 301 itself
// (see the long s-maxage below). Proxy may run on many isolated instances, so we
// never rely on this Map being populated.
const memo = new Map<string, string>();

// Resolve a facility UUID to its canonical /treatment/<state>/<city>/<slug> path.
// Uses the service-role key because RLS hides facilities from anonymous requests;
// only public fields (slug/city/state) are read, and this runs server-side only.
async function resolveCanonicalPath(uuid: string): Promise<string | null> {
  const cached = memo.get(uuid);
  if (cached) return cached;

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;

  try {
    const res = await fetch(
      `${base}/rest/v1/facilities?id=eq.${uuid}&is_published=eq.true&select=slug,city,state&limit=1`,
      { headers: { apikey: key, authorization: `Bearer ${key}` }, cache: 'no-store' },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { slug: string | null; city: string | null; state: string | null }[];
    const f = rows?.[0];
    if (!f?.slug || !f.city || !f.state) return null;

    const path = `/treatment/${stateSlug(f.state.toUpperCase())}/${slugify(f.city)}/${f.slug}`;
    memo.set(uuid, path);
    return path;
  } catch {
    return null; // never let a lookup failure break the request — fall through
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Release cutovers that contract database permissions use a dedicated
  // maintenance deployment. The flag is deployment-scoped, so the tested
  // application artifact can be promoted atomically after the database succeeds.
  if (process.env.MAINTENANCE_MODE === '1') return maintenanceResponse(request);

  // Legacy /programs/<uuid> → permanent 301 to the canonical slug URL.
  const match = pathname.match(/^\/programs\/([^/]+)\/?$/);
  if (match && UUID.test(match[1])) {
    const target = await resolveCanonicalPath(match[1]);
    if (target) {
      const url = request.nextUrl.clone();
      url.pathname = target; // preserve any query string (utm, etc.) on url.search
      const res = NextResponse.redirect(url, 301);
      // Let the CDN cache the permanent redirect so repeat hits to this old URL are
      // served from the edge without re-entering proxy or touching Postgres. The
      // uuid→slug mapping is immutable, so a 1-year s-maxage is safe.
      res.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=31536000, immutable');
      return res;
    }
    // Unknown/unpublished uuid: fall through so the page can render its 404.
  }

  if (AUTHED_PREFIXES.test(pathname)) {
    return updateSession(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets:
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
