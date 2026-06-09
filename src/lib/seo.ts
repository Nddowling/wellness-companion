// Centralized SEO config + schema.org JSON-LD builders. Single source of truth
// for brand, canonical host, and structured data used across metadata, the
// sitemap, robots, and per-page <JsonLd>.

export const SITE_NAME = 'Clear Bed Recovery';

// Canonical host. www → apex 308-redirects, so the apex is canonical. Hardcoded
// (not from env) because NEXT_PUBLIC_SITE_URL points at the *.vercel.app preview
// host, which must never appear in canonical/OG tags.
export const SITE_URL = 'https://clearbedrecovery.com';

export const DEFAULT_TITLE =
  'Clear Bed Recovery — Find Addiction Treatment That Fits';

export const DEFAULT_DESCRIPTION =
  'Clear Bed Recovery helps you find addiction treatment — including programs for co-occurring mental-health needs — that fits your situation, insurance, and region, with real-time bed availability. We connect you to treatment facilities; we don’t provide treatment ourselves. Free, private, and no account required to start.';

export const SEO_KEYWORDS = [
  'addiction treatment',
  'rehab directory',
  'drug and alcohol rehab',
  'mental health treatment',
  'detox centers',
  'residential treatment',
  'partial hospitalization program',
  'intensive outpatient program',
  'IOP',
  'PHP',
  'substance abuse treatment',
  'find rehab near me',
  'treatment bed availability',
  'dual diagnosis treatment',
];

export const DEFAULT_OG_IMAGE = {
  url: '/images/hero.jpg',
  width: 1200,
  height: 630,
  alt: 'Clear Bed Recovery — a warm front door to treatment',
};

/** Resolve a path to an absolute URL on the canonical host. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, SITE_URL).toString();
}

/**
 * schema.org Organization for the brand (site-wide). Intentionally a plain
 * Organization, NOT MedicalOrganization — Clear Bed Recovery is a referral
 * directory that connects people to treatment facilities; it does not provide
 * medical care, so it must not declare medical specialties.
 */
export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  alternateName: 'ClearBed',
  url: SITE_URL,
  logo: absoluteUrl('/images/hero.jpg'),
  image: absoluteUrl(DEFAULT_OG_IMAGE.url),
  description: DEFAULT_DESCRIPTION,
  slogan: 'The live directory behind every good referral.',
  areaServed: { '@type': 'Country', name: 'United States' },
  // Topical-authority signal (March-2026 core update rewards focused expertise).
  knowsAbout: [
    'Addiction treatment',
    'Substance use disorder',
    'Medication-assisted treatment (MAT)',
    'Medical detox',
    'Residential rehab',
    'Partial hospitalization (PHP)',
    'Intensive outpatient (IOP)',
    'Outpatient treatment',
    'Co-occurring disorders',
    'Insurance coverage for rehab',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'hello@clearbedrecovery.com',
    areaServed: 'US',
    availableLanguage: ['English'],
  },
  // NOTE: add real verified social profiles here (LinkedIn, Instagram, X) — Google
  // treats sameAs as an entity-trust signal. Leaving empty rather than guessing.
} as const;

/** schema.org WebSite with a sitelinks search box pointed at the directory. */
export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/programs?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
} as const;

/** BreadcrumbList from an ordered list of {name, path} crumbs. */
export function breadcrumbJsonLd(crumbs: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/**
 * ItemList of facilities for a directory/landing page. Helps search + AI engines
 * read the page as a structured list of programs (and is one of the strongest
 * signals for AI-citation per 2026 research).
 */
export function facilityItemListJsonLd(
  items: { id: string; name: string; city?: string | null; state?: string | null }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.slice(0, 50).map((f, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/programs/${f.id}`),
      name: [f.name, [f.city, f.state].filter(Boolean).join(', ')].filter(Boolean).join(' — '),
    })),
  };
}

/** FAQPage from question/answer pairs. (Rich results deprecated May 2026, but the
 *  markup still aids parsing + AI answer engines.) */
export function faqJsonLd(qa: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}
