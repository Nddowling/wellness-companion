import Link from 'next/link';

import { requirePartner } from '@/lib/auth';
import { getMyReferrals, getMyReferralStats } from '@/lib/referrals/data';
import { LEVEL_LABELS, PAYER_LABELS, type LevelOfCare, type PayerType } from '@/lib/constants';

export const metadata = { title: 'Your referrals' };

const ROUTE_BADGE: Record<string, string> = {
  sent: 'bg-slate-100 text-slate-600',
  viewed: 'bg-sky-50 text-sky-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-rose-50 text-rose-700',
};

const ROUTE_LABEL: Record<string, string> = {
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Marked accepted',
  declined: 'Marked declined',
};

function fmtDate(iso: string): string {
  // Fixed locale/'' args keep server + client render identical (no hydration drift).
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function PartnerReferrals() {
  const user = await requirePartner();
  const [referrals, stats] = await Promise.all([getMyReferrals(user.id), getMyReferralStats(user.id)]);

  const tiles = [
    { label: 'Referral records', value: stats.total },
    { label: 'Routes marked accepted', value: stats.accepted },
    { label: 'In flight', value: stats.open },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Your referrals</h1>
          <p className="text-sm text-slate-500">
            Limited referral workflow records and the latest program-route status on file.
          </p>
        </div>
        <Link
          href="/partners/search"
          className="shrink-0 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Log a referral →
        </Link>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-ink">{t.value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{t.label}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Workflow statuses do not confirm admission, care received, outcomes, benefits, coverage, or clinical
        suitability. Verify directly with the program, payer, and a qualified professional as appropriate.
      </p>

      {/* History */}
      {referrals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            No referrals yet. Open a program from{' '}
            <Link href="/partners/search" className="font-medium text-teal-700 hover:underline">
              the directory
            </Link>{' '}
            and use <span className="font-medium">“Log referral.”</span>
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {referrals.map((r) => (
            <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  {r.careLevel && (
                    <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                      {LEVEL_LABELS[r.careLevel as LevelOfCare] ?? r.careLevel}
                    </span>
                  )}
                  {r.payerType && (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                      {PAYER_LABELS[r.payerType as PayerType] ?? r.payerType}
                    </span>
                  )}
                  {!r.careLevel && !r.payerType && <span className="text-xs text-slate-400">General referral</span>}
                </div>
                <span className="text-xs text-slate-400">{fmtDate(r.createdAt)}</span>
              </div>
              <div className="mt-3 space-y-1.5">
                {r.facilities.length === 0 ? (
                  <p className="text-xs text-slate-400">No facility recorded.</p>
                ) : (
                  r.facilities.map((fac) => (
                    <div key={fac.id} className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                      <Link href={`/partners/facility/${fac.id}`} className="min-w-0 break-words text-sm font-medium text-slate-700 hover:text-teal-700">
                        {fac.name}
                      </Link>
                      <span
                        className={
                          'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                          (ROUTE_BADGE[fac.routeStatus] ?? 'bg-slate-100 text-slate-600')
                        }
                      >
                        {ROUTE_LABEL[fac.routeStatus] ?? 'Status unavailable'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
