import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import SiteFooter from '@/components/SiteFooter';
import { SITE_NAME, SITE_URL, absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';

// Dated snapshot of the directory (how data-PR reports work — a point-in-time
// figure set with an "as of" date). Refresh the numbers each quarter from the
// aggregate query; the page itself is a public, link-earning asset and the
// top-of-funnel for paid custom reports + data licensing.
const AS_OF = 'July 15, 2026';
const SNAPSHOT = {
  programs: 13501,
  states: 54,
  cities: 4433,
  levels: [
    { label: 'Outpatient', count: 10565, pct: 78 },
    { label: 'Intensive outpatient (IOP)', count: 5202, pct: 39 },
    { label: 'Residential', count: 2677, pct: 20 },
    { label: 'Detox services (setting varies)', count: 2497, pct: 18 },
    { label: 'Partial hospitalization (PHP)', count: 1968, pct: 15 },
  ],
};

const TITLE = 'The State of Treatment Access — U.S. Directory Snapshot';
const DESCRIPTION =
  'A point-in-time snapshot of published U.S. addiction-treatment directory records by level of care, with transparent source and methodology limits.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/data' },
  openGraph: { title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, url: absoluteUrl('/data') },
};

const fmt = (n: number) => n.toLocaleString('en-US');

export default function DataPage() {
  const schema = [
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Treatment access data', path: '/data' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'Clear Bed Recovery — U.S. Treatment Access Directory',
      description: DESCRIPTION,
      url: absoluteUrl('/data'),
      creator: { '@id': `${SITE_URL}/#organization` },
      temporalCoverage: '2026',
      spatialCoverage: 'United States',
      isAccessibleForFree: true,
      keywords: ['addiction treatment', 'rehab capacity', 'bed availability', 'treatment access', 'detox'],
    },
  ];

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <JsonLd data={schema} />
        <nav className="text-xs text-slate-500">
          <Link href="/" className="text-teal-700 hover:underline">
            Home
          </Link>{' '}
          / <span>Treatment access data</span>
        </nav>

        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
          Data &amp; research · directory snapshot as of {AS_OF}
        </p>
        <h1 className="mt-1 font-serif text-3xl leading-tight text-ink sm:text-4xl">The State of Treatment Access</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          This snapshot summarizes published records in the {SITE_NAME} directory, which begins with federal SAMHSA
          locator data and may include provider updates. It is not a census of every licensed program, proof that every
          listing is currently licensed, or a real-time measure of available treatment capacity. Payment never determines
          whether a program appears in the underlying directory counts.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            ['Published records', fmt(SNAPSHOT.programs)],
            ['States & territories', String(SNAPSHOT.states)],
            ['Cities covered', fmt(SNAPSHOT.cities)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-2xl font-semibold text-slate-800">{value}</div>
              <div className="mt-0.5 text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>

        <section className="mt-9">
          <h2 className="font-serif text-xl text-ink">Records by listed service or level of care</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Share of tracked records listing each service or level (a record may list several). These counts describe
            directory taxonomy, not open beds or appointment slots.
          </p>
          <div className="mt-4 space-y-3">
            {SNAPSHOT.levels.map((l) => (
              <div key={l.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{l.label}</span>
                  <span className="text-slate-500">
                    {l.pct}% · {fmt(l.count)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-teal-600" style={{ width: `${l.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-9 rounded-xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="font-serif text-xl text-ink">What the directory mix suggests</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Outpatient services appear on roughly 4 in 5 tracked records, while{' '}
            <strong>{SNAPSHOT.levels.find((l) => l.label === 'Residential')?.pct}% list residential care</strong>. The{' '}
            <strong>{SNAPSHOT.levels.find((l) => l.label.startsWith('Detox services'))?.pct}% detox figure cannot be read
            as overnight detox capacity</strong>: the imported source category currently combines outpatient,
            residential, and hospital inpatient detoxification. These service counts do not establish a live opening,
            bed supply, admission eligibility, or network coverage; direct confirmation is still required.
          </p>
        </section>

        {/* Lead-gen for the paid data business */}
        <section className="mt-9 rounded-xl border border-teal-200 bg-teal-50/60 p-5">
          <h2 className="font-serif text-xl text-ink">Need this for your market?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            We produce custom regional access reports, bed-and-payer gap analyses, and licensed data feeds for treatment
            operators, health systems, EAPs, investors, and researchers. If you need to understand capacity, payer
            acceptance, or distance-to-care in a specific market, we can build it from source-dated directory data and
            clearly state its limits.
          </p>
          <a
            href="mailto:nick.dowling@clearbedrecovery.com?subject=Treatment%20access%20data%20%2F%20custom%20report"
            className="mt-4 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
          >
            Request data or a custom report →
          </a>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-slate-500">
          Methodology: figures reflect published directory records counted as of {AS_OF}, sourced primarily from
          SAMHSA locator data plus provider or directory updates. Records have mixed verification and freshness states;
          these figures should not be treated as live capacity, a licensing registry, or a quality ranking. Percentages
          are of tracked records, and programs may list multiple services, so columns sum above 100%. The current detox
          category combines outpatient, residential, and hospital inpatient detoxification and must not be used as an
          estimate of detox beds. {SITE_NAME} is a directory, not a treatment provider.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
