'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export type TabIcon = 'home' | 'facility' | 'referrer' | 'admin' | 'care' | 'chat';
export type Tab = { href: string; label: string; icon: TabIcon };

// Small stroked icons so the bar reads like a native app's tab bar.
const ICONS: Record<TabIcon, ReactNode> = {
  home: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
  facility: <path d="M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 9h4a1 1 0 011 1v11M8 8h.01M11 8h.01M8 12h.01M11 12h.01M8 16h3" />,
  referrer: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3 2.7-5 5.5-5s5.5 2 5.5 5M16 7a3 3 0 010 6M20.5 20c0-2.3-1.4-3.9-3.5-4.6" />
    </>
  ),
  admin: <path d="M12 3l8 3v5c0 5-3.4 7.7-8 9-4.6-1.3-8-4-8-9V6z" />,
  care: <path d="M12 21s-7-4.3-9.3-9.1C1.2 8.9 3 5.5 6.2 5.5c2 0 3.2 1.1 3.8 2.2h.4c.6-1.1 1.8-2.2 3.8-2.2 3.2 0 5 3.4 3.5 6.4C19 16.7 12 21 12 21z" />,
  chat: <path d="M21 11.5a8.4 8.4 0 01-9 8.4 8.7 8.7 0 01-3.8-.8L3 20l1.3-4a8.3 8.3 0 01-1-4 8.4 8.4 0 019-8.4 8.4 8.4 0 018.7 7.9z" />,
};

export function MobileTabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  const activeHref = tabs.reduce<string | null>((longest, tab) => {
    const matches = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
    if (!matches) return longest;
    return longest === null || tab.href.length > longest.length ? tab.href : longest;
  }, null);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map((t) => {
          const active = activeHref === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={
                'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition ' +
                (active ? 'text-teal-700' : 'text-slate-500 hover:text-slate-700')
              }
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {ICONS[t.icon]}
              </svg>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
