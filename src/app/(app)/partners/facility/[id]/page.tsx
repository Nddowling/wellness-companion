import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requirePartner } from '@/lib/auth';
import {
  acceptedSummary,
  cityState,
  directPhone,
  getFacilitySummaries,
  getPartnerLists,
  getSavedFacilityIds,
  levelsLabel,
} from '@/lib/partner/data';
import { AddToListMenu } from '@/components/partner/AddToListMenu';
import { RecordView } from '@/components/partner/RecordView';
import { BedChip } from '@/components/FacilityCard';
import { toggleSaveAction } from '@/app/(app)/partners/actions';

export default async function PartnerFacility({ params }: { params: Promise<{ id: string }> }) {
  await requirePartner();
  const { id } = await params;
  const [f] = await getFacilitySummaries([id]);
  if (!f) notFound();

  const [savedIds, lists] = await Promise.all([getSavedFacilityIds(), getPartnerLists()]);
  const saved = savedIds.includes(f.id);
  const listOpts = lists.map((l) => ({ id: l.id, title: l.title }));
  const phone = directPhone(f);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <RecordView facilityId={f.id} />

      <Link href="/partners/search" className="text-sm text-teal-700 hover:underline">
        ← Back to search
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-800">{f.name}</h1>
          <BedChip caps={f.facility_capacity} levels={f.levels_of_care} />
        </div>
        <p className="mt-1 text-sm text-slate-500">{cityState(f)}</p>

        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Levels of care</dt>
            <dd className="text-slate-700">{levelsLabel(f.levels_of_care)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Insurance accepted</dt>
            <dd className="text-slate-700">{acceptedSummary(f)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Direct intake line</dt>
            <dd className="text-slate-700">
              {phone ? (
                <a href={`tel:${phone}`} className="font-semibold text-teal-700 hover:underline">
                  {phone}
                </a>
              ) : (
                'Call to verify — number on file with the program'
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Call intake
            </a>
          )}
          <form action={toggleSaveAction}>
            <input type="hidden" name="facility_id" value={f.id} />
            <input type="hidden" name="saved" value={saved ? '1' : '0'} />
            <button
              className={
                'rounded-full px-4 py-2 text-sm font-medium transition ' +
                (saved
                  ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border border-slate-300 text-slate-600 hover:border-teal-400 hover:text-teal-700')
              }
            >
              {saved ? '★ Saved' : '☆ Save'}
            </button>
          </form>
          <AddToListMenu facilityId={f.id} lists={listOpts} />
        </div>
      </div>

      <Link href={`/programs/${f.id}`} className="inline-block text-sm font-medium text-teal-700 hover:underline">
        Open the full public profile →
      </Link>
    </div>
  );
}
