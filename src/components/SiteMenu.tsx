'use client';

import Link from 'next/link';
import { useState } from 'react';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/match', label: 'Find care' },
  { href: '/programs', label: 'Browse programs' },
  { href: '/me', label: 'My saved matches' },
  { href: '/login', label: 'Provider / team sign in' },
];

export default function SiteMenu() {
  const [open, setOpen] = useState(false);

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
