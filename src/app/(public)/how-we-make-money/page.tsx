import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import SiteFooter from '@/components/SiteFooter';
import { SITE_NAME, SITE_URL, absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';

const TITLE = `How ${SITE_NAME} Makes Money — and Why Nobody Can Buy Their Way Up`;
const DESCRIPTION =
  'Radical transparency: directory inclusion does not require payment, an approved ownership claim unlocks the full profile, and paid tools never influence matching.';

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
          Paid placement can be difficult to distinguish on treatment websites. {SITE_NAME} publishes how payment
          works here so people and programs can evaluate the model directly; programs cannot purchase directory rank.
        </p>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">The promise</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
            <li>
              <strong>Directory inclusion does not require payment.</strong> Name, location, and contact information are
              never paywalled. A program doesn&apos;t have to pay us to be found by you.
            </li>
            <li>
              <strong>Our matching agent can&apos;t be bought.</strong> When you answer a few questions, the programs
              you see are selected using directory level, payer type, any supported commercial carrier you volunteer,
              coarse scope, and region — never on who paid us. This is not a clinical placement recommendation.
            </li>
            <li>
              <strong>We&apos;re a connector, not a provider.</strong> We don&apos;t run treatment or give medical
              advice; we help you review and contact addiction-treatment directory programs. Providers determine
              clinical suitability and admission.
            </li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">So how do we actually make money?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            A facility can claim and fully represent itself for free — including photos, programs, staff credentials,
            reported payment details, and availability. Paid flat monthly subscriptions add the in-app analytics and
            lead-status workflow described on our pricing page. The fee is never tied to views, referrals, or admissions.
          </p>
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="font-serif text-xl text-ink">What money can&apos;t buy here</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
            <li>❌ A higher ranking or position in your matches.</li>
            <li>❌ Any change to how the matching agent works or which directory options it displays.</li>
            <li>
              ❌ Access to your phone or email — payment never buys it; a contact method is made available only when
              you consent. The same limited, non-contact match summary is routed regardless of payment.
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Paying unlocks operational tools. It never changes the public-profile entitlement or match order.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">Why a flat fee — and why that matters</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            The Eliminating Kickbacks in Recovery Act (EKRA) restricts certain remuneration connected to referrals
            involving recovery homes, clinical treatment facilities, and laboratories, subject to statutory scope and
            exceptions. Our flat-fee model is designed with those concerns in mind; this product decision is not a
            legal conclusion about any other business. Nothing a facility pays us is tied to referrals, admissions,
            or revenue. In plain terms, from our facility agreement:
          </p>
          <blockquote className="mt-3 border-l-2 border-teal-600 pl-4 text-sm italic leading-relaxed text-slate-600">
            &ldquo;Fees are flat-rate compensation for profile services and are not contingent on, or calculated by
            reference to, referrals, admissions, or revenue.&rdquo;
          </blockquote>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            That separation is designed to keep facility payment out of need-based matching.
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
              <h3 className="text-sm font-semibold text-slate-800">What paid plans add</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                You can&apos;t buy a better match ranking — and neither can your competitor. A free approved ownership
                claim already includes the complete profile: photos, programs, credentials, reported payment detail,
                and availability. Subscriptions add the in-app analytics and lead-status workflow described on our
                pricing page. Payment does not change directory inclusion or need-based matching.
              </p>
            </div>
            <div className="rounded-lg border border-teal-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800">Compliance-conscious structure</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Fees are flat and decoupled from referrals, admissions, and revenue. That structure is designed around
                anti-kickback and ethical-directory concerns, but it is not legal advice or a substitute for your own
                counsel&apos;s review of your organization&apos;s arrangements.
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
