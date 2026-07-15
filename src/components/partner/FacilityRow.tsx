import Link from 'next/link';

import { BedChip } from '@/components/FacilityCard';
import { AddToListMenu } from '@/components/partner/AddToListMenu';
import { toggleSaveAction } from '@/app/(app)/partners/actions';
import {
  cityState,
  directPhone,
  levelsLabel,
  programListedPaymentSummary,
  type FacilitySummary,
} from '@/lib/partner/data';

/**
 * One facility in a partner view — the white-glove row: name, the facility's OWN
 * direct line front-and-center, save, and add-to-list. Built for fast placement.
 */
export function FacilityRow({
  f,
  saved,
  lists,
}: {
  f: FacilitySummary;
  saved: boolean;
  lists: { id: string; title: string }[];
}) {
  const phone = directPhone(f);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-teal-300">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/partners/facility/${f.id}`} className="font-medium text-slate-800 hover:text-teal-700">
          {f.name}
        </Link>
        <BedChip caps={f.facility_capacity} levels={f.levels_of_care} />
      </div>
      <div className="mt-0.5 text-xs text-slate-500">
        {cityState(f)} · {levelsLabel(f.levels_of_care)}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        Program-listed payment options: {programListedPaymentSummary(f)}
      </div>
      <div className="text-xs text-slate-400">
        Not a network, benefits, or coverage guarantee. Verify with the program and payer.
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M7 4h3l2 5-2 1.5a11 11 0 003.5 3.5L15 12l5 2v3a3 3 0 01-3 3A15 15 0 014 7a3 3 0 013-3z" strokeLinejoin="round" />
            </svg>
            {phone}
          </a>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-500">Call to verify</span>
        )}

        <form action={toggleSaveAction}>
          <input type="hidden" name="facility_id" value={f.id} />
          <input type="hidden" name="saved" value={saved ? '1' : '0'} />
          <button
            className={
              'rounded-full px-3 py-1.5 text-xs font-medium transition ' +
              (saved
                ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border border-slate-300 text-slate-600 hover:border-teal-400 hover:text-teal-700')
            }
          >
            {saved ? '★ Saved' : '☆ Save'}
          </button>
        </form>

        <AddToListMenu facilityId={f.id} lists={lists} />

        <Link
          href={`/partners/facility/${f.id}`}
          className="ml-auto text-xs font-medium text-teal-700 hover:underline"
        >
          Details →
        </Link>
      </div>
    </div>
  );
}
