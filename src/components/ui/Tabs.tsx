'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { cn } from './cn';

// Segmented tab strip. Two modes so state is always addressable:
//   - URL-synced: pass `param` (e.g. "sort") → the active tab lives in the
//     querystring, so Back/refresh/share preserve it (our #1 nav rule).
//   - Controlled: pass `value` + `onValueChange` for local-only state.
// Renders only the tab list; the caller renders the active panel.

export type TabItem = { value: string; label: React.ReactNode; count?: number };

export type TabsProps = {
  tabs: TabItem[];
  /** URL-synced mode: the search-param key to read/write. */
  param?: string;
  /** Controlled mode. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Fallback active value when neither URL nor `value` is set. */
  defaultValue?: string;
  className?: string;
  size?: 'sm' | 'md';
};

export function Tabs({ tabs, param, value, onValueChange, defaultValue, className, size = 'md' }: TabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [local, setLocal] = useState(defaultValue ?? tabs[0]?.value);

  const active = param
    ? searchParams.get(param) ?? defaultValue ?? tabs[0]?.value
    : value ?? local;

  const select = (v: string) => {
    onValueChange?.(v);
    if (param) {
      const next = new URLSearchParams(searchParams.toString());
      if (v === (defaultValue ?? tabs[0]?.value)) next.delete(param);
      else next.set(param, v);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    } else if (value === undefined) {
      setLocal(v);
    }
  };

  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';

  return (
    <div role="tablist" className={cn('inline-flex flex-wrap gap-1 rounded-full bg-slate-100 p-1', className)}>
      {tabs.map((t) => {
        const on = t.value === active;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            onClick={() => select(t.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full font-medium transition',
              pad,
              on ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-ink',
            )}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span className={cn('tabular-nums text-[11px]', on ? 'text-teal-600' : 'text-slate-400')}>
                {t.count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
