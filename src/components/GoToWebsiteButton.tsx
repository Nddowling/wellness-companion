'use client';

/**
 * Outbound "Go to website" link that attaches the seeker's de-identified match_id
 * for attribution. The match_id only lives in the browser (localStorage `wc_matches`,
 * set by the match flow), so the server can't know it. We render the plain
 * `/go/<id>` link, then at click time read the match and rewrite the href to
 * `/go/<id>?m=<matchId>` just before navigation. Visitors who didn't come through
 * /match keep the facility-level link.
 */
export function GoToWebsiteButton({
  facilityId,
  className,
  children,
}: {
  facilityId: string;
  className?: string;
  children: React.ReactNode;
}) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    try {
      const raw = localStorage.getItem('wc_matches');
      const matchId = raw ? (JSON.parse(raw)?.match_id as unknown) : null;
      if (typeof matchId === 'string' && matchId) {
        e.currentTarget.href = `/go/${facilityId}?m=${encodeURIComponent(matchId)}`;
      }
    } catch {
      // malformed/absent storage — fall through to the facility-level link
    }
  }

  return (
    <a
      href={`/go/${facilityId}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}
