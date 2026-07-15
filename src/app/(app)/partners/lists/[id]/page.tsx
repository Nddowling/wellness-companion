import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requirePartner } from '@/lib/auth';
import {
  cityState,
  directPhone,
  getListDetail,
  levelsLabel,
  programListedPaymentSummary,
} from '@/lib/partner/data';
import { absoluteUrl } from '@/lib/seo';
import { CopyLink } from '@/components/partner/CopyLink';
import {
  deleteListAction,
  removeFromListAction,
  toggleShareAction,
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

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-slate-800">{list.title}</h1>
        <p className="mt-1 text-xs text-slate-500">
          This system-generated label cannot contain a client name. Add only program options; client notes are not stored.
        </p>
      </div>

      {/* Share controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-700">Share this program shortlist</div>
            <div className="text-xs text-slate-500">
              {shareUrl
                ? 'Anyone with the active link can view or print this list.'
                : 'Create an unguessable link; anyone you give it to can view or print the list.'}
            </div>
          </div>
          <form action={toggleShareAction}>
            <input type="hidden" name="list_id" value={list.id} />
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
        {items.map(({ facility: f }) => {
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
                {phone ? `Direct: ${phone}` : 'Call to verify'} · Program-listed payment options:{' '}
                {programListedPaymentSummary(f)}
              </div>
              <div className="text-xs text-slate-400">
                Verify network status, benefits, coverage, and program suitability directly.
              </div>
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
