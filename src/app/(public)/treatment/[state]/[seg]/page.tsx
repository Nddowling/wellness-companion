import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';

import JsonLd from '@/components/JsonLd';
import { FacilityCard, type FacilityCardData } from '@/components/FacilityCard';
import { FacilityContextBlock } from '@/components/facility/FacilityContextBlock';
import { computeAreaStats, cityContextLines, type ContextFacility } from '@/lib/facility/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME, breadcrumbJsonLd, facilityItemListJsonLd, faqJsonLd } from '@/lib/seo';
import { LEVELS_OF_CARE, LEVEL_LABELS, LEVEL_BLURB, isBedBased, type LevelOfCare } from '@/lib/constants';
import { codeFromStateSlug, stateName, stateSlug, slugify } from '@/lib/geo';
import { landingIndexable, robotsFor } from '@/lib/indexable';
import { collectPublicRows } from '@/lib/supabase/public-pagination';

export const revalidate = 3600;

// Opt the dynamic-param route into ISR (render on demand, then cache) — without this
// Next 16 renders it fully dynamic even with revalidate + cached reads.
export function generateStaticParams() {
  return [];
}

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
  return unstable_cache(() => loadUncached(code, seg), ['treatment-seg', code, seg], {
    revalidate: 3600,
    tags: [`treatment:${code}`],
  })();
}

