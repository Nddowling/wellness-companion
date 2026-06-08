import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import JsonLd from '@/components/JsonLd';
import { FacilityCard, type FacilityCardData } from '@/components/FacilityCard';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { getPayer } from '@/lib/payers';
import { codeFromStateSlug, stateName } from '@/lib/geo';

export const revalidate = 3600;

async function load(payerSlugParam: string, stateSlugParam: string) {
  const p = getPayer(payerSlugParam);
  const code = codeFromStateSlug(stateSlugParam);
  if (!p || !code) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facilities')
    .select('id, name, city, state, levels_of_care, facility_payers!inner(payer_type)')
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Insurance', item: absoluteUrl('/insurance') },
      { '@type': 'ListItem', position: 2, name: r.p.name, item: absoluteUrl(`/insurance/${r.p.slug}`) },
      { '@type': 'ListItem', position: 3, name: r.state, item: absoluteUrl(`/insurance/${r.p.slug}/${state}`) },
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
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
    </main>
  );
}
