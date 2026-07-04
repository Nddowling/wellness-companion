'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from './cn';

// Lightweight anchored panel for desktop dropdowns (filter groups, menus). Opens
// on trigger click, closes on outside-click / Esc. Positioned relative to the
// trigger wrapper — no floating-ui dependency. On phones, prefer <Dialog
// placement="sheet"> instead; FilterBar picks per breakpoint.

export type PopoverProps = {
  /** The clickable trigger. Receives aria props + ref via cloneless wrapper. */
  trigger: React.ReactNode;
  children: React.ReactNode;
  /** Horizontal alignment of the panel against the trigger. */
  align?: 'start' | 'end';
  className?: string;
  panelClassName?: string;
};

export function Popover({ trigger, children, align = 'start', className, panelClassName }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center outline-none"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={panelId}
          className={cn(
            'absolute top-full z-50 mt-2 min-w-[16rem] rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-fade-up',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
