import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import SiteFooter from '@/components/SiteFooter';
import { Logo } from '@/components/Logo';
import { createClient } from '@/lib/supabase/server';
import { SITE_NAME, absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';
import { LIBRARY, LIBRARY_CATEGORIES, libraryFileUrl } from '@/lib/library';

const TITLE = 'Free Recovery Resource Library';
const DESCRIPTION =
  'Free, beautifully made digital guides for recovery and the families around it — like a modern pamphlet shelf. Create a free account to download.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/library' },
  openGraph: { title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, url: absoluteUrl('/library') },
};

const LOGIN_HREF = '/login?role=seeker&next=/library';

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = !!user;

  const schema = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Free resource library', path: '/library' },
  ]);

  const total = LIBRARY.length;

  return (
    <>
      <main className="text-slate-800">
        <JsonLd data={schema} />

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-20 bg-gradient-to-br from-ink via-brand to-teal-900" />
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(60% 55% at 80% 10%, rgba(93,202,165,0.22), transparent 70%), radial-gradient(55% 55% at 6% 95%, rgba(212,149,106,0.26), transparent 72%)',
            }}
          />
          <div className="mx-auto max-w-5xl px-6 py-7">
            <Link href="/" aria-label="Clear Bed Recovery — home">
              <Logo tone="light" className="text-lg" />
            </Link>
          </div>
          <div className="mx-auto max-w-3xl px-6 pb-20 pt-4 text-white">
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide backdrop-blur">
              Free · {total} resources and growing
            </span>
            <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">The free recovery library.</h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">
              Honest, beautifully made guides for the person getting help and the family beside them — a modern take on
              the pamphlet shelf. Created with care, grounded in hope.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {signedIn ? (
                <span className="rounded-md bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur">
                  You’re signed in — download anything below ↓
                </span>
              ) : (
                <Link
                  href={LOGIN_HREF}
                  className="inline-block rounded-md bg-terracotta px-6 py-3 text-base font-semibold text-white shadow-lg shadow-terracotta/30 transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
                >
                  Create a free account to download →
                </Link>
              )}
              {!signedIn && (
                <span className="text-xs text-white/75">Just your name, email &amp; a password. No cost, ever.</span>
              )}
            </div>
          </div>
          <svg className="absolute bottom-0 left-0 w-full text-[#eef5f2]" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden>
            <path fill="currentColor" d="M0,40 C320,90 720,0 1440,48 L1440,80 L0,80 Z" />
          </svg>
        </section>

        {/* ── CATALOG ──────────────────────────────────────────── */}
        <section className="bg-[#eef5f2] py-14">
          <div className="mx-auto max-w-5xl px-6">
            {!signedIn && (
              <div className="mb-10 rounded-2xl border border-teal-200 bg-white p-5 text-center shadow-sm sm:p-6">
                <p className="font-serif text-xl text-ink">A free account unlocks every download.</p>
                <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
                  We keep an account so you can save what helps and pick up where you left off — your information stays
                  private and is never sold.
                </p>
                <Link
                  href={LOGIN_HREF}
                  className="mt-4 inline-block rounded-md bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  Create your free account →
                </Link>
              </div>
            )}

            <div className="space-y-12">
              {LIBRARY_CATEGORIES.map((cat) => {
                const items = LIBRARY.filter((r) => r.category === cat);
                if (items.length === 0) return null;
                return (
                  <section key={cat}>
                    <h2 className="font-serif text-2xl text-ink">{cat}</h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((r) => {
                        const fileUrl = libraryFileUrl(r);
                        const comingSoon = !fileUrl;
                        return (
                          <div
                            key={r.slug}
                            className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md"
                          >
                            <div className="text-xs font-medium uppercase tracking-wide text-teal-700">{r.format}</div>
                            <h3 className="mt-1 font-serif text-lg leading-snug text-ink">{r.title}</h3>
                            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{r.description}</p>

                            <div className="mt-4">
                              {comingSoon ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-400">
                                  Coming soon
                                </span>
                              ) : signedIn ? (
                                <a
                                  href={fileUrl}
                                  download
                                  className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                                >
                                  ↓ Download
                                </a>
                              ) : (
                                <Link
                                  href={LOGIN_HREF}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
                                >
                                  🔒 Unlock free
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Safety + connector disclosure — consistent with the rest of the site. */}
            <p className="mt-12 rounded-lg border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500">
              {SITE_NAME} is a resource directory and navigator — not a treatment provider, and nothing here is medical
              advice. These guides are offered free to help. In an emergency call <strong>911</strong>; in crisis, call or
              text <strong>988</strong>, or the Georgia Crisis &amp; Access Line at 1-800-715-4225.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
