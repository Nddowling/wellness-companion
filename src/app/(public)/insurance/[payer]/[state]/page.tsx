import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import JsonLd from '@/components/JsonLd';
import { FacilityCard, type FacilityCardData } from '@/components/FacilityCard';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { PAYER_LABELS, payerFromSlug } from '@/lib/insurance';
import { codeFromStateSlug, stateName } from '@/lib/geo';

export const revalidate = 3600;

async function load(payerSlugParam: string, stateSlugParam: string) {
  const payer = payerFromSlug(payerSlugParam);
  const code = codeFromStateSlug(stateSlugParam);
  if (!payer || !code) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facilities')
    .select('id, name, city, state, levels_of_care, facility_payers!inner(payer_type)')
    .eq('is_published', true)
    .ilike('state', code)
    .eq('facility_payers.payer_type', payer)
    .order('name');
  const rows = (data ?? []) as FacilityCardData[];
  if (rows.length === 0) return null;
  return { payer, label: PAYER_LABELS[payer], code, state: stateName(code), rows };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ payer: string; state: string }>;
}): Promise<Metadata> {
  const { payer, state } = await params;
  const r = await load(payer, state);
  if (!r) return { title: 'Coverage not found', robots: { index: false, follow: true } };
  const title = `${r.label} Treatment in ${r.state}`;
  const description = `${r.rows.length} addiction and mental-health programs in ${r.state} that accept ${r.label}, with real-time bed availability. Verify benefits and get matched — free and private.`;
  return {
    title,
    description,
    alternates: { canonical: `/insurance/${payer}/${state}` },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl(`/insurance/${payer}/${state}`) },
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
      { '@type': 'ListItem', position: 2, name: r.label, item: absoluteUrl(`/insurance/${payer}`) },
      { '@type': 'ListItem', position: 3, name: r.state, item: absoluteUrl(`/insurance/${payer}/${state}`) },
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
        <Link href={`/insurance/${payer}`} className="text-teal-700 hover:underline">
          {r.label}
        </Link>{' '}
        / <span>{r.state}</span>
      </nav>

      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
        <span className="italic text-brand">{r.label}</span> treatment in {r.state}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        {r.rows.length} program{r.rows.length === 1 ? '' : 's'} in {r.state} that accept {r.label}, with live bed
        availability. Always confirm current in-network status with the program. {SITE_NAME} connects you to treatment
        facilities; we don&apos;t provide treatment ourselves.
      </p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/match" className="font-medium text-teal-700 hover:underline">
          Get matched in 3 quick questions →
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
