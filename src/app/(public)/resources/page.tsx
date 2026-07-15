import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/JsonLd';
import SiteFooter from '@/components/SiteFooter';
import { SITE_NAME, absoluteUrl, breadcrumbJsonLd } from '@/lib/seo';

const TITLE = 'Recovery Books & Tools — Resources for Recovery and Families';
const DESCRIPTION =
  'A curated shelf of books, journals, and tools that genuinely help in recovery and for the families around it — for those in treatment, those supporting them, and those rebuilding after.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/resources' },
  openGraph: { title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION, url: absoluteUrl('/resources') },
};

type Item = { title: string; note: string; query: string };
type Section = { heading: string; blurb: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    heading: 'Recovery & sobriety books',
    blurb: 'The titles people in recovery come back to.',
    items: [
      { title: 'This Naked Mind', note: 'Reframing the relationship with alcohol.', query: 'This Naked Mind Annie Grace' },
      { title: 'The Recovery Book', note: 'A practical, full-journey guide.', query: 'The Recovery Book' },
      { title: 'Codependent No More', note: 'Melody Beattie — a recovery classic.', query: 'Codependent No More Melody Beattie' },
      { title: 'Recovery: Freedom From Our Addictions', note: 'A modern take on the steps.', query: 'Recovery Freedom From Our Addictions Russell Brand' },
    ],
  },
  {
    heading: 'For families & loved ones',
    blurb: 'For the parent, spouse, or sibling carrying this with them.',
    items: [
      { title: 'Beautiful Boy', note: 'A father’s story of a son’s addiction.', query: 'Beautiful Boy David Sheff' },
      { title: 'Get Your Loved One Sober', note: 'The CRAFT approach, without confrontation.', query: 'Get Your Loved One Sober' },
      { title: 'Everything Changes', note: 'Help for families of someone in recovery.', query: 'Everything Changes help for families recovery' },
      { title: 'Books for families of addicts', note: 'Browse the wider shelf.', query: 'family addiction recovery book' },
    ],
  },
  {
    heading: 'Journals & workbooks',
    blurb: 'Daily structure helps recovery stick.',
    items: [
      { title: 'Sobriety journals', note: 'Track days, triggers, and wins.', query: 'sobriety journal' },
      { title: 'Recovery workbooks', note: 'Guided exercises and reflection.', query: 'addiction recovery workbook' },
      { title: 'Daily reflections', note: 'A page a day for early recovery.', query: 'daily reflections recovery meditation book' },
      { title: 'Gratitude journals', note: 'A simple daily reflection practice.', query: 'gratitude journal' },
    ],
  },
  {
    heading: 'Milestone gifts',
    blurb: 'Mark the days that matter.',
    items: [
      { title: 'Sobriety anniversary gifts', note: 'Celebrate a milestone.', query: 'sobriety anniversary gift' },
      { title: 'Sober milestone coins', note: 'The classic recovery token.', query: 'sobriety milestone coin' },
    ],
  },
  {
    heading: 'Calm & self-care',
    blurb: 'Tools that help with the hard early days — no medical claims, just comfort.',
    items: [
      { title: 'Weighted blankets', note: 'A comfort item some people choose.', query: 'weighted blanket' },
      { title: 'Meditation & breathing tools', note: 'Support a daily practice.', query: 'meditation cushion set' },
    ],
  },
];

export default function ResourcesPage() {
  const schema = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Recovery books & tools', path: '/resources' },
  ]);

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <JsonLd data={schema} />
        <nav className="text-xs text-slate-500">
          <Link href="/" className="text-teal-700 hover:underline">
            Home
          </Link>{' '}
          / <span>Recovery books &amp; tools</span>
        </nav>

        <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">Recovery books &amp; tools</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          A small, honest shelf of resources that help — in treatment, supporting someone you love, or rebuilding after.
          These are editorial suggestions, not paid placements or medical recommendations. Look for them through a
          library, local bookseller, or retailer you trust.
        </p>

        <div className="mt-8 space-y-9">
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="font-serif text-xl text-ink">{s.heading}</h2>
              <p className="mt-1 text-sm text-slate-500">{s.blurb}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {s.items.map((it) => (
                  <div key={it.title} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="font-medium text-slate-800">{it.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{it.note}</div>
                    <div className="mt-2 text-xs text-slate-400">Search title: {it.query}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Editorial and health-information disclosure. */}
        <p className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
          {SITE_NAME} does not earn a commission from these suggestions. Inclusion is not an endorsement of an author,
          seller, or treatment approach. {SITE_NAME} is a directory, not a treatment provider, and nothing here is
          medical advice. In a crisis, call or text 988.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
