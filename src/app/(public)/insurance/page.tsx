import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { PAYER_TYPES, PAYER_LABELS, payerSlug } from '@/lib/insurance';

export const metadata: Metadata = {
  title: 'Treatment by Insurance: Medicaid, Medicare, Commercial, TRICARE & Self-Pay',
  description:
    'Find addiction and mental-health treatment programs that accept your coverage — Medicaid, Medicare, commercial/employer plans, TRICARE, or self-pay. Verify benefits before you call.',
  alternates: { canonical: '/insurance' },
  openGraph: {
    title: 'Treatment by Insurance | Clear Bed Recovery',
    description: 'Find programs that accept Medicaid, Medicare, commercial plans, TRICARE, or self-pay.',
    url: absoluteUrl('/insurance'),
  },
};

export default function InsuranceIndex() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Treatment by insurance', item: absoluteUrl('/insurance') },
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">
        Treatment by <span className="italic text-brand">insurance</span>
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        Most plans cover addiction and mental-health treatment by law — often at little or no out-of-pocket cost.
        Find programs that accept your coverage, then verify your benefits in a single call.
      </p>
      <div className="mt-4">
        <Link href="/guides/how-to-pay-for-addiction-treatment" className="text-sm font-medium text-teal-700 hover:underline">
          Read: How to pay for treatment →
        </Link>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-teal-700">Browse by coverage</h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PAYER_TYPES.map((p) => (
          <li key={p}>
            <Link
              href={`/insurance/${payerSlug(p)}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-teal-300"
            >
              <span className="font-medium text-slate-800">{PAYER_LABELS[p]}</span>
              <span className="text-xs text-slate-400">View programs →</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-slate-400">
        {SITE_NAME} connects you to treatment facilities; we don&apos;t provide treatment ourselves, and we never
        charge you to use the service.
      </p>
    </main>
  );
}
