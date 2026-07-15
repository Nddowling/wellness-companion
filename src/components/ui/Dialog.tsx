'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

// One modal primitive for the whole app (replaces the ad-hoc overlays). Portals
// to <body>, locks scroll, closes on Esc / backdrop, traps + restores focus.
// placement drives the desktop↔mobile transform we want everywhere:
//   'responsive' (default) → bottom sheet on phones, centered modal on desktop
//   'center' → always a centered modal (confirmations)
//   'sheet'  → always a bottom sheet

export type DialogPlacement = 'responsive' | 'center' | 'sheet';

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Accessible title; also rendered in the header row when `header` is omitted. */
  title?: string;
  /** Custom header content (overrides the default title row). */
  header?: React.ReactNode;
  placement?: DialogPlacement;
  className?: string;
  /** Hide the default × button (e.g. when the content supplies its own). */
  hideClose?: boolean;
  /** Element to focus when the dialog opens. Falls back to the first focusable control. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Required dialogs can disable Escape and backdrop dismissal independently. */
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
};

const placements: Record<DialogPlacement, { wrap: string; panel: string }> = {
  responsive: {
    wrap: 'items-end justify-center sm:items-center',
    panel: 'w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] sm:max-h-[85vh]',
  },
  center: { wrap: 'items-center justify-center p-4', panel: 'w-full max-w-lg rounded-2xl max-h-[85vh]' },
  sheet: { wrap: 'items-end justify-center', panel: 'w-full rounded-t-2xl max-h-[88vh]' },
};

const subscribeToClient = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function Dialog({
  open,
  onClose,
  children,
  title,
  header,
  placement = 'responsive',
  className,
  hideClose,
  initialFocusRef,
  closeOnEscape = true,
  closeOnBackdrop = true,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const canUseDOM = useSyncExternalStore(subscribeToClient, getClientSnapshot, getServerSnapshot);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !canUseDOM) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background = Array.from(document.body.children)
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node !== overlayRef.current)
      .map((node) => ({
        node,
        inert: node.inert,
        ariaHidden: node.getAttribute('aria-hidden'),
      }));
    for (const item of background) {
      item.node.inert = true;
      item.node.setAttribute('aria-hidden', 'true');
    }
    // focus the panel (or first focusable) on open
    const focusTimer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (initialFocusRef?.current ?? focusable ?? panelRef.current)?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (closeOnEscape) onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null);
        if (nodes.length === 0) {
          e.preventDefault();
          panelRef.current.focus();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const activeElement = document.activeElement;
        if (!panelRef.current.contains(activeElement)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      for (const item of background) {
        item.node.inert = item.inert;
        if (item.ariaHidden === null) item.node.removeAttribute('aria-hidden');
        else item.node.setAttribute('aria-hidden', item.ariaHidden);
      }
      restoreRef.current?.focus?.();
    };
  }, [canUseDOM, closeOnEscape, initialFocusRef, open]);

  if (!open) return null;
  const p = placements[placement];

  const dialog = (
    <div
      ref={overlayRef}
      className={cn('fixed inset-0 z-[60] flex bg-ink/40 backdrop-blur-[2px]', p.wrap)}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex flex-col overflow-hidden bg-white shadow-2xl outline-none',
          'animate-fade-up',
          p.panel,
          className,
        )}
      >
        {(header || title || !hideClose) && (
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
            {header ?? (title ? <h2 id={titleId} className="h3">{title}</h2> : <span />)}
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-ink"
              >
                <span aria-hidden className="text-lg leading-none">×</span>
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );

  // Keep initially-open dialogs in the server HTML, then move them into the
  // body portal after hydration. This prevents both a hydration mismatch and a
  // flash of unprotected background content on required first-load dialogs.
  if (!canUseDOM) return dialog;
  return createPortal(dialog, document.body);
}
