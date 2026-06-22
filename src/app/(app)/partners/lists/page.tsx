import Link from 'next/link';

import { requirePartner } from '@/lib/auth';
import { getPartnerLists } from '@/lib/partner/data';
import { createListAction } from '@/app/(app)/partners/actions';

export default async function PartnerLists() {
  await requirePartner();
  const lists = await getPartnerLists();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Shortlists</h1>
        <p className="text-sm text-slate-500">
          Build a clean list of options and hand it to a family — share a link or print it.
        </p>
      </div>

      <form action={createListAction} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
        <input
          name="title"
          placeholder="New shortlist name (e.g. “Options for the Reyes family”)"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
          Create list
        </button>
      </form>

      {lists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          No shortlists yet. Create one above, then add programs from search or a facility page.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lists.map((l) => (
            <Link
              key={l.id}
              href={`/partners/lists/${l.id}`}
              className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-teal-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-slate-800">{l.title}</div>
                {l.share_token && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    Shared
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {l.item_count} {l.item_count === 1 ? 'program' : 'programs'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
