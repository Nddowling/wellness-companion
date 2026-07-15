import type { Metadata } from 'next';
import Link from 'next/link';

import Reveal from '@/components/Reveal';
import { absoluteUrl } from '@/lib/seo';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'For Providers — List Your Addiction-Treatment Program',
  description:
    'Clear Bed Recovery connects treatment programs and referrers through need-based discovery, dated availability updates, and flat monthly tools — never per-lead pricing.',
  alternates: { canonical: '/for-providers' },
  openGraph: {
    title: 'For Providers — List Your Program on Clear Bed Recovery',
    description:
      'Make documented services, payment information, and dated availability easier to find. Flat monthly pricing, never per-lead.',
    url: absoluteUrl('/for-providers'),
  },
};

const VALUE_PROPS: [string, string][] = [
  [
    'Receive relevant directory matches',
    'We narrow on listed level of care, reported payment category, and region. Your admissions team still verifies coverage, clinical appropriateness, and admission.',
  ],
  [
    'Your dated availability updates, front and center',
    'Keep bed reports current and freshness can improve order within the same region. Exact counts disappear after seven days and never guarantee admission.',
  ],
  [
    'Own your profile',
    'Provider-supplied photos, documented specialties, reported payment options, reviews, and a direct intake line — with source and freshness cues.',
  ],
];

type Tier = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    name: 'Starter',
    price: '$499',
    cadence: 'per facility / month',
    blurb: 'Basic in-app listing analytics.',
    features: [
      '30-day profile contact-action total',
      'All-time website referral count',
      'Two included team seats',
      'Larger teams require a documented custom arrangement',
    ],
    cta: { label: 'Start Starter', href: '/pricing' },
  },
  {
    name: 'Growth',
    price: '$999',
    cadence: 'per facility / month',
    blurb: 'Analytics plus lead-status workflow.',
    features: [
      'Everything in Starter',
      'Mark leads viewed, accepted, or declined',
      'Two included team seats',
      'Larger teams require a documented custom arrangement',
    ],
    cta: { label: 'Start Growth', href: '/pricing' },
    featured: true,
  },
  {
    name: 'Anchor',
    price: '$1,999',
    cadence: 'per facility / month',
    blurb: 'Detailed in-app analytics and workflow.',
    features: [
      'Everything in Growth',
      '30-day website, call, directions, and email breakdown',
      'Two included team seats',
      'Larger teams require a documented custom arrangement',
    ],
    cta: { label: 'Start Anchor', href: '/pricing' },
  },
];

export default function ForProvidersPage() {
  return (
    <>
    <main className="text-slate-800">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-ink via-brand to-brand/70" />
        <div className="mx-auto max-w-5xl px-6 py-24 text-white">
          <div className="max-w-2xl animate-fade-up">
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide backdrop-blur">
              For treatment providers &amp; referrers
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Help people discover your program with clearer information.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/90">
              Clear Bed Recovery is a connector — we narrow directory options by listed level of care, reported
              payment category, region, and dated bed reports. You keep your profile current; your team determines
              coverage, clinical appropriateness, and admission.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/claim"
                className="rounded-md bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
              >
                Claim your facility for free →
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-white/40 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
              >
                Provider login
              </Link>
            </div>
            <p className="mt-5 text-xs text-white/70">
              Flat monthly pricing — <strong>never per-lead or per-admission</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* ── VALUE PROPS ──────────────────────────────────────── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-6 sm:grid-cols-3">
            {VALUE_PROPS.map(([title, body], i) => (
              <Reveal key={title} delay={i * 120}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="font-semibold text-slate-800">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────── */}
      <section className="bg-[#eef5f2] py-16">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="text-center">
            <h2 className="text-3xl font-semibold text-slate-800">Simple, flat pricing</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              Flat subscriptions support the in-app analytics and lead-status workflow described below; they are not
              tied to referrals or admissions.
            </p>
          </Reveal>

          <div className="mt-10 grid items-start gap-6 lg:grid-cols-3">
            {TIERS.map((t, i) => (
              <Reveal key={t.name} delay={i * 100}>
                <div
                  className={
                    'flex h-full flex-col rounded-2xl border bg-white p-6 ' +
                    (t.featured ? 'border-teal-600 shadow-lg ring-1 ring-teal-600' : 'border-slate-200')
                  }
                >
                  {t.featured && (
                    <span className="mb-3 inline-block w-fit rounded-full bg-teal-700 px-2.5 py-0.5 text-xs font-medium text-white">
                      Includes lead-status workflow
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-slate-800">{t.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t.blurb}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold text-slate-900">{t.price}</span>
                    <span className="text-xs text-slate-500">{t.cadence}</span>
                  </div>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-600">
                    {t.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={t.cta.href}
                    className={
                      'mt-6 rounded-md px-4 py-2.5 text-center text-sm font-medium transition ' +
                      (t.featured
                        ? 'bg-teal-700 text-white hover:bg-teal-800'
                        : 'border border-teal-700 text-teal-700 hover:bg-teal-700 hover:text-white')
                    }
                  >
                    {t.cta.label}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-slate-400">
            Programs are responsible for accurate licensing, accreditation, and service information; Clear Bed shows
            source and verification status so users know what has and has not been confirmed. Pricing is flat and
            decoupled from referral volume or outcomes. Payment never changes need-based matching.
          </p>
        </div>
      </section>

      {/* ── CLOSING CTA ──────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden py-20">
        <div className="absolute inset-0 -z-10 bg-brand/90" />
        <Reveal className="mx-auto max-w-3xl px-6 text-center text-white">
          <h2 className="text-3xl font-semibold">Make current program information easier to find</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            Claim your facility in a few minutes. We verify your authority to manage the listing before granting a
            login. Claiming and completing the public profile is free; paid plans add operational tools.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/claim"
              className="inline-block rounded-md bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
            >
              Claim your facility for free →
            </Link>
            <Link
              href="/login"
              className="inline-block rounded-md border border-white/40 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
            >
              Provider login
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
    <SiteFooter />
    </>
  );
}
