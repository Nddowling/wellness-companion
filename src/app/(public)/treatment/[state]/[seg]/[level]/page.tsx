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

// City × level page, e.g. /treatment/georgia/atlanta/detox → "Detox in Atlanta, GA".
// `seg` is the city slug; `level` must be a level (else this URL is invalid).
async function load(stateParam: string, seg: string, level: string) {
  if (!isLevel(level) || isLevel(seg)) return null; // seg must be a city, not a level
  const code = codeFromStateSlug(stateParam);
  if (!code) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facilities')
    .select('id, name, city, state, levels_of_care')
    .eq('is_published', true)
    .ilike('state', code)
    .contains('levels_of_care', [level])
    .order('name');
  const all = (data ?? []) as FacilityCardData[];
  const rows = all.filter((f) => f.city && slugify(f.city) === seg);
  if (rows.length === 0) return null;
  return { code, state: stateName(code), cityName: rows[0].city as string, level: level as LevelOfCare, rows };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; seg: string; level: string }>;
}): Promise<Metadata> {
  const { state, seg, level } = await params;
  const r = await load(state, seg, level);
  if (!r) return { title: 'Treatment not found', robots: { index: false, follow: true } };
  const title = `${LEVEL_LABELS[r.level]} in ${r.cityName}, ${r.code}`;
  const description = `${r.rows.length} ${LEVEL_LABELS[r.level].toLowerCase()} program${r.rows.length === 1 ? '' : 's'} in ${r.cityName}, ${r.code}, with real-time bed availability. Free and private — get matched or browse directly.`;
  return {
    title,
    description,
    alternates: { canonical: `/treatment/${state}/${seg}/${level}` },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl(`/treatment/${state}/${seg}/${level}`) },
  };
}

export default async function CityLevelPage({
  params,
}: {
  params: Promise<{ state: string; seg: string; level: string }>;
}) {
  const { state, seg, level } = await params;
  const r = await load(state, seg, level);
  if (!r) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Treatment', item: absoluteUrl('/treatment') },
      { '@type': 'ListItem', position: 2, name: r.state, item: absoluteUrl(`/treatment/${state}`) },
      { '@type': 'ListItem', position: 3, name: r.cityName, item: absoluteUrl(`/treatment/${state}/${seg}`) },
      { '@type': 'ListItem', position: 4, name: LEVEL_LABELS[r.level], item: absoluteUrl(`/treatment/${state}/${seg}/${level}`) },
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
        /{' '}
        <Link href={`/treatment/${state}/${seg}`} className="text-teal-700 hover:underline">
          {r.cityName}
        </Link>{' '}
        / <span>{LEVEL_LABELS[r.level]}</span>
      </nav>

      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
        <span className="italic text-brand">{LEVEL_LABELS[r.level]}</span> in {r.cityName}, {r.code}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        {r.rows.length} {LEVEL_LABELS[r.level].toLowerCase()} program{r.rows.length === 1 ? '' : 's'} in {r.cityName},{' '}
        {r.code}, with live bed availability. {SITE_NAME} connects you to treatment facilities; we don&apos;t provide
        treatment ourselves.
      </p>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/match" className="font-medium text-teal-700 hover:underline">
          Get matched in 3 quick questions →
        </Link>
        <Link href={`/treatment/${state}/${seg}`} className="text-teal-700 hover:underline">
          All treatment in {r.cityName}
        </Link>
        <Link href={`/treatment/${state}/${level}`} className="text-teal-700 hover:underline">
          {LEVEL_LABELS[r.level]} across {r.state}
        </Link>
      </div>

      <div className="mt-7 space-y-2">
        {r.rows.map((f) => (
          <FacilityCard key={f.id} f={f} />
        ))}
      </div>
    </main>
  );
}
