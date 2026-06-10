import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import SiteFooter from '@/components/SiteFooter';
import { SITE_NAME, SITE_URL, absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';

const TITLE = `How ${SITE_NAME} Makes Money — and Why Nobody Can Buy Their Way Up`;
const DESCRIPTION =
  'Radical transparency: every licensed facility is listed free, the match agent can’t be bought, and facilities pay a flat fee for a richer profile — never for ranking, placement, or patient access.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/how-we-make-money' },
  openGraph: { title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, url: absoluteUrl('/how-we-make-money') },
};

export default function HowWeMakeMoneyPage() {
  const schema = [
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'How we make money', path: '/how-we-make-money' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: TITLE,
      url: absoluteUrl('/how-we-make-money'),
      mainEntity: { '@id': `${SITE_URL}/#organization` },
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
          / <span>How we make money</span>
        </nav>

        <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
          How {SITE_NAME} makes money
          <span className="block text-xl text-brand sm:text-2xl">— and why nobody can buy their way up</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-700">
          Most addiction-treatment websites quietly sell their rankings. The facility that pays the most shows up
          first, and you have no way to know. {SITE_NAME} is built to be the opposite — and we think you deserve to
          see exactly how the money works.
        </p>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">The promise</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
            <li>
              <strong>Every licensed facility is listed free, forever.</strong> Name, location, and contact info are
              never paywalled. A program doesn&apos;t have to pay us to be found by you.
            </li>
            <li>
              <strong>Our matching agent can&apos;t be bought.</strong> When you answer a few questions, the programs
              you see are matched on level of care, coverage, and region — never on who paid us.
            </li>
            <li>
              <strong>We&apos;re a connector, not a provider.</strong> We don&apos;t run treatment or give medical
              advice; we help you reach the programs that fit.
            </li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">So how do we actually make money?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Treatment facilities can pay a <strong>flat monthly subscription</strong> to fully represent themselves —
            photos, programs, staff credentials, accepted insurance, and live bed availability. They&apos;re paying for
            a <strong>complete, verified profile and findability</strong>, the same way a business pays for a better
            page. That&apos;s it. The fee is the same whether one person or one thousand people view their listing.
          </p>
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="font-serif text-xl text-ink">What money can&apos;t buy here</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
            <li>❌ A higher ranking or position in your matches.</li>
            <li>❌ Any change to how the matching agent works or who it recommends.</li>
            <li>❌ Access to your information — your details are only ever shared with a program when you choose.</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Paying unlocks a richer profile. It never moves a facility up, and it never moves another facility down.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">Why a flat fee — and why that matters</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Federal law (the Eliminating Kickbacks in Recovery Act, or EKRA) makes it a crime to pay or be paid for
            patient referrals in addiction treatment. A lot of treatment lead-generation is structured right up against
            that line — charging per lead, per call, or per admission. {SITE_NAME} is deliberately built so that
            nothing a facility pays is tied to referrals, admissions, or revenue. In plain terms, from our facility
            agreement:
          </p>
          <blockquote className="mt-3 border-l-2 border-teal-600 pl-4 text-sm italic leading-relaxed text-slate-600">
            &ldquo;Fees are flat-rate compensation for profile services and are not contingent on, or calculated by
            reference to, referrals, admissions, or revenue.&rdquo;
          </blockquote>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            That structure is the reason you can trust what you find here — and it&apos;s the whole point.
          </p>
        </section>

        {/* Provider-facing section — the forwardable part for facilities / BD teams. */}
        <section className="mt-10 rounded-xl border border-teal-200 bg-teal-50/60 p-5">
          <h2 className="font-serif text-xl text-ink">For treatment providers</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            If you run or do outreach for a program, here&apos;s the case in one place — forward it to whoever signs off
            on the budget.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-teal-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800">The visibility math</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                You can&apos;t buy a better ranking — and neither can your competitor. What a subscription buys is the
                ability to <strong>fully tell your story</strong>: photos, programs, credentials, insurance detail, and
                live availability, in the one local place families and referral sources trust precisely because nobody
                can buy placement. A complete, verified profile is a flat monthly fee, the same no matter how many
                people see it.
              </p>
            </div>
            <div className="rounded-lg border border-teal-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800">Zero EKRA exposure</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Because the fee is flat and decoupled from referrals, admissions, and revenue, working with{' '}
                {SITE_NAME} adds <strong>no kickback exposure</strong> to your facility — which can&apos;t be said for
                much of the lead-generation in this industry. Show the agreement language above to your counsel.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link
              href="/claim"
              className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white transition hover:bg-teal-800"
            >
              Claim your free listing →
            </Link>
            <Link
              href="/for-providers"
              className="rounded-md border border-teal-700 px-4 py-2 font-medium text-teal-700 transition hover:bg-teal-700 hover:text-white"
            >
              See provider plans
            </Link>
          </div>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-slate-500">
          {SITE_NAME} is a directory, not a treatment provider, and this page is not medical or legal advice. If you or
          someone you know is in immediate danger, call 911, the 988 Suicide &amp; Crisis Lifeline, or the Georgia
          Crisis &amp; Access Line at 1-800-715-4225.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
