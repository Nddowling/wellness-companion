import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import JsonLd from '@/components/JsonLd';
import { FacilityCard, type FacilityCardData } from '@/components/FacilityCard';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { LEVELS_OF_CARE, LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';
import { codeFromStateSlug, stateName, slugify } from '@/lib/geo';

export const revalidate = 3600;

function isLevel(seg: string): seg is LevelOfCare {
  return (LEVELS_OF_CARE as readonly string[]).includes(seg);
}

type Resolved = {
  code: string;
  state: string;
  kind: 'level' | 'city';
  // level
  level?: LevelOfCare;
  // city
  cityName?: string;
  rows: FacilityCardData[];
  heading: string; // "Detox" or "Atlanta"
};

async function load(stateParam: string, seg: string): Promise<Resolved | null> {
  const code = codeFromStateSlug(stateParam);
  if (!code) return null;
  const supabase = createAdminClient();

  if (isLevel(seg)) {
    const { data } = await supabase
      .from('facilities')
      .select('id, name, city, state, levels_of_care')
      .eq('is_published', true)
      .ilike('state', code)
      .contains('levels_of_care', [seg])
      .order('name');
    const rows = (data ?? []) as FacilityCardData[];
    if (rows.length === 0) return null;
    return { code, state: stateName(code), kind: 'level', level: seg, rows, heading: LEVEL_LABELS[seg] };
  }

  // City: match on the slug of the stored city name (slug is lossy, so filter here).
  const { data } = await supabase
    .from('facilities')
    .select('id, name, city, state, levels_of_care')
    .eq('is_published', true)
    .ilike('state', code)
    .order('name');
  const all = (data ?? []) as FacilityCardData[];
  const rows = all.filter((f) => f.city && slugify(f.city) === seg);
  if (rows.length === 0) return null;
  return { code, state: stateName(code), kind: 'city', cityName: rows[0].city ?? seg, rows, heading: rows[0].city ?? seg };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; seg: string }>;
}): Promise<Metadata> {
  const { state, seg } = await params;
  const r = await load(state, seg);
  if (!r) return { title: 'Treatment not found', robots: { index: false, follow: true } };
  const title =
    r.kind === 'level'
      ? `${LEVEL_LABELS[r.level!]} in ${r.state}`
      : `Addiction & Mental Health Treatment in ${r.cityName}, ${r.code}`;
  const where = r.kind === 'level' ? r.state : `${r.cityName}, ${r.state}`;
  const what = r.kind === 'level' ? LEVEL_LABELS[r.level!].toLowerCase() : 'addiction and mental-health treatment';
  const description = `${r.rows.length} vetted ${what} program${r.rows.length === 1 ? '' : 's'} in ${where}, with real-time bed availability. Free and private — get matched or browse directly.`;
  return {
    title,
    description,
    alternates: { canonical: `/treatment/${state}/${seg}` },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl(`/treatment/${state}/${seg}`) },
  };
}

export default async function StateSegPage({
  params,
}: {
  params: Promise<{ state: string; seg: string }>;
}) {
  const { state, seg } = await params;
  const r = await load(state, seg);
  if (!r) notFound();

  const h1 =
    r.kind === 'level' ? (
      <>
        <span className="italic text-brand">{LEVEL_LABELS[r.level!]}</span> in {r.state}
      </>
    ) : (
      <>
        Treatment in <span className="italic text-brand">{r.cityName}</span>, {r.code}
      </>
    );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Treatment', item: absoluteUrl('/treatment') },
      { '@type': 'ListItem', position: 2, name: r.state, item: absoluteUrl(`/treatment/${state}`) },
      { '@type': 'ListItem', position: 3, name: r.heading, item: absoluteUrl(`/treatment/${state}/${seg}`) },
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <nav className="text-xs text-slate-500">
        <Link href="/treatment" className="text-teal-700 hover:underline">
          Treatment
        </Link>{' '}
        /{' '}
        <Link href={`/treatment/${state}`} className="text-teal-700 hover:underline">
          {r.state}
        </Link>{' '}
        / <span>{r.heading}</span>
      </nav>

      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">{h1}</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        {r.rows.length} program{r.rows.length === 1 ? '' : 's'}
        {r.kind === 'level' ? ` offering ${LEVEL_LABELS[r.level!].toLowerCase()}` : ''} in{' '}
        {r.kind === 'level' ? r.state : `${r.cityName}, ${r.state}`}, with live bed availability. {SITE_NAME}{' '}
        connects you to treatment facilities; we don&apos;t provide treatment ourselves.
      </p>

      <div className="mt-4">
        <Link href="/match" className="text-sm font-medium text-teal-700 hover:underline">
          Not sure which fits? Get matched in 3 quick questions →
        </Link>
      </div>

      {/* Cross-link mesh: level page → narrow by city; city page → narrow by level. */}
      {r.kind === 'level' &&
        (() => {
          const cityCounts = new Map<string, number>();
          for (const f of r.rows) if (f.city) cityCounts.set(f.city, (cityCounts.get(f.city) ?? 0) + 1);
          const cities = [...cityCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
          if (cities.length === 0) return null;
          return (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
                {LEVEL_LABELS[r.level!]} by city
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {cities.map(([city, n]) => (
                  <Link
                    key={city}
                    href={`/treatment/${state}/${slugify(city)}/${r.level}`}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700 transition hover:border-teal-300"
                  >
                    {city} ({n})
                  </Link>
                ))}
              </div>
            </section>
          );
        })()}

      {r.kind === 'city' &&
        (() => {
          const levelCounts = new Map<string, number>();
          for (const f of r.rows) for (const l of f.levels_of_care ?? []) levelCounts.set(l, (levelCounts.get(l) ?? 0) + 1);
          const levels = LEVELS_OF_CARE.filter((l) => levelCounts.has(l));
          if (levels.length === 0) return null;
          return (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
                By level of care in {r.cityName}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {levels.map((l) => (
                  <Link
                    key={l}
                    href={`/treatment/${state}/${seg}/${l}`}
                    className="rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-sm font-medium text-teal-800 transition hover:bg-teal-100"
                  >
                    {LEVEL_LABELS[l as LevelOfCare]} ({levelCounts.get(l)})
                  </Link>
                ))}
              </div>
            </section>
          );
        })()}

      <div className="mt-7 space-y-2">
        {r.rows.map((f) => (
          <FacilityCard key={f.id} f={f} />
        ))}
      </div>
    </main>
  );
}
