import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { stateName, stateSlug } from '@/lib/geo';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Find Addiction & Mental Health Treatment by State',
  description:
    'Browse vetted addiction and mental-health treatment programs by state — detox, residential, PHP, IOP, and outpatient — with real-time bed availability. Free and private.',
  alternates: { canonical: '/treatment' },
  openGraph: {
    title: 'Find Treatment by State | Clear Bed Recovery',
    description: 'Browse treatment programs by state, level of care, and city — with live bed availability.',
    url: absoluteUrl('/treatment'),
  },
};

export default async function TreatmentIndex() {
  const admin = createAdminClient();
  // True per-state counts via a SQL aggregate — not subject to PostgREST's 1,000-row cap
  // (a plain select would only see the first 1,000 of ~13.5k and undercount every state).
  const client = admin as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  const { data } = await client.rpc('facilities_state_counts', {});
  const states = ((data as { state: string; n: number }[]) ?? [])
    .map(({ state, n }) => {
      const code = (state ?? '').toUpperCase();
      return { code, n: Number(n), name: stateName(code), slug: stateSlug(code) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Find treatment by state', item: absoluteUrl('/treatment') },
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">
        Find treatment <span className="italic text-brand">near you</span>
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        Browse vetted addiction and mental-health programs by state — detox, residential, PHP, IOP, and outpatient —
        with real-time bed availability. {SITE_NAME} connects you to treatment facilities; we don&apos;t provide
        treatment ourselves.
      </p>

      <div className="mt-6">
        <Link href="/match" className="text-sm font-medium text-teal-700 hover:underline">
          Or let our companion match you in 3 quick questions →
        </Link>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-teal-700">Browse by state</h2>
      {states.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Programs are being added — check back soon.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {states.map((s) => (
            <li key={s.code}>
              <Link
                href={`/treatment/${s.slug}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-teal-300"
              >
                <span className="font-medium text-slate-800">{s.name}</span>
                <span className="text-xs text-slate-400">
                  {s.n} program{s.n === 1 ? '' : 's'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
