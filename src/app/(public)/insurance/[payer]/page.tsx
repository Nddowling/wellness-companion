import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import JsonLd from '@/components/JsonLd';
import { createAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { PAYER_LABELS, payerFromSlug, payerSlug } from '@/lib/insurance';
import { stateName, stateSlug } from '@/lib/geo';

export const revalidate = 3600;

async function load(payerSlugParam: string) {
  const payer = payerFromSlug(payerSlugParam);
  if (!payer) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facilities')
    .select('state, facility_payers!inner(payer_type)')
    .eq('is_published', true)
    .eq('facility_payers.payer_type', payer);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const code = (row.state ?? '').toUpperCase();
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const states = [...counts.entries()]
    .map(([code, n]) => ({ code, n, name: stateName(code), slug: stateSlug(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { payer, label: PAYER_LABELS[payer], total: (data ?? []).length, states };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ payer: string }>;
}): Promise<Metadata> {
  const { payer } = await params;
  const r = await load(payer);
  if (!r) return { title: 'Coverage not found', robots: { index: false, follow: true } };
  const title = `Treatment That Accepts ${r.label}`;
  const description = `${r.total} addiction and mental-health treatment programs that accept ${r.label}, with real-time bed availability. Verify your benefits and get matched — free and private.`;
  return {
    title,
    description,
    alternates: { canonical: `/insurance/${payer}` },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: absoluteUrl(`/insurance/${payer}`) },
  };
}

export default async function PayerPage({ params }: { params: Promise<{ payer: string }> }) {
  const { payer } = await params;
  const r = await load(payer);
  if (!r) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Insurance', item: absoluteUrl('/insurance') },
      { '@type': 'ListItem', position: 2, name: r.label, item: absoluteUrl(`/insurance/${payer}`) },
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <nav className="text-xs text-slate-500">
        <Link href="/insurance" className="text-teal-700 hover:underline">
          Insurance
        </Link>{' '}
        / <span>{r.label}</span>
      </nav>

      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
        Treatment that accepts <span className="italic text-brand">{r.label}</span>
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        {r.total} program{r.total === 1 ? '' : 's'} that accept {r.label}, with live bed availability. Coverage and
        in-network status should always be confirmed with the program. {SITE_NAME} connects you to treatment
        facilities; we don&apos;t provide treatment ourselves.
      </p>
      <div className="mt-4">
        <Link href="/match" className="text-sm font-medium text-teal-700 hover:underline">
          Get matched to {r.label} programs in 3 questions →
        </Link>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-teal-700">By state</h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {r.states.map((s) => (
          <li key={s.code}>
            <Link
              href={`/insurance/${payerSlug(r.payer)}/${s.slug}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-teal-300"
            >
              <span className="font-medium text-slate-800">
                {r.label} treatment in {s.name}
              </span>
              <span className="text-xs text-slate-400">{s.n}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
