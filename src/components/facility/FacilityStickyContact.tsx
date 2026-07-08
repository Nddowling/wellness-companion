'use client';

import { useEffect, useState } from 'react';

// Floating contact bar, Recovery.com-style: slides up once the user scrolls past the
// hero and follows them down the page so the primary action is always one tap away.
// Falls back to the seeker funnel when a program has no listed phone (never a dead CTA).
export function FacilityStickyContact({ name, phone }: { name: string; phone: string | null }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={
        'fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur transition-transform duration-300 ' +
        (show ? 'translate-y-0' : 'translate-y-full')
      }
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{name}</div>
          <div className="text-xs text-slate-500">Reach out to check current availability</div>
        </div>
        <a
          href={phone ? `tel:${phone}` : '/match'}
          className="shrink-0 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
        >
          {phone ? '📞 Call now' : 'Get connected →'}
        </a>
      </div>
    </div>
  );
}
