'use client';

// A contact link (call / directions / email) that records a de-identified
// engagement event before the browser follows it — feeding the facility's
// performance summary. Uses sendBeacon so it fires even as the page hands off
// to the dialer/maps/mail app. Attaches the seeker's match_id when present
// (same localStorage source as the outbound website link), for attribution.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function TrackedContactLink({
  facilityId,
  eventType,
  href,
  target,
  rel,
  className,
  children,
}: {
  facilityId: string;
  eventType: 'call' | 'directions' | 'email';
  href: string;
  target?: string;
  rel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  function onClick() {
    try {
      let matchId: string | null = null;
      const raw = localStorage.getItem('wc_matches');
      const m = raw ? (JSON.parse(raw)?.match_id as unknown) : null;
      if (typeof m === 'string' && UUID_RE.test(m)) matchId = m;

      const body = JSON.stringify({ facilityId, type: eventType, matchId });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/track', {
          method: 'POST',
          body,
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {
      // a missing metric must never break the contact action
    }
  }

  return (
    <a href={href} target={target} rel={rel} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
