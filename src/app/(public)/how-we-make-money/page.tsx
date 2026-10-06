import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import SiteFooter from '@/components/SiteFooter';
import { SITE_NAME, SITE_URL, absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';

const TITLE = `How ${SITE_NAME} Is Funded — and Why Nobody Can Buy Their Way Up`;
const DESCRIPTION =
  'Directory inclusion and current provider tools do not require payment. Self-service provider billing is paused while we evaluate a sustainable model; payment cannot influence matching.';

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
          How {SITE_NAME} is funded
          <span className="block text-xl text-brand sm:text-2xl">— and why nobody can buy their way up</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-700">
          Paid placement can be difficult to distinguish on treatment websites. We explain our current funding
          status and the limits we place on any future model: programs cannot purchase directory rank.
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
          <h2 className="font-serif text-xl text-ink">What is the current model?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            A facility can claim and fully represent itself for free — including photos, programs, staff credentials,
            reported payment details, and availability. The currently available analytics and workflow tools are also
            accessible without self-service payment. We have paused provider subscriptions while we evaluate how to
            fund the service sustainably. We do not sell patient leads or charge per referral or admission.
          </p>
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="font-serif text-xl text-ink">What money can&apos;t buy here</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
            <li>❌ A higher ranking or position in your matches.</li>
            <li>❌ Any change to how the matching agent works or which directory options it displays.</li>
            <li>
              ❌ Access to your name, email, or phone — payment never buys it; contact details are made available only when
              you consent. The same limited, non-contact match summary is routed regardless of payment.
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Payment cannot change the public-profile entitlement or match order.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">Guardrails for any future revenue model</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            The Eliminating Kickbacks in Recovery Act (EKRA) restricts certain remuneration connected to referrals
            involving recovery homes, clinical treatment facilities, and laboratories, subject to statutory scope and
            exceptions. We will not turn treatment seekers into paid leads or allow payment to alter need-based
            matching. Any future paid offering would need its own clearly disclosed terms and legal review; a flat
            price by itself is not a legal safe harbor.
          </p>
        </section>

        {/* Provider-facing section — the forwardable part for facilities / BD teams. */}
        <section className="mt-10 rounded-xl border border-teal-200 bg-teal-50/60 p-5">
          <h2 className="font-serif text-xl text-ink">For treatment providers</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            If you run or do outreach for a program, here&apos;s what is available today.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-teal-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800">What your free claim includes</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                You can&apos;t buy a better match ranking — and neither can your competitor. A free approved ownership
                claim already includes the complete profile: photos, programs, credentials, reported payment detail,
                and availability. Currently available analytics and lead-status tools are accessible without a
                subscription. Payment does not change directory inclusion or need-based matching.
              </p>
            </div>
            <div className="rounded-lg border border-teal-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800">Compliance-conscious structure</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                We do not charge per lead, referral, or admission. Any future commercial offering will be assessed
                against anti-kickback and ethical-directory concerns. This is not legal advice or a substitute for
                counsel&apos;s review of a specific arrangement.
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
              See provider information
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
