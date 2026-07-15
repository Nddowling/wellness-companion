'use client';

import { useState } from 'react';

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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-teal-400 hover:text-teal-700"
      >
        + Add to list
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            {lists.length > 0 && (
              <div className="max-h-52 overflow-y-auto">
                {lists.map((l) => (
                  <form key={l.id} action={addToListAction} onSubmit={() => setOpen(false)}>
                    <input type="hidden" name="list_id" value={l.id} />
                    <input type="hidden" name="facility_id" value={facilityId} />
                    <button className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700">
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
              <button className="w-full rounded-md bg-teal-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-teal-800">
                Create shortlist &amp; add
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
