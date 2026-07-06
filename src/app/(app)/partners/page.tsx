import Link from 'next/link';

import { requirePartner } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  getFacilitySummaries,
  getPartnerLists,
  getPartnerProfile,
  getRecentlyViewedIds,
  getSavedFacilityIds,
} from '@/lib/partner/data';
import { FacilityRow } from '@/components/partner/FacilityRow';
import { getMyReferralStats } from '@/lib/referrals/data';

export default async function PartnerHome() {
  const user = await requirePartner();
  const supabase = await createClient();
  const {
    data: { user: full },
  } = await supabase.auth.getUser();
  const fullName = (full?.user_metadata as { full_name?: string } | undefined)?.full_name ?? '';
  const firstName = fullName.split(' ')[0] || null;

  const [profile, savedIds, recentIds, lists, refStats] = await Promise.all([
    getPartnerProfile(user.id),
    getSavedFacilityIds(),
    getRecentlyViewedIds(6),
    getPartnerLists(),
    getMyReferralStats(user.id),
  ]);
  const savedSet = new Set(savedIds);
  const listOpts = lists.map((l) => ({ id: l.id, title: l.title }));
  const recent = await getFacilitySummaries(recentIds);

  const tiles = [
    { href: '/partners/search', label: 'Search the directory', sub: 'Find a program', accent: true },
    { href: '/partners/saved', label: 'Saved facilities', sub: `${savedIds.length} saved` },
    { href: '/partners/lists', label: 'Shortlists', sub: `${lists.length} to share` },
    { href: '/partners/history', label: 'Recently viewed', sub: 'Pick up where you left off' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">
          {firstName ? `Welcome, ${firstName}` : 'Welcome'}
        </h1>
        <p className="text-sm text-slate-500">
          Find the right program and hand it off with confidence. Everything here is free — you never pay to help
          someone into care.
        </p>
      </div>

      {/* Quick search — the daily entry point */}
      <form action="/partners/search" className="flex gap-2">
        <input
          name="q"
          placeholder="Search by program name or city…"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-teal-400 focus:outline-none"
        />
        <button className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800">
          Search
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={
              'rounded-xl border p-4 transition ' +
              (t.accent
                ? 'border-teal-200 bg-teal-50 hover:border-teal-400'
                : 'border-slate-200 bg-white hover:border-teal-300')
            }
          >
            <div className="text-sm font-semibold text-slate-800">{t.label}</div>
            <div className="mt-0.5 text-xs text-slate-500">{t.sub}</div>
          </Link>
        ))}
      </div>

      {/* Referrals — your outbound activity + where it stands */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Your referrals</h2>
          <Link href="/partners/referrals" className="text-xs font-medium text-teal-700 hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: refStats.total },
            { label: 'Reached care', value: refStats.connected },
            { label: 'Accepted', value: refStats.accepted },
            { label: 'In flight', value: refStats.open },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-slate-50 p-3 text-center">
              <div className="text-xl font-semibold text-ink">{s.value}</div>
              <div className="mt-0.5 text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {!profile?.partner_type && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Finish your profile so we can tailor things to how you refer.{' '}
          <Link href="/partners/settings" className="font-semibold underline">
            Complete profile →
          </Link>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Recently viewed</h2>
          {recent.length > 0 && (
            <Link href="/partners/history" className="text-xs font-medium text-teal-700 hover:underline">
              See all →
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            <p>Programs you open will show up here for quick re-access.</p>
            <Link
              href="/partners/search"
              className="mt-3 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white"
            >
              Search the directory
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((f) => (
              <FacilityRow key={f.id} f={f} saved={savedSet.has(f.id)} lists={listOpts} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
