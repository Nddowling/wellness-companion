'use client';

import { useState } from 'react';
import { cn } from './cn';

// The "explain-it-right-there" trust expander — a small labeled row with a
// chevron that opens an inline bordered panel of 2–4 plain sentences, sitting
// immediately next to the thing it explains (e.g. "How we rank results",
// "Where this data comes from"). Not a modal; stays open on other interaction.

export type DisclosurePanelProps = {
  /** The clickable summary line, e.g. "How we rank results". */
  label: React.ReactNode;
  children: React.ReactNode;
  /** Small icon/emoji before the label (optional). */
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Tone of the resting row. 'trust' = subtle teal tint for "why trust" boxes. */
  tone?: 'plain' | 'trust';
};

export function DisclosurePanel({
  label,
  children,
  icon,
  defaultOpen = false,
  className,
  tone = 'plain',
}: DisclosurePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(
        'rounded-xl border text-sm',
        tone === 'trust' ? 'border-teal-100 bg-teal-50/50' : 'border-slate-200 bg-white',
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-medium text-ink"
      >
        {icon && <span aria-hidden className="shrink-0">{icon}</span>}
        <span className="flex-1">{label}</span>
        <span aria-hidden className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}>⌄</span>
      </button>
      {open && (
        <div className="border-t border-inherit px-4 py-3 leading-relaxed text-slate-600">{children}</div>
      )}
    </div>
  );
}
