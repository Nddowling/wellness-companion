'use client';

import { useEffect, useState } from 'react';

import { TrackedContactLink } from '@/components/TrackedContactLink';

// Floating contact bar, Recovery.com-style: slides up once the user scrolls past the
// hero and follows them down the page so the primary action is always one tap away.
// Falls back to the seeker funnel when a program has no listed phone (never a dead CTA).
type FacilityStickyContactProps = {
  facilityId: string;
  name: string;
  phone: string | null;
  email?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  sourcePage: string;
};

export function FacilityStickyContact({
  facilityId,
  name,
  phone,
  email,
  slug,
  city,
  state,
  sourcePage,
}: FacilityStickyContactProps) {
  const [show, setShow] = useState(false);
  const contactType = phone ? 'call' : email ? 'email' : null;
  const href = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : email ? `mailto:${email}` : '/match';
  const label = phone ? '📞 Call now' : email ? 'Email program' : 'Get connected →';
  const actionClassName =
    'shrink-0 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800';

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      data-sticky-contact
      className={
        'fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/95 backdrop-blur transition-transform duration-300 lg:bottom-0 ' +
        (show ? 'translate-y-0' : 'translate-y-full')
      }
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{name}</div>
          <div className="text-xs text-slate-500">Reach out to check current availability</div>
        </div>
        {contactType ? (
          <TrackedContactLink
            facilityId={facilityId}
            eventType={contactType}
            href={href}
            facilityName={name}
            slug={slug}
            city={city}
            state={state}
            sourcePage={sourcePage}
            className={actionClassName}
          >
            {label}
          </TrackedContactLink>
        ) : (
          <a href={href} className={actionClassName}>
            {label}
          </a>
        )}
      </div>
    </div>
  );
}
