import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { PAYERS, type PayerKind } from '@/lib/payers';
import { PayerMark } from '@/components/PayerLogo';

export const metadata: Metadata = {
  title: 'Insurance & Payment Guides for Addiction Treatment',
  description:
    'General guides to insurance and payment questions for addiction treatment, including Medicaid, Medicare, TRICARE, commercial plans, and self-pay.',
  alternates: { canonical: '/insurance' },
  openGraph: {
    title: 'Treatment by Insurance | Clear Bed Recovery',
    description: 'General insurance and payment questions to verify with a plan and treatment program.',
    url: absoluteUrl('/insurance'),
  },
};

const GROUPS: { kind: PayerKind; label: string }[] = [
  { kind: 'public', label: 'Government plans' },
  { kind: 'military', label: 'Military' },
  { kind: 'commercial', label: 'Commercial / private insurers' },
  { kind: 'self', label: 'Paying out of pocket' },
];

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
        Coverage depends on the plan, medical-necessity rules, network, authorization, and the service requested.
        Pick a coverage guide to learn what to ask and how to verify your own benefits.
      </p>

      {GROUPS.map((g) => {
        const items = PAYERS.filter((p) => p.kind === g.kind);
        if (items.length === 0) return null;
        return (
          <section key={g.kind} className="mt-7">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">{g.label}</h2>
            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/insurance/${p.slug}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-teal-300"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PayerMark brand={p.brand} size="lg" />
                      <span className="truncate font-medium text-slate-800">{p.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">What to verify →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {/* Self-pay guidance without an unsourced universal price range. */}
      <section className="mt-9 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">If you are considering self-pay</h2>
        <p className="mt-1 text-xs text-slate-500">
          There is no single reliable price for a level of care. Ask the program for a written estimate that says what
          services and time period it covers, whether additional clinical or medication charges may apply, and what
          payment-assistance and refund policies are available.
        </p>
        <Link href="/guides/how-to-pay-for-addiction-treatment" className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline">
          Read: How to pay for treatment →
        </Link>
      </section>

      <p className="mt-6 text-xs text-slate-400">
        {SITE_NAME} connects you to treatment facilities; we don&apos;t provide treatment ourselves, and we never
        charge you to use the service. This page is general information, not insurance or medical advice.
      </p>
    </main>
  );
}
