import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';

import JsonLd from '@/components/JsonLd';
import { FacilityCard, type FacilityCardData } from '@/components/FacilityCard';
import { FacilityProfileView } from '@/components/facility/FacilityProfileView';
import { FacilityContextBlock } from '@/components/facility/FacilityContextBlock';
import { computeAreaStats, cityLevelContextLines, type ContextFacility } from '@/lib/facility/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadFacilityBySlug, facilityCanonicalPath, buildFacilityMetadata } from '@/lib/facility/load';
import { absoluteUrl, SITE_NAME, breadcrumbJsonLd, facilityItemListJsonLd, faqJsonLd } from '@/lib/seo';
import { LEVELS_OF_CARE, LEVEL_LABELS, LEVEL_BLURB, isBedBased, type LevelOfCare } from '@/lib/constants';
import { codeFromStateSlug, stateName, stateSlug, slugify } from '@/lib/geo';
import { landingIndexable, robotsFor } from '@/lib/indexable';
import { collectPublicRows } from '@/lib/supabase/public-pagination';

export const revalidate = 3600;

// No build-time params (13.5k+ pages), but declaring this opts the route into ISR:
// unknown params render on demand and are then CACHED, instead of rendered fresh
// every request. Without it, a dynamic-param route stays fully dynamic in Next 16.
export function generateStaticParams() {
  return [];
}

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
  return unstable_cache(() => loadUncached(code, seg, level), ['treatment-city-level', code, seg, level], {
    revalidate: 3600,
    tags: [`treatment:${code}`],
  })();
}

async function loadUncached(code: string, seg: string, level: string) {
  const supabase = createAdminClient();
  const all = (await collectPublicRows('treatment city level', (from, to) =>
    supabase
      .from('facilities')
      .select('id, name, slug, city, state, levels_of_care, accreditations, facility_payers(payer_type), facility_capacity(level_of_care, beds_available, last_updated)')
      .eq('is_published', true)
      .ilike('state', code)
      .contains('levels_of_care', [level])
      .order('name')
      .order('id')
      .range(from, to),
  )) as FacilityCardData[];
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
  const canonicalState = stateSlug(r.code);
  const canonicalCity = slugify(r.cityName);
  const title = `${LEVEL_LABELS[r.level]} in ${r.cityName}, ${r.code}`;
  const description = isBedBased(r.level)
    ? `${r.rows.length} listed ${LEVEL_LABELS[r.level].toLowerCase()} program${r.rows.length === 1 ? '' : 's'} in ${r.cityName}, ${r.code}, with dated residential-bed reports when supplied.`
    : `${r.rows.length} listed ${LEVEL_LABELS[r.level].toLowerCase()} program${r.rows.length === 1 ? '' : 's'} in ${r.cityName}, ${r.code}, with source-listed services and direct contact details.`;
  return {
    title,
    description,
    robots: robotsFor(landingIndexable(r.rows.length)),
    alternates: { canonical: `/treatment/${canonicalState}/${canonicalCity}/${r.level}` },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(`/treatment/${canonicalState}/${canonicalCity}/${r.level}`),
    },
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
  const canonicalState = stateSlug(r.code);
  const canonicalCity = slugify(r.cityName);
  if (state !== canonicalState || seg !== canonicalCity || level !== r.level) {
    permanentRedirect(`/treatment/${canonicalState}/${canonicalCity}/${r.level}`);
  }

  const levelLabel = LEVEL_LABELS[r.level];
  const levelUsesBeds = isBedBased(r.level);
  const faqs = [
    {
      q: `How many ${levelLabel.toLowerCase()} programs are in ${r.cityName}, ${r.code}?`,
      a: `${r.rows.length} ${levelLabel.toLowerCase()} program${r.rows.length === 1 ? '' : 's'} in ${r.cityName}, ${r.code} ${r.rows.length === 1 ? 'is' : 'are'} listed on ${SITE_NAME}, with source-listed services${levelUsesBeds ? ' and dated residential-bed reports when supplied' : ''}.`,
    },
    { q: `What is ${levelLabel.toLowerCase()}?`, a: LEVEL_BLURB[r.level] },
    {
      q: `Does insurance cover ${levelLabel.toLowerCase()} in ${r.cityName}?`,
      a: `Coverage, authorization, network status, and cost vary by plan. Listings may report Medicaid, Medicare, commercial insurance, TRICARE, or self-pay; confirm benefits with the program and your insurer.`,
    },
    {
      q: levelUsesBeds
        ? `How do I find a ${levelLabel.toLowerCase()} program with an open bed in ${r.cityName}?`
        : `How do I confirm the setting and admission status for ${levelLabel.toLowerCase()} in ${r.cityName}?`,
      a: levelUsesBeds
        ? `Listings may show dated residential-bed reports. Exact counts disappear after seven days, so always call to confirm.`
        : r.level === 'detox'
          ? `The imported detox category may describe outpatient, residential, or hospital services. It does not establish an overnight setting or open bed, so confirm the setting, clinical service, and admission status directly.`
          : `This is a non-residential service category. The directory does not assert current appointment availability; call the program to confirm scheduling and admission requirements.`,
    },
  ];

  const schema = [
    breadcrumbJsonLd([
      { name: 'Treatment', path: '/treatment' },
      { name: r.state, path: `/treatment/${canonicalState}` },
      { name: r.cityName, path: `/treatment/${canonicalState}/${canonicalCity}` },
      { name: levelLabel, path: `/treatment/${canonicalState}/${canonicalCity}/${r.level}` },
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
        <Link href={`/treatment/${canonicalState}`} className="text-teal-700 hover:underline">
          {r.state}
        </Link>{' '}
        /{' '}
        <Link href={`/treatment/${canonicalState}/${canonicalCity}`} className="text-teal-700 hover:underline">
          {r.cityName}
        </Link>{' '}
        / <span>{LEVEL_LABELS[r.level]}</span>
      </nav>

      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
        <span className="italic text-brand">{LEVEL_LABELS[r.level]}</span> in {r.cityName}, {r.code}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        {r.rows.length} {LEVEL_LABELS[r.level].toLowerCase()} program{r.rows.length === 1 ? '' : 's'} in {r.cityName},{' '}
        {r.code}, with source-listed services{levelUsesBeds ? ' and dated residential-bed reports where supplied' : ''}.{' '}
        {r.level === 'detox' ? 'The detox category may include outpatient or overnight settings. ' : ''}
        {SITE_NAME} connects you to treatment facilities; we don&apos;t provide treatment ourselves.
      </p>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/match" className="font-medium text-teal-700 hover:underline">
          Narrow directory options in 3 quick questions →
        </Link>
        <Link href={`/treatment/${canonicalState}/${canonicalCity}`} className="text-teal-700 hover:underline">
          All treatment in {r.cityName}
        </Link>
        <Link href={`/treatment/${canonicalState}/${r.level}`} className="text-teal-700 hover:underline">
          {LEVEL_LABELS[r.level]} across {r.state}
        </Link>
      </div>

      <FacilityContextBlock
        title={`About ${LEVEL_LABELS[r.level].toLowerCase()} in ${r.cityName}`}
        lines={cityLevelContextLines(r.cityName, r.code, LEVEL_LABELS[r.level], computeAreaStats(r.rows as unknown as ContextFacility[]))}
      />

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
