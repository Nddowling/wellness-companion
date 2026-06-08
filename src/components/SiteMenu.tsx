'use client';

import Link from 'next/link';
import { useState } from 'react';

type NavLink = { href: string; label: string };
type Profile = 'admin' | 'facility' | 'seeker' | 'none';

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
}: {
  profile?: Profile;
  dashboardHref?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const LINKS = buildLinks(profile, dashboardHref);

  return (
    <>
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-transparent"
        />
      )}
      <div className="fixed right-3 top-3 z-40">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg text-slate-700 shadow ring-1 ring-slate-200 backdrop-blur hover:text-teal-700"
        >
          {open ? '✕' : '☰'}
        </button>
        {open && (
          <nav className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700"
              >
                {l.label}
              </Link>
            ))}
            <a
              href="tel:988"
              className="block border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              Crisis line — call or text 988
            </a>
          </nav>
        )}
      </div>
    </>
  );
}
