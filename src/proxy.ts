import { NextResponse, type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';
import { stateSlug, slugify } from '@/lib/geo';

// Next 16 renamed the `middleware` file convention to `proxy`. This runs the
// Supabase session refresh before routes render, and 301-redirects legacy
// UUID profile URLs to their canonical slug URL. See:
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets:
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
