import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import SiteFooter from '@/components/SiteFooter';
import { SITE_NAME, SITE_URL, absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';

// Dated snapshot of the directory (how data-PR reports work — a point-in-time
// figure set with an "as of" date). Refresh the numbers each quarter from the
// aggregate query; the page itself is a public, link-earning asset and the
// top-of-funnel for paid custom reports + data licensing.
const AS_OF = 'June 2026';
const SNAPSHOT = {
  programs: 13500,
  states: 54,
  cities: 4435,
  levels: [
    { label: 'Outpatient', count: 10565, pct: 78 },
    { label: 'Intensive outpatient (IOP)', count: 5201, pct: 39 },
    { label: 'Residential', count: 2676, pct: 20 },
    { label: 'Medical detox', count: 2496, pct: 18 },
    { label: 'Partial hospitalization (PHP)', count: 1967, pct: 15 },
  ],
};

const TITLE = 'The State of Treatment Access — Verified U.S. Directory Data';
const DESCRIPTION =
  'A verified, real-time snapshot of U.S. addiction-treatment capacity from the Clear Bed Recovery directory — programs by level of care, the acute-care access gap, and what it means for patients and operators.';

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
          Data &amp; research · verified as of {AS_OF}
        </p>
        <h1 className="mt-1 font-serif text-3xl leading-tight text-ink sm:text-4xl">The State of Treatment Access</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          {SITE_NAME} maintains one of the most complete, continuously verified directories of U.S. addiction and
          mental-health treatment. Unlike pay-to-list directories, every licensed facility is included — so the picture
          below reflects the real treatment landscape, not who paid to appear.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            ['Programs tracked', fmt(SNAPSHOT.programs)],
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
          <h2 className="font-serif text-xl text-ink">Capacity by level of care</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Share of tracked programs offering each level of care (programs often offer several).
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
          <h2 className="font-serif text-xl text-ink">The finding: an acute-care access gap</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Outpatient care is widely available — roughly 4 in 5 programs offer it. But the acute, bed-based care people
            in crisis need most is far scarcer: only about{' '}
            <strong>{SNAPSHOT.levels.find((l) => l.label === 'Medical detox')?.pct}% of programs offer medical detox</strong>{' '}
            and <strong>{SNAPSHOT.levels.find((l) => l.label === 'Residential')?.pct}% offer residential</strong>. For a
            family searching at 2 a.m., the question isn&apos;t whether treatment exists — it&apos;s whether a bed is
            open tonight, within reach, and covered. That gap is exactly what real-time bed availability is built to
            close.
          </p>
        </section>

        {/* Lead-gen for the paid data business */}
        <section className="mt-9 rounded-xl border border-teal-200 bg-teal-50/60 p-5">
          <h2 className="font-serif text-xl text-ink">Need this for your market?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            We produce custom regional access reports, bed-and-payer gap analyses, and licensed data feeds for treatment
            operators, health systems, EAPs, investors, and researchers. If you need to understand capacity, payer
            acceptance, or distance-to-care in a specific market, we can build it from verified data.
          </p>
          <a
            href="mailto:nick.dowling@clearbedrecovery.com?subject=Treatment%20access%20data%20%2F%20custom%20report"
            className="mt-4 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
          >
            Request data or a custom report →
          </a>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-slate-500">
          Methodology: figures reflect published programs in the {SITE_NAME} directory verified as of {AS_OF}, sourced
          from public licensing/SAMHSA data and continuous verification. Percentages are of tracked programs; programs
          commonly offer multiple levels of care, so columns sum above 100%. {SITE_NAME} is a directory, not a treatment
          provider.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
