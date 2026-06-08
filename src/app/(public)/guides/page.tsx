import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import { GUIDES } from '@/lib/guides';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Treatment Guides: Paying for Care, Levels of Care & How to Choose',
  description:
    'Clear, judgment-free guides to finding addiction and mental-health treatment — how to pay for it, what the levels of care mean, how to choose a program, and how to help a loved one.',
  alternates: { canonical: '/guides' },
  openGraph: {
    title: 'Treatment Guides | Clear Bed Recovery',
    description: 'Plain-English guides to paying for treatment, levels of care, and choosing the right program.',
    url: absoluteUrl('/guides'),
  },
};

export default function GuidesIndex() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: GUIDES.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/guides/${g.slug}`),
      name: g.title,
    })),
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">
        Treatment <span className="italic text-brand">guides</span>
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        Plain-English, judgment-free answers to the questions people actually have when they start looking for care.
        {' '}
        {SITE_NAME} connects you to treatment facilities; we don&apos;t provide treatment ourselves.
      </p>

      <div className="mt-6 space-y-3">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-300"
          >
            <h2 className="font-semibold text-slate-800">{g.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{g.dek}</p>
            <span className="mt-2 inline-block text-xs text-slate-400">{g.readMinutes} min read</span>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-xl bg-mist p-5 text-center">
        <p className="text-sm text-ink">Ready to find a program that fits?</p>
        <Link
          href="/match"
          className="mt-2 inline-block rounded-md bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark"
        >
          Get matched in 3 quick questions →
        </Link>
      </div>
    </main>
  );
}
