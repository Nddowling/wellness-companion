import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { stateName, stateSlug } from '@/lib/geo';
import { throwOnPublicReadError } from '@/lib/public-read-error';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Find Addiction Treatment by State',
  description:
    'Browse listed addiction-treatment programs by state — including some that report co-occurring mental-health services — with source and availability freshness cues.',
  alternates: { canonical: '/treatment' },
  openGraph: {
    title: 'Find Addiction Treatment by State | Clear Bed Recovery',
    description:
      'Browse addiction-treatment programs by state, listed level of care, and city — with dated availability reports.',
    url: absoluteUrl('/treatment'),
  },
};

// Deterministic per-state hue so states without a photo still get their own distinct
// (but on-brand) tile instead of 15 identical dark squares.
function hueFor(code: string): number {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

// The url() layer sits above the color layer; if that state's photo doesn't exist the
// image layer just fails to paint and the tinted color shows through. Public-domain
// terrain photos live in /public/states/{code}.jpg — see CREDITS.txt.
function tileStyle(code: string): React.CSSProperties {
  const c = code.toLowerCase();
  return {
    backgroundImage: `linear-gradient(180deg,rgba(15,59,52,0.20),rgba(15,59,52,0.66)),url(/states/${c}.jpg)`,
    backgroundColor: `hsl(${hueFor(c)} 32% 30%)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

export default async function TreatmentIndex() {
  const admin = createAdminClient();
  // True per-state counts via a SQL aggregate — not subject to PostgREST's 1,000-row cap
  // (a plain select would only see the first 1,000 of ~13.5k and undercount every state).
  const client = admin as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { code?: string | null } | null }>;
  };
  const { data, error } = await client.rpc('facilities_state_counts', {});
  throwOnPublicReadError('treatment state counts', error);
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
        Browse listed addiction-treatment programs by state — detox, residential, PHP, IOP, and outpatient —
        with dated availability reports and clear freshness cues. {SITE_NAME} connects you to treatment facilities;
        we don&apos;t provide treatment ourselves.
      </p>

      <div className="mt-6">
        <Link href="/match" className="text-sm font-medium text-teal-700 hover:underline">
          Or narrow the directory with 3 quick questions →
        </Link>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-teal-700">Browse by state</h2>
      {states.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Programs are being added — check back soon.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          {states.map((s) => (
            <li key={s.code}>
              <Link
                href={`/treatment/${s.slug}`}
                className="group relative block aspect-square overflow-hidden rounded-2xl ring-1 ring-black/5 transition hover:ring-2 hover:ring-teal-400"
              >
                {/* Photo of that state's outdoor terrain under a teal wash. States we
                    don't have a public-domain photo for yet 404 the url() layer, which
                    simply reveals the tinted backgroundColor — a clean branded fallback
                    with no broken-image state and no filesystem lookup at render. */}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105"
                  style={tileStyle(s.code)}
                />
                <span className="absolute inset-0 grid place-items-center px-1.5 text-center">
                  <span>
                    <span className="block font-serif text-xs leading-tight text-white [text-shadow:0_1px_4px_rgba(0,0,0,.6)] sm:text-lg">
                      {s.name}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,.6)] sm:text-[11px]">
                      {s.n} program{s.n === 1 ? '' : 's'}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
