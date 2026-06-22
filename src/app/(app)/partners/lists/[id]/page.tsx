import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requirePartner } from '@/lib/auth';
import { acceptedSummary, cityState, directPhone, getListDetail, levelsLabel } from '@/lib/partner/data';
import { absoluteUrl } from '@/lib/seo';
import { CopyLink } from '@/components/partner/CopyLink';
import {
  deleteListAction,
  removeFromListAction,
  renameListAction,
  toggleShareAction,
  updateItemNoteAction,
} from '@/app/(app)/partners/actions';

export default async function ListDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePartner();
  const { id } = await params;
  const detail = await getListDetail(id);
  if (!detail) notFound();
  const { list, items } = detail;
  const shareUrl = list.share_token ? absoluteUrl(`/share/${list.share_token}`) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/partners/lists" className="text-sm text-teal-700 hover:underline">
        ← All shortlists
      </Link>

      {/* Title + intro */}
      <form action={renameListAction} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="list_id" value={list.id} />
        <input
          name="title"
          defaultValue={list.title}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-lg font-semibold text-slate-800"
        />
        <textarea
          name="intro"
          defaultValue={list.intro ?? ''}
          placeholder="A warm note for the family (shown at the top of the shared list)…"
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
        />
        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
          Save
        </button>
      </form>

      {/* Share controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-700">Share with a family</div>
            <div className="text-xs text-slate-500">
              {shareUrl ? 'Anyone with the link can view this list.' : 'Turn on a private link to share or print.'}
            </div>
          </div>
          <form action={toggleShareAction}>
            <input type="hidden" name="list_id" value={list.id} />
            <input type="hidden" name="shared" value={shareUrl ? '1' : '0'} />
            <button
              className={
                'rounded-full px-4 py-2 text-sm font-medium transition ' +
                (shareUrl
                  ? 'border border-slate-300 text-slate-600 hover:border-red-300 hover:text-red-600'
                  : 'bg-teal-700 text-white hover:bg-teal-800')
              }
            >
              {shareUrl ? 'Stop sharing' : 'Create share link'}
            </button>
          </form>
        </div>
        {shareUrl && (
          <div className="mt-3 space-y-2">
            <CopyLink url={shareUrl} />
            <Link href={`/share/${list.share_token}`} className="inline-block text-xs font-medium text-teal-700 hover:underline">
              Open the shared view →
            </Link>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">
          {items.length} {items.length === 1 ? 'program' : 'programs'}
        </h2>
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No programs yet. Add them from{' '}
            <Link href="/partners/search" className="font-medium text-teal-700 underline">
              search
            </Link>
            .
          </p>
        )}
        {items.map(({ facility: f, note }) => {
          const phone = directPhone(f);
          return (
            <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/partners/facility/${f.id}`} className="font-medium text-slate-800 hover:text-teal-700">
                  {f.name}
                </Link>
                <form action={removeFromListAction}>
                  <input type="hidden" name="list_id" value={list.id} />
                  <input type="hidden" name="facility_id" value={f.id} />
                  <button className="text-xs text-slate-400 hover:text-red-600">Remove</button>
                </form>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {cityState(f)} · {levelsLabel(f.levels_of_care)}
              </div>
              <div className="text-xs text-slate-500">
                {phone ? `Direct: ${phone}` : 'Call to verify'} · Accepts: {acceptedSummary(f)}
              </div>
              <form action={updateItemNoteAction} className="mt-2 flex gap-2">
                <input type="hidden" name="list_id" value={list.id} />
                <input type="hidden" name="facility_id" value={f.id} />
                <input
                  name="note"
                  defaultValue={note ?? ''}
                  placeholder="Note for the family about this program…"
                  className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                />
                <button className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-600 hover:border-teal-400">
                  Save note
                </button>
              </form>
            </div>
          );
        })}
      </div>

      {/* Danger zone */}
      <form action={deleteListAction} className="pt-2">
        <input type="hidden" name="list_id" value={list.id} />
        <button className="text-xs text-slate-400 hover:text-red-600">Delete this shortlist</button>
      </form>
    </div>
  );
}
