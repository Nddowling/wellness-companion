'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { signOut } from '@/app/(app)/actions';

type NavLink = { href: string; label: string };
type Profile = 'admin' | 'facility' | 'partner' | 'rep' | 'seeker' | 'none';

// Subtitle is audience-aware — seekers don't "manage an account", so the old
// one-size line confused them.
const SUBTITLE: Record<Profile, string> = {
  seeker: 'Find care, browse programs, and your saved info.',
  facility: 'Manage your listing and account.',
  partner: 'Find programs, save favorites, and share shortlists.',
  rep: 'Your profile, your facilities, and your team.',
  admin: 'Admin tools — plus the seeker AI to test.',
  none: 'Find care or explore treatment programs.',
};

// The public hamburger is built strictly from the viewer's canonical profile so it
// never offers another lane's pages:
//   • Seeker AI ("Find care") — seekers, guests/roleless, and admin (as a test). NOT facilities.
//   • Provider marketing ("For providers", "Pricing") — everyone EXCEPT seekers.
//   • A dashboard shortcut into the viewer's own lane.
function buildLinks(profile: Profile, dashboardHref: string | null): NavLink[] {
  const links: NavLink[] = [{ href: '/', label: 'Home' }];
  if (profile !== 'facility') {
    links.push({ href: '/match', label: profile === 'admin' ? 'AI chat (test)' : 'Find care' });
  }
  links.push({ href: '/programs', label: 'Browse programs' });
  links.push({ href: '/treatment', label: 'Browse by state' });
  links.push({ href: '/insurance', label: 'By insurance' });
  links.push({ href: '/guides', label: 'Guides' });
  if (profile === 'seeker') links.push({ href: '/me', label: 'My care' });
  if (profile !== 'facility' && profile !== 'partner') {
    links.push({ href: '/for-partners', label: 'For partners' });
  }
  if (profile !== 'facility' && profile !== 'rep') {
    links.push({ href: '/for-reps', label: 'For facility teams' });
  }
  if (profile !== 'seeker') {
    links.push({ href: '/for-providers', label: 'For providers' });
    links.push({ href: '/pricing', label: 'Pricing' });
  }
  if (dashboardHref) links.push({ href: dashboardHref, label: 'My dashboard' });
  return links;
}

export default function SiteMenu({
  profile = 'none',
  dashboardHref = null,
  authed = false,
}: {
  profile?: Profile;
  dashboardHref?: string | null;
  authed?: boolean;
}) {
  // Role is resolved CLIENT-side (fetch /api/me/menu) so the (public) layout stays
  // cookie-free and every public page can be statically/ISR cached. Starts anonymous
  // and upgrades after hydration — the menu is chrome, not indexed content.
  const [menu, setMenu] = useState<{ profile: Profile; dashboardHref: string | null; authed: boolean }>({
    profile,
    dashboardHref,
    authed,
  });
  useEffect(() => {
    let alive = true;
    fetch('/api/me/menu', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setMenu({ profile: d.profile ?? 'none', dashboardHref: d.dashboardHref ?? null, authed: !!d.authed });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const [open, setOpen] = useState(false);
  const LINKS = buildLinks(menu.profile, menu.dashboardHref);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <>
      {open && (
        <button
          aria-label="Dismiss navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-ink/25 backdrop-blur-[2px]"
        />
      )}
      <div className="fixed right-3 top-3 z-40 sm:right-5 sm:top-5">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="site-navigation"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/70 bg-white/95 text-ink shadow-lg shadow-ink/15 backdrop-blur transition hover:bg-white hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
        {open && (
          <nav
            id="site-navigation"
            aria-label="Site navigation"
            className="fixed inset-x-3 top-[4.5rem] max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-2xl border border-white/70 bg-white/95 p-2 shadow-2xl shadow-ink/25 backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-72"
          >
            <div className="px-3 pb-2 pt-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Clear Bed Recovery</div>
              <p className="mt-1 text-xs text-slate-500">{SUBTITLE[menu.profile]}</p>
            </div>
            <div className="space-y-1 border-t border-slate-100 pt-2">
              {LINKS.map((l) => {
                const primary = l.href === '/match';
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={
                      'flex min-h-11 items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ' +
                      (primary
                        ? 'bg-teal-700 text-white hover:bg-teal-800'
                        : 'text-slate-700 hover:bg-teal-50 hover:text-teal-700')
                    }
                  >
                    <span>{l.label}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className={primary ? 'text-white/80' : 'text-slate-400'}>
                      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                );
              })}
            </div>
            {!menu.authed && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center justify-between rounded-xl border border-teal-600 px-3 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
                >
                  <span>Log in</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="text-teal-500">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            )}
            {menu.authed && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <span>Sign out</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="text-slate-400">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </form>
              </div>
            )}
            <div className="mt-2 border-t border-slate-100 pt-2">
              <a
                href="tel:988"
                className="flex min-h-11 items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                <span>Crisis support: call or text 988</span>
                <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
                  <path d="M7 4h3l2 5-2 1.5a11 11 0 003.5 3.5L15 12l5 2v3a3 3 0 01-3 3A15 15 0 014 7a3 3 0 013-3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
