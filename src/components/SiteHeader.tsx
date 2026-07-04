'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/Logo';
import { FindTreatmentSearch } from '@/components/search/FindTreatmentSearch';

// Persistent interior-page header: logo home-link + the universal search, on
// every browse/profile/content page. The homepage keeps its hero search and the
// full-height /match flow stays chrome-free, so the header hides on both. The
// floating hamburger (SiteMenu, fixed top-right z-40) sits above the header's
// reserved right gutter — one is "search", the other is "menu".
export default function SiteHeader() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  if (pathname === '/' || pathname === '/match' || pathname.startsWith('/match/')) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 pr-14 sm:pr-16">
        <Link href="/" aria-label="Clear Bed Recovery home" className="shrink-0">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search treatment"
          className="ml-auto flex min-w-0 max-w-md flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-left text-sm text-slate-500 shadow-sm transition hover:border-teal-300 hover:text-slate-600 sm:ml-4"
        >
          <svg className="h-4 w-4 shrink-0 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <span className="truncate">Search — place, condition, insurance…</span>
        </button>
      </div>
      <FindTreatmentSearch trigger="none" open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
