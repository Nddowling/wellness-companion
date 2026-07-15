import Link from 'next/link';

import { requireAdmin } from '@/lib/auth';
import { getAdminMetrics } from '@/lib/metrics';

export default async function AdminDashboard() {
  await requireAdmin();
  const m = await getAdminMetrics();

  const cards: { label: string; value: number | string; sub?: string; href?: string; accent?: boolean }[] = [
    { label: 'Active facilities', value: m.facilitiesActive, sub: `${m.facilitiesInactive} inactive · ${m.facilitiesTotal} total`, href: '/admin/facilities' },
    { label: 'Fresh residential beds', value: m.openBeds, sub: 'positive reports from the past 7 days' },
    { label: 'Active seekers', value: m.seekersActive, sub: `${m.seekersTotal} total`, href: '/admin/seekers' },
    { label: 'Matches', value: m.matchesTotal, sub: `${m.matchesRouted} routed · ${m.matchesConnected} connected` },
    { label: 'Pending claims', value: m.claimsPending, sub: 'facility access requests', href: '/admin/claims', accent: m.claimsPending > 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Admin dashboard</h1>
        <p className="text-sm text-slate-500">The whole platform at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => {
          const inner = (
            <div
              className={
                'rounded-xl border bg-white p-4 ' +
                (c.accent ? 'border-terracotta/40 ring-1 ring-terracotta/30' : 'border-slate-200')
              }
            >
              <div className="text-3xl font-semibold text-slate-800">{c.value}</div>
              <div className="mt-1 text-sm font-medium text-slate-600">{c.label}</div>
              {c.sub && <div className="text-xs text-slate-400">{c.sub}</div>}
            </div>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="transition hover:opacity-80">
              {inner}
            </Link>
          ) : (
            <div key={c.label}>{inner}</div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/admin/facilities" className="rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-300">
          <div className="font-medium text-slate-800">Facilities</div>
          <div className="text-xs text-slate-500">Add, edit, activate, assign members</div>
        </Link>
        <Link href="/admin/seekers" className="rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-300">
          <div className="font-medium text-slate-800">Seekers</div>
          <div className="text-xs text-slate-500">View, edit, and manage seeker records</div>
        </Link>
        <Link href="/admin/claims" className="rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-300">
          <div className="font-medium text-slate-800">Facility claims</div>
          <div className="text-xs text-slate-500">Approve facility access requests</div>
        </Link>
      </div>
    </div>
  );
}
