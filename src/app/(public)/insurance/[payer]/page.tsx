import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';

import JsonLd from '@/components/JsonLd';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { getPayer, type Payer } from '@/lib/payers';
import { PayerMark } from '@/components/PayerLogo';
import { stateName, stateSlug } from '@/lib/geo';
import { throwOnPublicReadError } from '@/lib/public-read-error';
import { collectPublicRows } from '@/lib/supabase/public-pagination';

export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

async function statesFor(payer: Payer) {
  const supabase = createAdminClient();
  if (payer.kind !== 'commercial') {
    const { data, error } = await supabase.rpc('facilities_facet_counts', {
      p_pay: payer.payerType,
    });
    throwOnPublicReadError('insurance payer state facets', error);
    const regions =
      data && typeof data === 'object' && !Array.isArray(data) &&
      'regions' in data && data.regions && typeof data.regions === 'object' && !Array.isArray(data.regions)
        ? (data.regions as Record<string, unknown>)
        : {};
    const states = Object.entries(regions)
      .map(([code, value]) => ({
        code: code.toUpperCase(),
        n: Number(value),
        name: stateName(code),
        slug: stateSlug(code),
      }))
      .filter((state) => state.code && Number.isFinite(state.n) && state.n > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { total: states.reduce((sum, state) => sum + state.n, 0), states };
  }
  const data = await collectPublicRows('insurance payer states', async (from, to) => {
    const result = await supabase
      .from('facilities')
      .select('id, state')
      .eq('is_published', true)
      .contains('carriers_named', [payer.name])
      .order('id')
      .range(from, to);
    return { data: result.data, error: result.error };
  });
  const counts = new Map<string, number>();
  for (const row of data) {
    const code = (row.state ?? '').toUpperCase();
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return {
    total: data.length,
    states: [...counts.entries()]
      .map(([code, n]) => ({ code, n, name: stateName(code), slug: stateSlug(code) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ payer: string }>;
}): Promise<Metadata> {
  const { payer } = await params;
  const p = getPayer(payer);
  if (!p) return { title: 'Coverage not found', robots: { index: false, follow: true } };
  const title = `${p.name} Insurance Guide for Addiction Treatment`;
  const description = `General ${p.name} treatment-coverage information, questions to ask, and how to verify your own benefits. Directory listings use program-reported payment data.`;
  return {
    title,
    description,
    alternates: { canonical: `/insurance/${p.slug}` },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl(`/insurance/${p.slug}`) },
  };
}

export default async function PayerPage({ params }: { params: Promise<{ payer: string }> }) {
  const { payer } = await params;
  const p = getPayer(payer);
  if (!p) notFound();
  if (payer !== p.slug) permanentRedirect(`/insurance/${p.slug}`);
  const { total, states } = await statesFor(p);
  const evidenceLabel = p.kind === 'commercial' ? `${p.name} as a payment option` : `${p.name}-type payment`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Insurance', item: absoluteUrl('/insurance') },
      { '@type': 'ListItem', position: 2, name: p.name, item: absoluteUrl(`/insurance/${p.slug}`) },
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <nav className="text-xs text-slate-500">
        <Link href="/insurance" className="text-teal-700 hover:underline">
          Insurance
        </Link>{' '}
        / <span>{p.name}</span>
      </nav>

      <h1 className="mt-2 flex flex-wrap items-center gap-2.5 font-serif text-3xl leading-tight text-ink sm:text-4xl">
        <PayerMark brand={p.brand} size="lg" />
        <span><span className="italic text-brand">{p.name}</span> &amp; addiction treatment</span>
      </h1>

      {/* Standard coverage */}
      <section className="mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">What coverage may include</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{p.coverage}</p>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          {['Detox', 'Residential', 'PHP', 'IOP', 'Outpatient'].map((l) => (
            <li key={l} className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
              {l}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          Covered services depend on medical necessity and your specific plan.
        </p>
      </section>

      {/* Cost / pricing — heavily disclaimed */}
      <section className="mt-7 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">What will it cost?</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-slate-700">{p.pricingNote}</p>
        <p className="mt-2 text-xs text-slate-400">
          Ask the program for a written estimate of what its amount covers. Coverage and member cost must be confirmed
          with both the plan and the program; a benefits check is not a guarantee of payment.
        </p>
      </section>

      <div className="mt-6">
        <Link
          href="/match"
          className="inline-block rounded-md bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark"
        >
          Find programs and verify {p.name} coverage →
        </Link>
      </div>

      {states.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            Programs listing {p.name} by state
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {total} published program{total === 1 ? '' : 's'} in our directory list {evidenceLabel}. This is not
            proof of network participation or member benefits.
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {states.map((s) => (
              <li key={s.code}>
                <Link
                  href={`/insurance/${p.slug}/${s.slug}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-teal-300"
                >
                  <span className="font-medium text-slate-800">
                    {p.name} treatment in {s.name}
                  </span>
                  <span className="text-xs text-slate-400">{s.n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs text-slate-400">
        {SITE_NAME} connects you to treatment facilities; we don&apos;t provide treatment ourselves. This page is
        general information, not insurance or medical advice.
      </p>
    </main>
  );
}
