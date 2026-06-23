import Link from 'next/link';

import { getVerifiedTeam } from '@/lib/rep/data';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * "Their team" — verified reps on a facility's public listing. Returns null when
 * there are none, so it's safe to drop into any listing render path (free or paid).
 */
export async function FacilityTeam({ facilityId }: { facilityId: string }) {
  const team = await getVerifiedTeam(facilityId);
  if (!team.length) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Their team</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {team.map((m) => (
          <Link
            key={m.user_id}
            href={`/p/${m.slug}`}
            className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 transition hover:border-teal-300"
          >
            {m.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.photo_url} alt={m.display_name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">
                {initials(m.display_name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-800">{m.display_name}</div>
              <div className="truncate text-xs text-slate-500">{m.title || m.headline || 'Team member'}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
