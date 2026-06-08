import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import JsonLd from '@/components/JsonLd';
import { FacilityCard, type FacilityCardData } from '@/components/FacilityCard';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { LEVELS_OF_CARE, LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';
import { codeFromStateSlug, stateName, stateSlug, slugify } from '@/lib/geo';

export const revalidate = 3600;

type Row = FacilityCardData;

async function load(stateSlugParam: string) {
  const code = codeFromStateSlug(stateSlugParam);
  if (!code) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facilities')
    .select('id, name, city, state, levels_of_care')
    .eq('is_published', true)
    .ilike('state', code)
    .order('name');
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return null;
  return { code, rows };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state } = await params;
  const loaded = await load(state);
  if (!loaded) return { title: 'Treatment not found', robots: { index: false, follow: true } };
  const name = stateName(loaded.code);
  const title = `Addiction & Mental Health Treatment in ${name}`;
  const description = `Browse ${loaded.rows.length} vetted treatment programs in ${name} — detox, residential, PHP, IOP, and outpatient — with real-time bed availability. Free and private; no account required.`;
  return {
    title,
    description,
    alternates: { canonical: `/treatment/${state}` },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl(`/treatment/${state}`) },
  };
}

export default async function StatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const loaded = await load(state);
  if (!loaded) notFound();
  const { code, rows } = loaded;
  const name = stateName(code);

  // Levels available in this state (with counts), preserving the canonical order.
  const levelCounts = new Map<string, number>();
  for (const r of rows) for (const l of r.levels_of_care ?? []) levelCounts.set(l, (levelCounts.get(l) ?? 0) + 1);
  const levels = LEVELS_OF_CARE.filter((l) => levelCounts.has(l));

  // Top cities (with counts).
  const cityCounts = new Map<string, number>();
  for (const r of rows) if (r.city) cityCounts.set(r.city, (cityCounts.get(r.city) ?? 0) + 1);
  const cities = [...cityCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Treatment', item: absoluteUrl('/treatment') },
      { '@type': 'ListItem', position: 3, name, item: absoluteUrl(`/treatment/${state}`) },
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <nav className="text-xs text-slate-500">
        <Link href="/treatment" className="text-teal-700 hover:underline">
          Treatment
        </Link>{' '}
        / <span>{name}</span>
      </nav>

      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
        Treatment in <span className="italic text-brand">{name}</span>
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        {rows.length} vetted addiction and mental-health program{rows.length === 1 ? '' : 's'} in {name}, with
        real-time bed availability. {SITE_NAME} connects you to treatment facilities; we don&apos;t provide treatment
        ourselves.
      </p>

      <div className="mt-4">
        <Link href="/match" className="text-sm font-medium text-teal-700 hover:underline">
          Not sure where to start? Get matched in 3 quick questions →
        </Link>
      </div>

      {levels.length > 0 && (
        <section className="mt-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">By level of care</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {levels.map((l) => (
              <Link
                key={l}
                href={`/treatment/${state}/${l}`}
                className="rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-sm font-medium text-teal-800 transition hover:bg-teal-100"
              >
                {LEVEL_LABELS[l as LevelOfCare]} ({levelCounts.get(l)})
              </Link>
            ))}
          </div>
        </section>
      )}

      {cities.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">By city</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {cities.map(([city, n]) => (
              <Link
                key={city}
                href={`/treatment/${state}/${slugify(city)}`}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700 transition hover:border-teal-300"
              >
                {city} ({n})
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          All programs in {name}
        </h2>
        <div className="mt-3 space-y-2">
          {rows.map((f) => (
            <FacilityCard key={f.id} f={f} />
          ))}
        </div>
      </section>
    </main>
  );
}
