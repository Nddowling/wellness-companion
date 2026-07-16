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
          {SITE_NAME} helps people navigate addiction-treatment directory options, including programs that may list
          co-occurring mental-health services, with dated availability reports when available. We are a connector: we help you reach treatment
          facilities, but we do not provide treatment or give medical advice ourselves. Using {SITE_NAME} is free,
          private, and requires no account to start.
        </p>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">How we build the directory</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Our listings start from the federal SAMHSA treatment-locator dataset and may be enriched with a
            program&apos;s own published information: levels of care, services, listed payment options, and contact
            details. A federal review (HHS OIG,
            2025) found that public treatment directories can contain out-of-date information, so we treat the
            government data as a starting point, not the final word.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Imported listings can be unclaimed and should not be read as a Clear Bed endorsement. Each profile shows
            whether it is directory-maintained or claimed, the source and check date when available, and a verification
            confidence label. Programs can claim a listing for free to correct and maintain it. Accreditation is shown
            only when it exists in the underlying record and should still be confirmed directly.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">Bed availability you can trust</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Availability changes quickly. When a program reports a bed count, {SITE_NAME} shows when it was updated.
            Exact counts disappear after seven days and the profile switches to &ldquo;call to confirm.&rdquo; A reported
            opening is never an admission guarantee. Outpatient programs do not use bed counts, so scheduling must be
            confirmed directly.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">Private by design</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            You can browse the directory without an account. The guided match uses only coarse, non-contact answers
            and excludes direct identifiers.
            After seeing matches, you may choose to share your name, email, and phone so those displayed programs can
            follow up. We do not ask for a home address, date of birth, insurance member ID, or clinical narrative,
            and there&apos;s no account or commitment. When
            you choose to share your information with the programs displayed in that match, you control that, and we
            record your consent with a timestamp. We never sell personal information. Treatment providers may have
            separate duties under HIPAA, 42 CFR Part 2, and state law; see our Privacy Policy for our practices.
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
