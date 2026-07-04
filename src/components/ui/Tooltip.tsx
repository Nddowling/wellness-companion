'use client';

import { useId, useState } from 'react';
import { cn } from './cn';

// Plain-English explainer that sits touching the term it explains. Hover or
// focus on desktop, tap on touch — the label keeps a dotted underline so people
// know it's explainable. Content is read to screen readers via aria-describedby.

export type TooltipProps = {
  /** The term/affordance the tooltip explains. */
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
};

export function Tooltip({ children, content, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-xl"
        >
          {content}
        </span>
      )}
    </span>
  );
}
