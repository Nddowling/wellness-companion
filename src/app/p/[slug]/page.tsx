import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getRepBySlug, getRepVerifiedFacilities } from '@/lib/rep/data';
import { Logo } from '@/components/Logo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getRepBySlug(slug);
  if (!profile) return { title: 'Profile not found' };
  const title = profile.headline ? `${profile.display_name} — ${profile.headline}` : profile.display_name;
  return { title, description: profile.bio ?? `${profile.display_name} on Clear Bed Recovery.` };
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function RepPublicProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getRepBySlug(slug);
  if (!profile) notFound();
  const facilities = await getRepVerifiedFacilities(profile.user_id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/" aria-label="Clear Bed Recovery — home">
        <Logo className="text-lg" />
      </Link>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-4">
          {profile.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photo_url} alt={profile.display_name} className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-700 text-xl font-semibold text-white">
              {initials(profile.display_name)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-800">{profile.display_name}</h1>
            {profile.headline && <p className="text-sm text-slate-600">{profile.headline}</p>}
            {profile.location && <p className="text-xs text-slate-400">{profile.location}</p>}
          </div>
        </div>

        {profile.linkedin_url && (
          <a
            href={profile.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-medium text-teal-700 hover:underline"
          >
            View LinkedIn →
          </a>
        )}

        {profile.bio && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-700">{profile.bio}</p>}

        {profile.specialties.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Specialties</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.specialties.map((s) => (
                <span key={s} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {facilities.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Represents</div>
            <div className="mt-2 space-y-2">
              {facilities.map(({ facility, title }) => (
                <Link
                  key={facility.id}
                  href={`/programs/${facility.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-teal-300"
                >
                  <span className="font-medium text-slate-800">{facility.name}</span>
                  <span className="text-xs text-slate-500">{title || [facility.city, facility.state].filter(Boolean).join(', ')}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        A professional profile on Clear Bed Recovery — a treatment-program directory.
      </p>
    </main>
  );
}
