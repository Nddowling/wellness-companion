import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import JsonLd from '@/components/JsonLd';
import { FacilityCard, type FacilityCardData } from '@/components/FacilityCard';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME, breadcrumbJsonLd, facilityItemListJsonLd, faqJsonLd } from '@/lib/seo';
import { getPayer } from '@/lib/payers';
import { codeFromStateSlug, stateName } from '@/lib/geo';
import { landingIndexable, robotsFor } from '@/lib/indexable';

export const revalidate = 3600;

async function load(payerSlugParam: string, stateSlugParam: string) {
  const p = getPayer(payerSlugParam);
  const code = codeFromStateSlug(stateSlugParam);
  if (!p || !code) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facilities')
    .select('id, name, slug, city, state, levels_of_care, facility_capacity(level_of_care, beds_available, last_updated), facility_payers!inner(payer_type)')
    .eq('is_published', true)
    .ilike('state', code)
    .eq('facility_payers.payer_type', p.payerType)
    .order('name');
  const rows = (data ?? []) as FacilityCardData[];
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
  const title = `${r.p.name} Treatment in ${r.state}`;
  const description = `${r.rows.length} addiction and mental-health programs in ${r.state} that accept ${r.p.name}-type coverage, with real-time bed availability. Verify benefits and get matched — free.`;
  return {
    title,
    description,
    robots: robotsFor(landingIndexable(r.rows.length)),
    alternates: { canonical: `/insurance/${r.p.slug}/${state}` },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl(`/insurance/${r.p.slug}/${state}`) },
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

  const faqs = [
    {
      q: `Does ${r.p.name} cover rehab in ${r.state}?`,
      a: `Most health plans, including ${r.p.name}, cover medically necessary addiction and mental-health treatment by law. ${r.rows.length} program${r.rows.length === 1 ? '' : 's'} in ${r.state} on ${SITE_NAME} accept ${r.p.name}-type coverage — always confirm current in-network status and benefits with the program.`,
    },
    {
      q: `How much does treatment cost with ${r.p.name} in ${r.state}?`,
      a: `Your out-of-pocket cost depends on your specific ${r.p.name} plan, deductible, and the level of care. Many programs are low- or no-cost once ${r.p.name} coverage is applied; the program can run a benefits check before you commit.`,
    },
    {
      q: `How do I verify my ${r.p.name} benefits?`,
      a: `Call the member-services number on your insurance card, or have the program verify benefits on your behalf. You can also answer three quick questions on ${SITE_NAME} to get matched with ${r.state} programs that accept ${r.p.name}-type coverage.`,
    },
    {
      q: `How many ${r.p.name} treatment programs are in ${r.state}?`,
      a: `${r.rows.length} published program${r.rows.length === 1 ? '' : 's'} in ${r.state} accept ${r.p.name}-type coverage, each showing levels of care and current bed availability.`,
    },
  ];

  const schema = [
    breadcrumbJsonLd([
      { name: 'Insurance', path: '/insurance' },
      { name: r.p.name, path: `/insurance/${r.p.slug}` },
      { name: r.state, path: `/insurance/${r.p.slug}/${state}` },
    ]),
    facilityItemListJsonLd(r.rows),
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
        {r.rows.length} program{r.rows.length === 1 ? '' : 's'} in {r.state} that accept {r.p.name}-type coverage, with
        live bed availability. Always confirm current in-network status and benefits with the program. {SITE_NAME}{' '}
        connects you to treatment facilities; we don&apos;t provide treatment ourselves.
      </p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/match" className="font-medium text-teal-700 hover:underline">
          Get matched in 3 quick questions →
        </Link>
        <Link href={`/insurance/${r.p.slug}`} className="text-teal-700 hover:underline">
          {r.p.name} coverage &amp; cost
        </Link>
        <Link href={`/treatment/${state}`} className="text-teal-700 hover:underline">
          All treatment in {r.state}
        </Link>
      </div>

      <div className="mt-7 space-y-2">
        {r.rows.map((f) => (
          <FacilityCard key={f.id} f={f} />
        ))}
      </div>

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
