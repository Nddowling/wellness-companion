'use client';

import { useState } from 'react';
import { cn } from './cn';

// Question/answer disclosure list — powers profile FAQs and any "expand for
// detail" group. Multiple items can be open at once (default) so people can scan
// several answers. Whole row is the tap target (≥44px) for thumbs.

export type AccordionItem = {
  id: string;
  trigger: React.ReactNode;
  content: React.ReactNode;
};

export type AccordionProps = {
  items: AccordionItem[];
  /** Allow only one open at a time. Default: multiple. */
  single?: boolean;
  /** Ids open on first render. */
  defaultOpen?: string[];
  className?: string;
};

export function Accordion({ items, single, defaultOpen = [], className }: AccordionProps) {
  const [open, setOpen] = useState<Set<string>>(new Set(defaultOpen));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(single ? [] : prev);
      if (prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={cn('divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white', className)}>
      {items.map((item) => {
        const isOpen = open.has(item.id);
        return (
          <div key={item.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(item.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-ink hover:bg-slate-50"
            >
              <span>{item.trigger}</span>
              <span
                aria-hidden
                className={cn('shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')}
              >
                ⌄
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 text-sm leading-relaxed text-slate-600">{item.content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
