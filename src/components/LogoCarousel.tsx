'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

import { PayerMark } from '@/components/PayerLogo';
import type { PayerBrand } from '@/lib/payers';

export type LogoItem = {
  slug: string; // used for the logo file at /images/insurance/{slug}.svg
  name: string;
  href: string;
  brand: PayerBrand; // fallback mark when no logo image is present
};

// A horizontal, arrow-scrollable carousel of brand tiles. Each tile renders the real
// carrier logo (/public/images/insurance/{slug}.svg or .png) when present, and cleanly
// falls back to the brand monogram + name when it isn't — so the row always looks right,
// and dropping in real logos later needs zero code changes.
export function LogoCarousel({ title, items }: { title: string; items: LogoItem[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <section className="py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="mb-5 text-2xl font-semibold text-slate-800">{title}</h2>
        <div className="relative">
          <ArrowButton dir={-1} onClick={() => scrollBy(-1)} />
          <div
            ref={scroller}
            className="flex snap-x gap-4 overflow-x-auto scroll-smooth px-12 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item) => (
              <Tile key={item.slug} item={item} />
            ))}
          </div>
          <ArrowButton dir={1} onClick={() => scrollBy(1)} />
        </div>
      </div>
    </section>
  );
}

function Tile({ item }: { item: LogoItem }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <Link
      href={item.href}
      title={item.name}
      aria-label={`Centers that accept ${item.name}`}
      className="group relative flex h-28 w-44 shrink-0 snap-start items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 transition hover:bg-white hover:shadow-md hover:ring-teal-300"
    >
      {imgOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/images/insurance/${item.slug}.svg`}
          alt={item.name}
          onError={() => setImgOk(false)}
          className="max-h-12 max-w-[75%] object-contain"
        />
      ) : (
        <span className="flex flex-col items-center gap-2 px-3 text-center">
          <PayerMark brand={item.brand} size="lg" />
          <span className="text-sm font-semibold text-slate-700">{item.name}</span>
        </span>
      )}
      <span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100">
        {item.name}
      </span>
    </Link>
  );
}

function ArrowButton({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 1 ? 'Scroll right' : 'Scroll left'}
      className={
        'absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:text-teal-700 ' +
        (dir === 1 ? 'right-0' : 'left-0')
      }
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className={dir === 1 ? '' : 'rotate-180'}>
        <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
