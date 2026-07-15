import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { safeInternalPath } from '@/lib/auth/safe-redirect';
import { provisionCanonicalLane } from '@/lib/auth/provision-canonical';

// Auth landing handler. Every Supabase auth email (confirm signup, magic link,
// invite, password recovery / facility set-password) redirects HERE first. We
// establish the session server-side, then forward to the in-app destination
// (`?next=`). Supabase hosts no UI of its own — these pages are all ours.
//
// Handles both flows:
//  • PKCE   → `?code=…`            → exchangeCodeForSession
//  • OTP    → `?token_hash=…&type` → verifyOtp (used by admin-generated links)
// If neither is present (a legacy implicit/hash link), we just forward and let the
// destination page's browser client pick the session out of the URL fragment.

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = safeInternalPath(url.searchParams.get('next')) ?? '/home';

  const supabase = await createClient();
  let failed = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = !!error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    failed = !!error;
  } else {
    // No verifiable params — implicit/hash link; let the destination handle it.
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (failed) {
    return NextResponse.redirect(new URL('/login?error=link_expired', url.origin));
  }
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user || !(await provisionCanonicalLane(user))) {
    return NextResponse.redirect(new URL('/login?error=profile_setup_failed', url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
