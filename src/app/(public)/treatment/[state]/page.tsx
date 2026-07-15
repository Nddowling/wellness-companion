import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';

import JsonLd from '@/components/JsonLd';
import { FacilityCard, type FacilityCardData } from '@/components/FacilityCard';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME, breadcrumbJsonLd, facilityItemListJsonLd, faqJsonLd } from '@/lib/seo';
import { LEVELS_OF_CARE, LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';
import { codeFromStateSlug, stateName, stateSlug, slugify } from '@/lib/geo';
import { collectPublicRows } from '@/lib/supabase/public-pagination';

export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Row = FacilityCardData;
const DIRECTORY_PREVIEW_LIMIT = 100;

async function load(stateSlugParam: string) {
  const code = codeFromStateSlug(stateSlugParam);
  if (!code) return null;
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const rows = (await collectPublicRows('treatment state', (from, to) =>
        supabase
          .from('facilities')
          .select('id, name, slug, city, state, levels_of_care, facility_capacity(level_of_care, beds_available, last_updated)')
          .eq('is_published', true)
          .ilike('state', code)
          .order('name')
          .order('id')
          .range(from, to),
      )) as Row[];
      if (rows.length === 0) return null;
      return { code, rows };
    },
    ['treatment-state', code],
    { revalidate: 3600, tags: [`treatment:${code}`] }
  )();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state } = await params;
  const loaded = await load(state);
  if (!loaded) return { title: 'Treatment not found', robots: { index: false, follow: true } };
  const canonicalState = stateSlug(loaded.code);
  const name = stateName(loaded.code);
  const title = `Drug & Alcohol Rehab in ${name}`;
  const description = `Browse ${loaded.rows.length} listed drug and alcohol treatment programs in ${name} by source-listed service and level of care. Detox records may represent outpatient or overnight settings.`;
  return {
    title,
    description,
    alternates: { canonical: `/treatment/${canonicalState}` },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(`/treatment/${canonicalState}`),
    },
  };
}

export default async function StatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const loaded = await load(state);
  if (!loaded) notFound();
  const { code, rows } = loaded;
  const canonicalState = stateSlug(code);
  if (state !== canonicalState) permanentRedirect(`/treatment/${canonicalState}`);
  const name = stateName(code);
  const previewRows = rows.slice(0, DIRECTORY_PREVIEW_LIMIT);

  // Levels available in this state (with counts), preserving the canonical order.
  const levelCounts = new Map<string, number>();
  for (const r of rows) for (const l of r.levels_of_care ?? []) levelCounts.set(l, (levelCounts.get(l) ?? 0) + 1);
  const levels = LEVELS_OF_CARE.filter((l) => levelCounts.has(l));

  // Top cities (with counts).
  const cityCounts = new Map<string, number>();
  for (const r of rows) if (r.city) cityCounts.set(r.city, (cityCounts.get(r.city) ?? 0) + 1);
  const cities = [...cityCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);

  const levelText = levels.map((l) => LEVEL_LABELS[l as LevelOfCare]).join(', ');
  const topCity = cities[0]?.[0];

  const faqs = [
    {
      q: `How many addiction treatment programs are in ${name}?`,
      a: `${rows.length} published treatment program${rows.length === 1 ? '' : 's'} in ${name} ${rows.length === 1 ? 'is' : 'are'} listed on Clear Bed Recovery${levelText ? `, covering ${levelText.toLowerCase()}` : ''}. Listings show location, levels of care, and the date of any availability report.`,
    },
    {
      q: `What treatment services and levels of care are listed in ${name}?`,
      a: `${name} records include ${levelText.toLowerCase() || 'a range of addiction treatment options'}. Residential is overnight, bed-based care. PHP, IOP, and outpatient are non-residential. The imported detox category may describe outpatient, residential, or hospital services, so confirm the setting directly.`,
    },
    {
      q: `Does insurance cover rehab in ${name}?`,
      a: `Many plans include behavioral-health benefits, but coverage, authorization, network status, and cost vary. Directory listings may report Medicaid, Medicare, commercial insurance, TRICARE, or self-pay; confirm benefits with the program and your insurer.`,
    },
    {
      q: `How do I find a program with an open bed in ${name}?`,
      a: `Residential listings may show dated bed reports when supplied, and exact counts disappear after seven days. The current detox category does not establish an overnight setting or detox bed. Always call to confirm.`,
    },
  ];

  const schema = [
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Treatment', path: '/treatment' },
      { name, path: `/treatment/${canonicalState}` },
    ]),
    facilityItemListJsonLd(previewRows),
    faqJsonLd(faqs),
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={schema} />
      <nav className="text-xs text-slate-500">
        <Link href="/treatment" className="text-teal-700 hover:underline">
          Treatment
        </Link>{' '}
        / <span>{name}</span>
      </nav>

      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
        Drug &amp; Alcohol Rehab in <span className="italic text-brand">{name}</span>
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        {rows.length} listed addiction-treatment program{rows.length === 1 ? '' : 's'} in {name}, with dated
        residential-bed reports where programs have supplied them. Detox records may describe outpatient or overnight
        services. {SITE_NAME} connects you to treatment facilities; we don&apos;t provide treatment ourselves.
      </p>
      {(levels.length > 0 || cities.length > 0) && (
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          {name} programs span {levels.length} listed service or level categor{levels.length === 1 ? 'y' : 'ies'}
          {cities.length > 0 ? ` across ${cities.length} cit${cities.length === 1 ? 'y' : 'ies'}` : ''}
          {topCity ? `, with the most options in ${topCity}` : ''}. Compare source-listed detox services (whose setting
          varies), residential, PHP, IOP, and outpatient programs below — filter by city or payment category.
        </p>
      )}

      <div className="mt-4">
        <Link href="/match" className="text-sm font-medium text-teal-700 hover:underline">
          Not sure where to start? Get matched in 3 quick questions →
        </Link>
      </div>

      {levels.length > 0 && (
        <section className="mt-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">By listed service or level</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {levels.map((l) => (
              <Link
                key={l}
                href={`/treatment/${canonicalState}/${l}`}
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
                href={`/treatment/${canonicalState}/${slugify(city)}`}
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
          {previewRows.map((f) => (
            <FacilityCard key={f.id} f={f} />
          ))}
        </div>
        {rows.length > previewRows.length && (
          <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
            Showing the first {previewRows.length} of {rows.length} programs to keep this page fast and usable.{' '}
            <Link href={`/programs?region=${code}`} className="font-semibold text-teal-800 underline underline-offset-2">
              Browse all {rows.length} in the searchable directory →
            </Link>
          </div>
        )}
      </section>

      <section className="mt-10 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          Treatment in {name} — common questions
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
