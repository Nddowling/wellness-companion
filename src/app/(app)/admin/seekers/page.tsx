import Link from 'next/link';

import { requireAdmin } from '@/lib/auth';
import { listSeekers } from '@/lib/vault/seekers';

export default async function AdminSeekers() {
  await requireAdmin();
  const seekers = await listSeekers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Seeker contacts</h1>
        <p className="text-sm text-slate-500">
          {seekers.length} {seekers.length === 1 ? 'contact' : 'contacts'} · everyone who shared their details through
          the guided connection flow. Protected information — handle with care.
        </p>
      </div>

      <div className="space-y-2">
        {seekers.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No seekers yet.
          </p>
        )}
        {seekers.map((s) => (
          <Link
            key={s.id}
            href={`/admin/seekers/${s.id}`}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-4 hover:border-teal-300"
          >
            <div className="min-w-0">
              <div className="font-medium text-slate-800">{s.name || 'Consented connector contact'}</div>
              <div className="truncate text-xs text-slate-500">
                {[s.email, s.phone].filter(Boolean).join(' · ') || 'contact unavailable'} ·{' '}
                {new Date(s.created_at).toLocaleDateString()}
              </div>
            </div>
            <span
              className={
                'rounded-full px-2 py-0.5 text-xs ' +
                (s.status === 'connected'
                  ? 'bg-emerald-100 text-emerald-800'
                  : s.status === 'unsubscribed'
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-teal-100 text-teal-800')
              }
            >
              {s.status}
            </span>
          </Link>
        ))}
      </div>

    </div>
  );
}