async function loadUncached(code: string, seg: string): Promise<Resolved | null> {
  const supabase = createAdminClient();

  if (isLevel(seg)) {
    const rows = (await collectPublicRows('treatment state level', (from, to) =>
      supabase
        .from('facilities')
        .select('id, name, slug, city, state, levels_of_care, facility_capacity(level_of_care, beds_available, last_updated)')
        .eq('is_published', true)
        .ilike('state', code)
        .contains('levels_of_care', [seg])
        .order('name')
        .order('id')
        .range(from, to),
    )) as FacilityCardData[];
    if (rows.length === 0) return null;
    return { code, state: stateName(code), kind: 'level', level: seg, rows, heading: LEVEL_LABELS[seg] };
  }

  // City: match on the slug of the stored city name (slug is lossy, so filter here).
  const all = (await collectPublicRows('treatment city', (from, to) =>
    supabase
      .from('facilities')
      .select('id, name, slug, city, state, levels_of_care, accreditations, facility_payers(payer_type), facility_capacity(level_of_care, beds_available, last_updated)')
      .eq('is_published', true)
      .ilike('state', code)
      .order('name')
      .order('id')
      .range(from, to),
  )) as FacilityCardData[];
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
  const canonicalState = stateSlug(r.code);
  const canonicalSegment = r.kind === 'level' ? r.level! : slugify(r.cityName!);
  const title =
    r.kind === 'level'
      ? `${LEVEL_LABELS[r.level!]} Treatment in ${r.state}`
      : `Drug & Alcohol Rehab in ${r.cityName}, ${r.code}`;
  const where = r.kind === 'level' ? r.state : `${r.cityName}, ${r.state}`;
  const what = r.kind === 'level' ? LEVEL_LABELS[r.level!].toLowerCase() : 'drug and alcohol rehab';
  const description =
    r.kind === 'level' && isBedBased(r.level!)
      ? `${r.rows.length} listed ${what} program${r.rows.length === 1 ? '' : 's'} in ${where}, with dated residential-bed reports when supplied.`
      : `${r.rows.length} listed ${what} program${r.rows.length === 1 ? '' : 's'} in ${where}, with source-listed services and direct contact details.`;
  return {
    title,
    description,
    robots: robotsFor(landingIndexable(r.rows.length)),
    alternates: { canonical: `/treatment/${canonicalState}/${canonicalSegment}` },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(`/treatment/${canonicalState}/${canonicalSegment}`),
    },
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
  const canonicalState = stateSlug(r.code);
  const canonicalSegment = r.kind === 'level' ? r.level! : slugify(r.cityName!);
  if (state !== canonicalState || seg !== canonicalSegment) {
    permanentRedirect(`/treatment/${canonicalState}/${canonicalSegment}`);
  }

  const h1 =
    r.kind === 'level' ? (
      <>
        <span className="italic text-brand">{LEVEL_LABELS[r.level!]}</span> in {r.state}
      </>
    ) : (
      <>
        Drug &amp; Alcohol Rehab in <span className="italic text-brand">{r.cityName}</span>, {r.code}
      </>
    );

  const levelLabel = r.kind === 'level' ? LEVEL_LABELS[r.level!] : '';
  const levelUsesBeds = r.kind === 'level' && isBedBased(r.level!);
  const cityLevelText =
    r.kind === 'city'
      ? LEVELS_OF_CARE.filter((l) => r.rows.some((f) => (f.levels_of_care ?? []).includes(l)))
          .map((l) => LEVEL_LABELS[l])
          .join(', ')
      : '';

  const faqs =
    r.kind === 'level'
      ? [
          {
            q: `How many ${levelLabel.toLowerCase()} programs are in ${r.state}?`,
            a: `${r.rows.length} ${levelLabel.toLowerCase()} program${r.rows.length === 1 ? '' : 's'} in ${r.state} ${r.rows.length === 1 ? 'is' : 'are'} listed on ${SITE_NAME}, with source-listed services${levelUsesBeds ? ' and dated residential-bed reports when supplied' : ''}.`,
          },
          { q: `What is ${levelLabel.toLowerCase()}?`, a: LEVEL_BLURB[r.level!] },
          {
            q: `Does insurance cover ${levelLabel.toLowerCase()} in ${r.state}?`,
            a: `Coverage, authorization, network status, and cost vary by plan. Listings may report Medicaid, Medicare, commercial insurance, TRICARE, or self-pay; confirm benefits with the program and your insurer.`,
          },
          {
            q: levelUsesBeds
              ? `How do I find a ${levelLabel.toLowerCase()} program with an open bed in ${r.state}?`
              : `How do I confirm the setting and admission status for ${levelLabel.toLowerCase()} in ${r.state}?`,
            a: levelUsesBeds
              ? `Listings may show dated residential-bed reports. Exact counts are hidden after seven days, so call to confirm before relying on an opening.`
              : r.level === 'detox'
                ? `The imported detox category may describe outpatient, residential, or hospital services. It does not establish an overnight setting or open bed, so confirm the setting, clinical service, and admission status directly.`
                : `This is a non-residential service category. The directory does not assert current appointment availability; call the program to confirm scheduling and admission requirements.`,
          },
        ]
      : [
          {
            q: `How many addiction treatment programs are in ${r.cityName}, ${r.code}?`,
            a: `${r.rows.length} published program${r.rows.length === 1 ? '' : 's'} in ${r.cityName}${cityLevelText ? `, covering ${cityLevelText.toLowerCase()}` : ''}. Listings show levels of care and dated availability reports when supplied.`,
          },
          {
            q: `What treatment services and levels of care are listed in ${r.cityName}?`,
            a: `${r.cityName} records include ${cityLevelText.toLowerCase() || 'a range of addiction treatment options'}. Residential is overnight and bed-based. PHP, IOP, and outpatient are non-residential. The imported detox category may describe outpatient, residential, or hospital services, so confirm the setting directly.`,
          },
          {
            q: `Does insurance cover rehab in ${r.cityName}?`,
            a: `Many plans include behavioral-health benefits, but coverage, authorization, network status, and cost vary. Confirm benefits with the program and your insurer.`,
          },
          {
            q: `How do I find a program with an open bed in ${r.cityName}?`,
            a: `Residential listings may show dated bed reports, and exact counts disappear after seven days. Detox service records do not by themselves establish an overnight setting or detox bed. Call to confirm before relying on an opening.`,
          },
        ];

  const schema = [
    breadcrumbJsonLd([
      { name: 'Treatment', path: '/treatment' },
      { name: r.state, path: `/treatment/${canonicalState}` },
      { name: r.heading, path: `/treatment/${canonicalState}/${canonicalSegment}` },
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
        / <span>{r.heading}</span>
      </nav>

      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">{h1}</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        {r.rows.length} program{r.rows.length === 1 ? '' : 's'}
        {r.kind === 'level' ? ` offering ${LEVEL_LABELS[r.level!].toLowerCase()}` : ''} in{' '}
        {r.kind === 'level' ? r.state : `${r.cityName}, ${r.state}`}, with source-listed services
        {levelUsesBeds ? ' and dated residential-bed reports where supplied' : ''}. {r.level === 'detox' ? 'The detox category may include outpatient or overnight settings. ' : ''}
        {SITE_NAME} connects you to treatment facilities; we don&apos;t provide treatment ourselves.
      </p>

      {r.kind === 'city' && (
        <FacilityContextBlock
          title={`About treatment in ${r.cityName}`}
          lines={cityContextLines(r.cityName!, r.code, computeAreaStats(r.rows as unknown as ContextFacility[]))}
        />
      )}

      <div className="mt-4">
        <Link href="/match" className="text-sm font-medium text-teal-700 hover:underline">
          Not sure where to start? Narrow directory options in 3 quick questions →
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
                    href={`/treatment/${canonicalState}/${slugify(city)}/${r.level}`}
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
                By listed service or level in {r.cityName}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {levels.map((l) => (
                  <Link
                    key={l}
                    href={`/treatment/${canonicalState}/${canonicalSegment}/${l}`}
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

      <section className="mt-10 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          {r.kind === 'level' ? `${levelLabel} in ${r.state}` : `Treatment in ${r.cityName}`} — common questions
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
