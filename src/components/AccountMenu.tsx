'use client';

import Link from 'next/link';
import { useState } from 'react';

import { signOut } from '@/app/(app)/actions';

export function AccountMenu({
  email,
  inviteHref,
  extraItems = [],
}: {
  email: string;
  inviteHref: string | null;
  // Profile-specific links injected by the layout (e.g. admin-only "Seeker contacts").
  extraItems?: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-transparent"
        />
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative z-40 flex items-center gap-2 rounded-full border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:border-teal-400"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 text-[10px] font-semibold text-white">
          {email.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-[160px] truncate sm:inline">{email}</span>
        <span className="text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 sm:hidden">{email}</div>
          {extraItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700"
            >
              {item.label}
            </Link>
          ))}
          {inviteHref && (
            <Link
              href={inviteHref}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700"
            >
              Invite staff member
            </Link>
          )}
          <form action={signOut}>
            <button className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-teal-50">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
