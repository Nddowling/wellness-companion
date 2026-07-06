import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import Reveal from '@/components/Reveal';
import { Logo } from '@/components/Logo';
import { getRoles, isProviderSide } from '@/lib/auth';
import SiteFooter from '@/components/SiteFooter';
import { FindTreatmentSearch } from '@/components/search/FindTreatmentSearch';

export const metadata: Metadata = {
  // Home inherits the layout's default (brand) title + OG; just pin the canonical.
  alternates: { canonical: '/' },
};

export default async function LandingPage() {
  // Provider-side users (facility/BD, not Global Admin) see no seeker AI/match CTA.
  const roles = await getRoles();
  const providerSide = isProviderSide(roles);
  const authed = !!roles.user;
  return (
    <>
    <main className="text-slate-800">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[88vh] flex-col overflow-hidden">
        {/* Brand gradient — the palette, without the literal photo */}
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-ink via-brand to-teal-900" />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 55% at 78% 12%, rgba(93,202,165,0.22), transparent 70%), radial-gradient(55% 55% at 8% 92%, rgba(212,149,106,0.26), transparent 72%)',
          }}
        />

        {/* Top bar — logo + an above-the-fold entry for providers, kept clear of the patient flow */}
        <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5 pr-6 sm:pr-20">
          <Logo tone="light" className="text-lg" />
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {!authed && (
              <Link
                href="/login"
                className="rounded-full px-3 py-2 text-sm font-medium text-white/90 underline-offset-2 transition hover:-translate-y-0.5 hover:text-white hover:underline"
              >
                Log in
              </Link>
            )}
            <Link
              href="/for-providers"
              className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
            >
              Clear Bed for providers →
            </Link>
          </div>
        </div>

        {/* Patient hero — the dominant message */}
        <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-6 pb-24 pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.92fr)] lg:gap-12 lg:pt-0">
          <div className="max-w-2xl animate-fade-up text-white">
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide backdrop-blur">
              Connecting you to treatment that fits
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              You don&apos;t have to figure this out alone.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/90">
              A warm, judgment-free guide that listens for a few key things and connects you with treatment that
              actually fits — your situation, your coverage, your needs. Free and private — no account required to start.
            </p>
            <div className="mt-7">
              {/* The homepage is the public front door, so the treatment search shows for
                  EVERYONE (incl. signed-in providers/admins) — they just also get a
                  dashboard shortcut. Previously the search was hidden from provider-side
                  sessions, which looked like "the old page came back" when logged in. */}
              <div className="max-w-2xl">
                <FindTreatmentSearch />
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  {providerSide ? (
                    <Link
                      href="/home"
                      className="rounded-full bg-terracotta px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
                    >
                      Go to your dashboard →
                    </Link>
                  ) : (
                    <>
                      <span className="text-xs text-white/70">Free · Private · No account required</span>
                      <Link
                        href="/library"
                        className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
                      >
                        📚 Free recovery library →
                      </Link>
                    </>
                  )}
                  <Link href="/for-providers" className="text-sm font-medium text-white/90 underline-offset-2 hover:text-white hover:underline">
                    I run a treatment program →
                  </Link>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-white/70">
              In an emergency call <strong>911</strong>. In crisis, call or text <strong>988</strong> — anytime.
            </p>
          </div>

          <div className="relative mt-1 animate-fade-up lg:mt-0">
            <div className="absolute -inset-5 rounded-[2rem] bg-sage/15 blur-2xl" aria-hidden />
            <div className="relative h-64 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-2xl shadow-ink/35 sm:h-80 lg:h-[min(36rem,64vh)] lg:min-h-[27rem]">
              <Image
                src="/images/recovery-support-hero.png"
                alt="A welcoming peer support group listening as one person shares"
                fill
                preload
                sizes="(max-width: 1023px) 100vw, 46vw"
                className="object-cover object-center"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent lg:bg-gradient-to-r lg:from-brand/25 lg:via-transparent lg:to-transparent"
                aria-hidden
              />
              <div className="absolute bottom-4 left-4 rounded-full border border-white/25 bg-ink/55 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-md">
                Support starts with being heard.
              </div>
            </div>
          </div>
        </div>

        {/* soft wave divider into the next section */}
        <svg className="absolute bottom-0 left-0 w-full text-[#eef5f2]" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden>
          <path fill="currentColor" d="M0,40 C320,90 720,0 1440,48 L1440,80 L0,80 Z" />
        </svg>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="bg-[#eef5f2] py-16">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="text-center">
            <h2 className="text-2xl font-semibold text-slate-800">Finding care, made gentle</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              Three simple steps. Share as much or as little as you like.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                title: 'Talk it through',
                body: 'A calm conversation — no forms, no judgment. We listen for what matters.',
                icon: (
                  <path d="M4 5h16v10H7l-3 3V5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                ),
              },
              {
                title: 'Get matched',
                body: 'We find programs that fit your level of care, coverage, and region — with live bed availability.',
                icon: (
                  <path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                ),
              },
              {
                title: 'Reach out',
                body: 'Connect with their intake team — or let us share your details so they can reach you.',
                icon: (
                  <path d="M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                ),
              },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 120}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-md">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      {s.icon}
                    </svg>
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-800">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY / TRUST ──────────────────────────────────────── */}
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 sm:grid-cols-2">
          <Reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/calm.jpg" alt="A calm path through the trees" className="h-72 w-full rounded-2xl object-cover shadow-sm" />
          </Reveal>
          <Reveal delay={120}>
            <h2 className="text-2xl font-semibold text-slate-800">Help that meets you where you are</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {[
                ['Real-time bed availability', 'We surface programs with current openings, not stale listings.'],
                ['Insurance-aware', 'Matches consider your coverage and whether it&apos;s active right now.'],
                ['Private &amp; judgment-free', 'We only ask what we need, and we never store more than we must.'],
                ['Real photos &amp; reviews', 'See the place and hear from people who&apos;ve been there.'],
              ].map(([t, b]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sage" />
                  <span>
                    <strong className="text-slate-800" dangerouslySetInnerHTML={{ __html: t }} />{' '}
                    <span dangerouslySetInnerHTML={{ __html: b }} />
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── CTA BAND (seeker-only) ───────────────────────────── */}
      {!providerSide && (
      <section className="relative isolate overflow-hidden py-20">
        <div className="absolute inset-0 -z-20 bg-cover bg-center" style={{ backgroundImage: "url('/images/sunrise.jpg')" }} />
        <div className="absolute inset-0 -z-10 bg-brand/80" />
        <Reveal className="mx-auto max-w-3xl px-6 text-center text-white">
          <h2 className="text-3xl font-semibold">Ready when you are</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            Reaching out is the bravest first step — and the only one you have to take right now.
          </p>
          <Link
            href="/match"
            className="mt-6 inline-block rounded-md bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
          >
            Find care that fits →
          </Link>
        </Reveal>
      </section>
      )}

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-ink py-10 text-sm text-white/80">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-wrap justify-between gap-6">
            <div>
              <Logo tone="light" className="text-lg" />
              <p className="mt-1 max-w-xs text-xs text-white/60">
                A resource navigator — not a medical or crisis service. We connect you with treatment programs and
                the counselors who work there.
              </p>
            </div>
            <div className="flex flex-wrap gap-10 text-xs">
              <div className="space-y-1">
                <div className="font-medium text-white/90">Find care</div>
                {!providerSide && (
                  <Link href="/match" className="block text-white/70 hover:text-white">Find care that fits</Link>
                )}
                <Link href="/programs" className="block text-white/70 hover:text-white">Browse programs</Link>
              </div>
              <div className="space-y-1">
                <div className="font-medium text-white/90">For treatment providers</div>
                <Link href="/for-providers" className="block text-white/70 hover:text-white">List your facility</Link>
                <Link href="/login" className="block text-white/70 hover:text-white">Provider sign in</Link>
              </div>
              <div className="space-y-1">
                <div className="font-medium text-white/90">Crisis</div>
                <a href="tel:911" className="block text-white/70 hover:text-white">Emergency — 911</a>
                <a href="tel:988" className="block text-white/70 hover:text-white">Crisis — 988</a>
                <a href="tel:18006624357" className="block text-white/70 hover:text-white">SAMHSA — 1-800-662-4357</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
    <SiteFooter />
    </>
  );
}
