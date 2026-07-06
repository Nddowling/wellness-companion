import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';

import JsonLd from '@/components/JsonLd';
import { FacilityCard, type FacilityCardData } from '@/components/FacilityCard';
import { FacilityProfileView } from '@/components/facility/FacilityProfileView';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadFacilityBySlug, facilityCanonicalPath, buildFacilityMetadata } from '@/lib/facility/load';
import { absoluteUrl, SITE_NAME, breadcrumbJsonLd, facilityItemListJsonLd, faqJsonLd } from '@/lib/seo';
import { LEVELS_OF_CARE, LEVEL_LABELS, LEVEL_BLURB, type LevelOfCare } from '@/lib/constants';
import { codeFromStateSlug, stateName, slugify } from '@/lib/geo';

export const revalidate = 3600;

function isLevel(seg: string): seg is LevelOfCare {
  return (LEVELS_OF_CARE as readonly string[]).includes(seg);
}

// This 3-segment leaf serves TWO shapes that share the same slot:
//   /treatment/[state]/[city]/[level]  → city × level-of-care listing (below)
//   /treatment/[state]/[city]/[slug]   → a single facility profile
// The third segment disambiguates: a known level keyword → listing; anything else
// is treated as a facility slug (slugs are always name-city-state, never a bare
// level keyword, so there's no collision).

// City × level page, e.g. /treatment/georgia/atlanta/detox → "Detox in Atlanta, GA".
// `seg` is the city slug; `level` must be a level (else this URL is invalid).
async function load(stateParam: string, seg: string, level: string) {
  if (!isLevel(level) || isLevel(seg)) return null; // seg must be a city, not a level
  const code = codeFromStateSlug(stateParam);
  if (!code) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facilities')
    .select('id, name, slug, city, state, levels_of_care, facility_capacity(level_of_care, beds_available, last_updated)')
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

  // Facility-profile branch: the third segment is a facility slug, not a level.
  if (!isLevel(level)) {
    const f = await loadFacilityBySlug(level);
    if (f) return buildFacilityMetadata(f, facilityCanonicalPath(f));
    return { title: 'Treatment not found', robots: { index: false, follow: true } };
  }

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

export default async function CityLevelOrProfilePage({
  params,
}: {
  params: Promise<{ state: string; seg: string; level: string }>;
}) {
  const { state, seg, level } = await params;

  // Facility-profile branch: the third segment is a facility slug, not a level.
  if (!isLevel(level)) {
    const f = await loadFacilityBySlug(level);
    if (!f) notFound();
    const canonicalPath = facilityCanonicalPath(f);
    // Enforce one indexable URL per facility: if the state/city segments don't
    // match the canonical (e.g. a valid slug reached under the wrong city),
    // 301 to the canonical path.
    if (`/treatment/${state}/${seg}/${level}` !== canonicalPath) {
      permanentRedirect(canonicalPath);
    }
    return <FacilityProfileView f={f} canonicalPath={canonicalPath} />;
  }

  const r = await load(state, seg, level);
  if (!r) notFound();

  const levelLabel = LEVEL_LABELS[r.level];
  const faqs = [
    {
      q: `How many ${levelLabel.toLowerCase()} programs are in ${r.cityName}, ${r.code}?`,
      a: `${r.rows.length} ${levelLabel.toLowerCase()} program${r.rows.length === 1 ? '' : 's'} in ${r.cityName}, ${r.code} ${r.rows.length === 1 ? 'is' : 'are'} listed on ${SITE_NAME}, each showing current bed availability.`,
    },
    { q: `What is ${levelLabel.toLowerCase()}?`, a: LEVEL_BLURB[r.level] },
    {
      q: `Does insurance cover ${levelLabel.toLowerCase()} in ${r.cityName}?`,
      a: `Most health plans cover medically necessary addiction treatment. Many ${r.cityName} programs accept Medicaid, Medicare, commercial insurance, TRICARE, or self-pay — always confirm current in-network status with the program.`,
    },
    {
      q: `How do I find a ${levelLabel.toLowerCase()} program with an open bed in ${r.cityName}?`,
      a: `Each listing shows live bed availability, so you can see who has space now — or answer three quick questions and get matched, free and private.`,
    },
  ];

  const schema = [
    breadcrumbJsonLd([
      { name: 'Treatment', path: '/treatment' },
      { name: r.state, path: `/treatment/${state}` },
      { name: r.cityName, path: `/treatment/${state}/${seg}` },
      { name: levelLabel, path: `/treatment/${state}/${seg}/${level}` },
    ]),
    facilityItemListJsonLd(r.rows),
    faqJsonLd(faqs),
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={schema} />
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

      <section className="mt-10 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          {levelLabel} in {r.cityName} — common questions
        </h2>
        <dl className="mt-3 space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="text-sm font-medium text-slate-800">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
