'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

// Context-aware "back" link for a facility profile.
//
// The old breadcrumb always pointed at /match, which (for an anonymous seeker)
// re-triggered the intro/consent gate and started the flow over — losing results.
// Now /match persists its results to sessionStorage('wc_match_session') and
// rehydrates them on return. This link only offers "← Your matches" when such a
// session exists; otherwise it renders nothing, leaving the adjacent
// "Browse all programs" link as the way back (correct when arriving via Browse).
//
// useSyncExternalStore reads the browser-only store with a server snapshot of
// `false`, so it's SSR-safe and avoids a setState-in-effect.
const subscribe = () => () => {};
const getSnapshot = () => {
  try {
    return !!sessionStorage.getItem('wc_match_session');
  } catch {
    return false;
  }
};

export function MatchBackLink({ className }: { className?: string }) {
  const hasSession = useSyncExternalStore(subscribe, getSnapshot, () => false);
  if (!hasSession) return null;
  return (
    <Link href="/match" className={className}>
      ← Your matches
    </Link>
  );
}
