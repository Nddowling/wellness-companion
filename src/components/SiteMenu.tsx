'use client';

import Link from 'next/link';
import { useState } from 'react';

type NavLink = { href: string; label: string };

// Provider-side users (facility/BD, not a Global Admin) never see the seeker AI
// "Find care" / "My saved matches" entries — they get a dashboard shortcut instead.
function buildLinks(providerSide: boolean, dashboardHref: string | null): NavLink[] {
  const links: NavLink[] = [{ href: '/', label: 'Home' }];
  if (!providerSide) links.push({ href: '/match', label: 'Find care' });
  links.push({ href: '/programs', label: 'Browse programs' });
  links.push({ href: '/treatment', label: 'Browse by state' });
  links.push({ href: '/guides', label: 'Guides' });
  if (!providerSide) links.push({ href: '/me', label: 'My saved matches' });
  if (dashboardHref) links.push({ href: dashboardHref, label: 'My dashboard' });
  links.push({ href: '/for-providers', label: 'For providers' });
  links.push({ href: '/pricing', label: 'Pricing' });
  return links;
}

export default function SiteMenu({
  providerSide = false,
  dashboardHref = null,
}: {
  providerSide?: boolean;
  dashboardHref?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const LINKS = buildLinks(providerSide, dashboardHref);

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
