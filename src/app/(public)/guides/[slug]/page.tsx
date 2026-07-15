import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import JsonLd from '@/components/JsonLd';
import { GUIDES, getGuide } from '@/lib/guides';
import { absoluteUrl, SITE_NAME, SITE_URL } from '@/lib/seo';

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return { title: 'Guide not found', robots: { index: false, follow: true } };
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guides/${g.slug}` },
    openGraph: {
      type: 'article',
      title: `${g.title} | ${SITE_NAME}`,
      description: g.description,
      url: absoluteUrl(`/guides/${g.slug}`),
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: g.title,
      description: g.description,
      datePublished: g.updated,
      dateModified: g.updated,
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      publisher: { '@id': `${SITE_URL}/#organization` },
      mainEntityOfPage: absoluteUrl(`/guides/${g.slug}`),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Guides', item: absoluteUrl('/guides') },
        { '@type': 'ListItem', position: 2, name: g.title, item: absoluteUrl(`/guides/${g.slug}`) },
      ],
    },
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <nav className="text-xs text-slate-500">
        <Link href="/guides" className="text-teal-700 hover:underline">
          Guides
        </Link>{' '}
        / <span>{g.title}</span>
      </nav>

      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">{g.title}</h1>
      <p className="mt-3 text-lg leading-relaxed text-slate-600">{g.dek}</p>
      <p className="mt-2 text-xs text-slate-400">{g.readMinutes} min read</p>

      <article className="mt-6 space-y-7">
        {g.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold text-ink">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2 text-[15px] leading-relaxed text-slate-700">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>

      <div className="mt-9 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>In an emergency, call 911.</strong> In crisis or having thoughts of suicide, call or text{' '}
        <strong>988</strong> (Suicide &amp; Crisis Lifeline), or call SAMHSA&apos;s free 24/7 helpline at{' '}
        <strong>1-800-662-4357</strong>.
      </div>

      <div className="mt-6 rounded-xl bg-mist p-5 text-center">
        <p className="text-sm text-ink">Compare programs with source and availability freshness cues.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <Link
            href="/match"
            className="rounded-md bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark"
          >
            Get matched →
          </Link>
          <Link
            href="/treatment"
            className="rounded-md border border-teal-700 px-5 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-700 hover:text-white"
          >
            Browse by state
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">More guides</h2>
        <div className="mt-2 space-y-1">
          {GUIDES.filter((o) => o.slug !== g.slug).map((o) => (
            <Link key={o.slug} href={`/guides/${o.slug}`} className="block text-sm text-teal-700 hover:underline">
              {o.title}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
