import type { Metadata } from 'next';
import Link from 'next/link';

import Reveal from '@/components/Reveal';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'For Providers — List Your Program & Reach Patients Who Fit',
  description:
    'Clear Bed Recovery connects treatment programs and referrers with patients who actually fit — by level of care, coverage, and region, with live bed availability. Flat monthly pricing, never per-lead.',
  alternates: { canonical: '/for-providers' },
  openGraph: {
    title: 'For Providers — List Your Program on Clear Bed Recovery',
    description:
      'Reach patients who fit your program — by level of care, coverage, and region. Flat monthly pricing, never per-lead.',
    url: absoluteUrl('/for-providers'),
  },
};

const VALUE_PROPS: [string, string][] = [
  [
    'Reach patients who actually fit',
    'We match on level of care, coverage, and region — so the people who reach you are ones you can genuinely help, not noise.',
  ],
  [
    'Your live bed availability, front and center',
    'Keep openings current and we surface you first. Freshness is the moat — stale directories lose to programs that show real openings.',
  ],
  [
    'Own your profile',
    'Photos, specialties, accepted insurance, reviews, and a direct intake line — a profile that reflects your program, not a scraped listing.',
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
    blurb: 'Outpatient, OTP & smaller programs.',
    features: [
      'Claimed profile + photos',
      'Bed board listing & live availability',
      'Payer-matched applications',
      'Basic referral tracking',
      'Reviews',
    ],
    cta: { label: 'Start Starter', href: '/pricing' },
  },
  {
    name: 'Growth',
    price: '$999',
    cadence: 'per facility / month',
    blurb: 'Mid-size residential & PHP.',
    features: [
      'Everything in Starter',
      '2 referrer (BD) seats',
      'Attribution tracking',
      'Follow-up workflow',
      'Priority placement in matches',
    ],
    cta: { label: 'Start Growth', href: '/pricing' },
    featured: true,
  },
  {
    name: 'Anchor',
    price: '$1,999',
    cadence: 'per facility / month',
    blurb: 'Multi-bed residential & hospital systems.',
    features: [
      'Everything in Growth',
      'Unlimited referrer seats',
      'Dedicated onboarding',
      'Census analytics dashboard',
      'White-glove intake training',
    ],
    cta: { label: 'Start Anchor', href: '/pricing' },
  },
];

export default function ForProvidersPage() {
  return (
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
              Get found by the patients you can actually help.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/90">
              Clear Bed Recovery is a connector — we route people to treatment by level of care, coverage, and
              region, and we put programs with real openings first. You keep your beds and profile current; we
              bring you the right referrals.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/claim"
                className="rounded-md bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
              >
                Claim your facility →
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
              Priced as a placement channel, not software. One admission is worth $20k–$50k to you — your
              subscription is a rounding error. Founding programs get 50% off their first year.
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
                      Most popular
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
            Listed programs must be licensed and LegitScript-certified. Pricing is flat and decoupled from referral
            volume or outcomes by design. Featured placement is a fixed fee, clearly labeled as advertising.
          </p>
        </div>
      </section>

      {/* ── REFERRAL PROGRAM ─────────────────────────────────── */}
      <section className="bg-white py-12">
        <Reveal className="mx-auto max-w-3xl px-6">
          <div className="rounded-2xl border border-terracotta/40 bg-terracotta/10 p-6 text-center sm:p-8">
            <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-dark">
              Refer &amp; earn — free months
            </span>
            <h2 className="mt-2 text-2xl font-semibold text-slate-800">
              Two paid facility sign-ups = a free month
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
              Know other programs that belong here? For every paid facility you refer, you get{' '}
              <strong>50% off your next month</strong> — so just two paid referrals add up to a{' '}
              <strong>free month of service</strong> — up to <strong>3 free months</strong> (6 paid referrals).
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── CLOSING CTA ──────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden py-20">
        <div className="absolute inset-0 -z-10 bg-brand/90" />
        <Reveal className="mx-auto max-w-3xl px-6 text-center text-white">
          <h2 className="text-3xl font-semibold">Put your openings in front of the right people</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            Claim your facility in a few minutes. We verify every program; once you&apos;re approved you&apos;ll
            get a login. Start free — upgrade when you&apos;re ready.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/claim"
              className="inline-block rounded-md bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
            >
              Claim your facility →
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
  );
}
