import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requirePartner } from '@/lib/auth';
import {
  cityState,
  directPhone,
  getFacilitySummaries,
  getPartnerLists,
  getSavedFacilityIds,
  levelsLabel,
  programListedPaymentSummary,
} from '@/lib/partner/data';
import { AddToListMenu } from '@/components/partner/AddToListMenu';
import { RecordView } from '@/components/partner/RecordView';
import { BedChip } from '@/components/FacilityCard';
import { toggleSaveAction, submitReferralAction } from '@/app/(app)/partners/actions';
import { LEVELS_OF_CARE, LEVEL_LABELS, PAYER_TYPES, PAYER_LABELS } from '@/lib/constants';

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
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Program-listed payment options
            </dt>
            <dd className="text-slate-700">{programListedPaymentSummary(f)}</dd>
            <dd className="mt-1 text-xs text-slate-500">
              Not a network, benefits, or coverage guarantee. Verify directly with the program and payer.
            </dd>
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

      {/* Log a limited, non-contact referral to the partner's dashboard. */}
      <form action={submitReferralAction} className="rounded-2xl border border-teal-200 bg-teal-50/60 p-6">
        <input type="hidden" name="facility_id" value={f.id} />
        <h2 className="text-sm font-semibold text-ink">Log this program as a referral option</h2>
        <p className="mt-1 text-xs text-slate-500">
          This records a limited workflow entry. It does not confirm admission, care received, or clinical suitability,
          and no client names or contact details are stored.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="care_level" className="text-xs font-medium text-slate-600">
              Level of care (optional)
            </label>
            <select id="care_level" name="care_level" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <option value="">Any / not sure</option>
              {LEVELS_OF_CARE.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="payer_type" className="text-xs font-medium text-slate-600">
              Payment category (optional)
            </label>
            <select id="payer_type" name="payer_type" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <option value="">Any / not sure</option>
              {PAYER_TYPES.map((p) => (
                <option key={p} value={p}>
                  {PAYER_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
          Log referral →
        </button>
      </form>

      <Link href={`/programs/${f.id}`} className="inline-block text-sm font-medium text-teal-700 hover:underline">
        Open the full public profile →
      </Link>
    </div>
  );
}
