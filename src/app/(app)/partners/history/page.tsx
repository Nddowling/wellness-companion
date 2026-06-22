import Link from 'next/link';

import { requirePartner } from '@/lib/auth';
import { getFacilitySummaries, getPartnerLists, getRecentlyViewedIds, getSavedFacilityIds } from '@/lib/partner/data';
import { FacilityRow } from '@/components/partner/FacilityRow';

export default async function PartnerHistory() {
  await requirePartner();
  const [recentIds, savedIds, lists] = await Promise.all([
    getRecentlyViewedIds(40),
    getSavedFacilityIds(),
    getPartnerLists(),
  ]);
  const facilities = await getFacilitySummaries(recentIds);
  const savedSet = new Set(savedIds);
  const listOpts = lists.map((l) => ({ id: l.id, title: l.title }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Recently viewed</h1>
        <p className="text-sm text-slate-500">Programs you&apos;ve opened, most recent first.</p>
      </div>

      {facilities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          <p>No history yet — programs you open will appear here.</p>
          <Link
            href="/partners/search"
            className="mt-3 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white"
          >
            Search the directory
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {facilities.map((f) => (
            <FacilityRow key={f.id} f={f} saved={savedSet.has(f.id)} lists={listOpts} />
          ))}
        </div>
      )}
    </div>
  );
}
