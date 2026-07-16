'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { addToListAction, createListAction } from '@/app/(app)/partners/actions';

/** Small dropdown to drop a facility onto an existing shortlist or a brand-new one. */
export function AddToListMenu({
  facilityId,
  lists,
}: {
  facilityId: string;
  lists: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    const lockScroll = window.matchMedia('(max-width: 639px)').matches;
    if (lockScroll) document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active) || active === panelRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (lockScroll) document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="dialog"
        className="min-h-11 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-teal-400 hover:text-teal-700 sm:min-h-0 sm:py-1.5"
      >
        + Add to list
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close shortlist menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-ink/15 sm:bg-transparent"
          />
          <div
            ref={panelRef}
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="Add program to a shortlist"
            tabIndex={-1}
            className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex max-h-[min(70dvh,28rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl outline-none sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 sm:max-w-[calc(100vw-2rem)]"
          >
            {lists.length > 0 && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {lists.map((l) => (
                  <form key={l.id} action={addToListAction} onSubmit={() => setOpen(false)}>
                    <input type="hidden" name="list_id" value={l.id} />
                    <input type="hidden" name="facility_id" value={facilityId} />
                    <button className="block min-h-11 w-full truncate rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700">
                      {l.title}
                    </button>
                  </form>
                ))}
              </div>
            )}
            <form action={createListAction} onSubmit={() => setOpen(false)} className="border-t border-slate-100 p-2">
              <input type="hidden" name="facility_id" value={facilityId} />
              <p className="px-1 pb-2 text-xs text-slate-500">
                A dated, numbered shortlist will be created without a client name.
              </p>
              <button className="min-h-11 w-full rounded-md bg-teal-700 px-2 py-2 text-xs font-medium text-white hover:bg-teal-800">
                Create shortlist &amp; add
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
