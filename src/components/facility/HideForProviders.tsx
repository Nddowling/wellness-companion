'use client';

import { useEffect, useState } from 'react';

// Renders children by default (so the cached profile HTML shows the "claim this
// profile" CTA to the ~all anonymous seekers), then hides them after hydration for
// the rare signed-in provider. Lets the profile page stay cookie-free → ISR-cacheable.
export function HideForProviders({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/me/provider-side', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { providerSide: false }))
      .then((d) => { if (alive && d?.providerSide) setHidden(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (hidden) return null;
  return <>{children}</>;
}
