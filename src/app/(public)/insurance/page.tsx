import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';
import { PAYERS, SELF_PAY_RANGES, type PayerKind } from '@/lib/payers';

export const metadata: Metadata = {
  title: 'Treatment by Insurance: Coverage & Costs (Medicaid, Aetna, BCBS, Cigna & More)',
  description:
    'See which insurance plans cover addiction and mental-health treatment — Medicaid, Medicare, TRICARE, Aetna, Blue Cross Blue Shield, Cigna, UnitedHealthcare, Humana, and more — plus typical self-pay costs.',
  alternates: { canonical: '/insurance' },
  openGraph: {
    title: 'Treatment by Insurance | Clear Bed Recovery',
    description: 'Coverage and cost info for the major insurers — plus typical self-pay ranges.',
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
        Most plans cover addiction and mental-health treatment by law — often at little or no out-of-pocket cost.
        Pick your coverage to see what&apos;s typically covered and how to verify your benefits.
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
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-teal-300"
                  >
                    <span className="font-medium text-slate-800">{p.name}</span>
                    <span className="text-xs text-slate-400">Coverage &amp; cost →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {/* Self-pay ballpark — the one place real numbers exist */}
      <section className="mt-9 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">Typical self-pay costs (general estimates)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Ballpark ranges to set expectations — <strong>not a quote</strong>. Actual cost depends on the program,
          length of stay, and amenities, and should be confirmed with the facility. With insurance, you typically pay
          far less.
        </p>
        <div className="mt-3 divide-y divide-slate-100">
          {SELF_PAY_RANGES.map((r) => (
            <div key={r.level} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between">
              <span className="text-sm font-medium text-slate-700">{r.label}</span>
              <span className="text-sm text-slate-500 sm:text-right">{r.range}</span>
            </div>
          ))}
        </div>
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
