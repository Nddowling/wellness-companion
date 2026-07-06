import { NextResponse } from 'next/server';

import { getRoles, isProviderSide } from '@/lib/auth';

// Tiny auth probe so the (now cacheable) public profile can hide the "claim this
// profile" CTA from signed-in providers CLIENT-side — keeping the profile page itself
// free of cookie reads so it can be statically/ISR cached across all 13.5k pages.
export const dynamic = 'force-dynamic';

export async function GET() {
  const providerSide = isProviderSide(await getRoles());
  return NextResponse.json({ providerSide }, { headers: { 'Cache-Control': 'private, no-store' } });
}
