import { NextResponse } from 'next/server';

import { getRoles, profileType, homePathFor } from '@/lib/auth';

// Role-aware nav state for the client-side SiteMenu, so the (public) layout can stay
// cookie-free and every public page stays statically/ISR cacheable.
export const dynamic = 'force-dynamic';

export async function GET() {
  const roles = await getRoles();
  const profile = profileType(roles);
  const dashboardHref =
    profile === 'facility' || profile === 'admin' || profile === 'partner' || profile === 'rep'
      ? homePathFor(roles)
      : profile === 'none' && roles.user
        ? '/get-started'
        : null;
  return NextResponse.json(
    { profile, dashboardHref, authed: !!roles.user },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
