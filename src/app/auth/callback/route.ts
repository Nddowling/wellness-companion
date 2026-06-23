import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

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

function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/home';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = safeNext(url.searchParams.get('next'));

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
  return NextResponse.redirect(new URL(next, url.origin));
}
