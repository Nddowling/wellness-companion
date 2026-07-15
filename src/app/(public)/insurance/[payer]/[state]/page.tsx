import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';

import JsonLd from '@/components/JsonLd';
import { FacilityCard, type FacilityCardData } from '@/components/FacilityCard';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME, breadcrumbJsonLd, facilityItemListJsonLd, faqJsonLd } from '@/lib/seo';
import { getPayer } from '@/lib/payers';
import { codeFromStateSlug, stateName, stateSlug } from '@/lib/geo';
import { landingIndexable, robotsFor } from '@/lib/indexable';
import { collectPublicRows } from '@/lib/supabase/public-pagination';

export const revalidate = 3600;
const DIRECTORY_PREVIEW_LIMIT = 100;
export function generateStaticParams() {
  return [];
}

async function load(payerSlugParam: string, stateSlugParam: string) {
  const p = getPayer(payerSlugParam);
  const code = codeFromStateSlug(stateSlugParam);
  if (!p || !code) return null;
  const rows = await unstable_cache(
    async () => {
      const supabase = createAdminClient();
      return (await collectPublicRows('insurance payer state', async (from, to) => {
        const result =
          p.kind === 'commercial'
            ? await supabase
                .from('facilities')
                .select('id, name, slug, city, state, levels_of_care, facility_capacity(level_of_care, beds_available, last_updated)')
                .eq('is_published', true)
                .ilike('state', code)
                .contains('carriers_named', [p.name])
                .order('name')
                .order('id')
                .range(from, to)
            : await supabase
                .from('facilities')
                .select('id, name, slug, city, state, levels_of_care, facility_capacity(level_of_care, beds_available, last_updated), facility_payers!inner(payer_type)')
                .eq('is_published', true)
                .ilike('state', code)
                .eq('facility_payers.payer_type', p.payerType)
                .order('name')
                .order('id')
                .range(from, to);
        return { data: result.data as FacilityCardData[] | null, error: result.error };
      })) as FacilityCardData[];
    },
    ['insurance-state', code, p.slug],
    { revalidate: 3600, tags: [`treatment:${code}`] }
  )();
  if (rows.length === 0) return null;
  return { p, code, state: stateName(code), rows };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ payer: string; state: string }>;
}): Promise<Metadata> {
  const { payer, state } = await params;
  const r = await load(payer, state);
  if (!r) return { title: 'Coverage not found', robots: { index: false, follow: true } };
  const canonicalState = stateSlug(r.code);
  const title = `${r.p.name} Treatment in ${r.state}`;
  const description = `${r.rows.length} addiction-treatment programs in ${r.state} listing ${r.p.name} as a payment option, with dated availability reports. Confirm network status and benefits.`;
  return {
    title,
    description,
    robots: robotsFor(landingIndexable(r.rows.length)),
    alternates: { canonical: `/insurance/${r.p.slug}/${canonicalState}` },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(`/insurance/${r.p.slug}/${canonicalState}`),
    },
  };
}

export default async function PayerStatePage({
  params,
}: {
  params: Promise<{ payer: string; state: string }>;
}) {
  const { payer, state } = await params;
  const r = await load(payer, state);
  if (!r) notFound();
  const canonicalState = stateSlug(r.code);
  if (payer !== r.p.slug || state !== canonicalState) {
    permanentRedirect(`/insurance/${r.p.slug}/${canonicalState}`);
  }
  const previewRows = r.rows.slice(0, DIRECTORY_PREVIEW_LIMIT);
  const directoryParams = new URLSearchParams({ region: r.code, pay: r.p.payerType });
  if (r.p.kind === 'commercial') directoryParams.set('q', r.p.name);

  const faqs = [
    {
      q: `Does ${r.p.name} cover rehab in ${r.state}?`,
      a: `${r.p.name} plans may include behavioral-health benefits, but coverage, authorization, network status, and cost vary. ${r.rows.length} program${r.rows.length === 1 ? '' : 's'} in ${r.state} list ${r.p.name} as a payment option; confirm the listing, network, and benefits with the program and your insurer.`,
    },
    {
      q: `How much does treatment cost with ${r.p.name} in ${r.state}?`,
      a: `Your out-of-pocket cost depends on your specific ${r.p.name} plan, deductible, network, authorization, and level of care. Ask the program and your insurer for a benefits check and an estimated member cost before you commit.`,
    },
    {
      q: `How do I verify my ${r.p.name} benefits?`,
      a: `Call the member-services number on your insurance card, or ask the program to verify benefits. ${SITE_NAME} can show ${r.state} programs whose directory record lists ${r.p.name}, but the listing is not a benefits determination.`,
    },
    {
      q: `How many ${r.p.name} treatment programs are in ${r.state}?`,
      a: `${r.rows.length} published program${r.rows.length === 1 ? '' : 's'} in ${r.state} list ${r.p.name}-type payment, with levels of care and dated availability reports when supplied.`,
    },
  ];

  const schema = [
    breadcrumbJsonLd([
      { name: 'Insurance', path: '/insurance' },
      { name: r.p.name, path: `/insurance/${r.p.slug}` },
      { name: r.state, path: `/insurance/${r.p.slug}/${canonicalState}` },
    ]),
    facilityItemListJsonLd(previewRows),
    faqJsonLd(faqs),
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={schema} />
      <nav className="text-xs text-slate-500">
        <Link href="/insurance" className="text-teal-700 hover:underline">
          Insurance
        </Link>{' '}
        /{' '}
        <Link href={`/insurance/${r.p.slug}`} className="text-teal-700 hover:underline">
          {r.p.name}
        </Link>{' '}
        / <span>{r.state}</span>
      </nav>

      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
        <span className="italic text-brand">{r.p.name}</span> treatment in {r.state}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        {r.rows.length} program{r.rows.length === 1 ? '' : 's'} in {r.state} whose directory record lists {r.p.name}{' '}
        as a payment option, with dated availability reports when supplied. This does not establish network status or
        member benefits; confirm both with the program and your insurer. {SITE_NAME}{' '}
        connects you to treatment facilities; we don&apos;t provide treatment ourselves.
      </p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/match" className="font-medium text-teal-700 hover:underline">
          Get matched in 3 quick questions →
        </Link>
        <Link href={`/insurance/${r.p.slug}`} className="text-teal-700 hover:underline">
          {r.p.name} coverage &amp; cost
        </Link>
        <Link href={`/treatment/${canonicalState}`} className="text-teal-700 hover:underline">
          All treatment in {r.state}
        </Link>
      </div>

      <div className="mt-7 space-y-2">
        {previewRows.map((f) => (
          <FacilityCard key={f.id} f={f} />
        ))}
      </div>
      {r.rows.length > previewRows.length && (
        <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
          Showing the first {previewRows.length} of {r.rows.length} matching programs to keep this page fast.{' '}
          <Link
            href={`/programs?${directoryParams.toString()}`}
            className="font-semibold text-teal-800 underline underline-offset-2"
          >
            Browse all filtered results →
          </Link>
        </div>
      )}

      <section className="mt-10 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          {r.p.name} treatment in {r.state} — common questions
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
