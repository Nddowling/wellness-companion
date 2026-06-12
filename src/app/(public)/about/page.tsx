import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import SiteFooter from '@/components/SiteFooter';
import { SITE_NAME, SITE_URL, absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';

const TITLE = `About ${SITE_NAME} — How We Vet Treatment Programs`;
const DESCRIPTION =
  'How Clear Bed Recovery sources, verifies, and publishes addiction-treatment listings — and why we are a connector, not a provider. Free, private, and built for accuracy.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: { title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, url: absoluteUrl('/about') },
};

export default function AboutPage() {
  const schema = [
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'About', path: '/about' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: TITLE,
      url: absoluteUrl('/about'),
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
          / <span>About</span>
        </nav>

        <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
          About <span className="italic text-brand">{SITE_NAME}</span>
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          {SITE_NAME} helps people find addiction and mental-health treatment that fits their situation, insurance, and
          region — with real-time bed availability. We are a connector: we help you reach the right treatment
          facilities, but we do not provide treatment or give medical advice ourselves. Using {SITE_NAME} is free,
          private, and requires no account to start.
        </p>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">How we build the directory</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Our listings start from the SAMHSA National Directory of Drug and Alcohol Use Treatment Facilities — the
            federal government&apos;s authoritative source — and are enriched with each program&apos;s own published
            information: levels of care, services, accepted insurance, and contact details. A federal review (HHS OIG,
            2025) found that public treatment directories can contain out-of-date information, so we treat the
            government data as a starting point, not the final word.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Before a program appears publicly, it is reviewed and matched against multiple sources. Programs can claim
            their listing to verify and keep it current, and verified and accredited programs (such as CARF- or
            Joint Commission-accredited facilities) are labeled as such so you can weigh the source of every detail.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">Bed availability you can trust</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Most directories tell you a program exists; they can&apos;t tell you whether it has space today. Every
            {' '}{SITE_NAME} listing shows live bed availability with a freshness indicator, so you can see who can
            actually take an admission now instead of calling down a stale list. Outpatient programs, which don&apos;t
            use beds, show whether they&apos;re accepting clients.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">Private by design</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            You can browse the full directory anonymously. The guided match starts with your name and email so a real
            program can follow up — but never an insurance member ID, and there&apos;s no account and no commitment. When
            you choose to share your information with a specific program, you control that, and we record your consent
            with a timestamp. We never sell personal information, and we follow strict privacy rules for any health-related
            data (HIPAA and 42 CFR Part 2).
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">Contact</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Questions, corrections, or a listing to claim? Email{' '}
            <a href="mailto:hello@clearbedrecovery.com" className="text-teal-700 hover:underline">
              hello@clearbedrecovery.com
            </a>
            . If you or someone you know is in immediate danger, call 911 or the 988 Suicide &amp; Crisis Lifeline, or
            reach SAMHSA&apos;s free, confidential helpline at 1-800-662-4357.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/match" className="font-medium text-teal-700 hover:underline">
            Get matched in 3 quick questions →
          </Link>
          <Link href="/treatment" className="text-teal-700 hover:underline">
            Browse treatment by state
          </Link>
          <Link href="/for-providers" className="text-teal-700 hover:underline">
            For providers
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
