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
  'Clear Bed Recovery helps you find addiction treatment — including programs for co-occurring mental-health needs — that fits your situation, insurance, and region, with real-time bed availability. We connect you to treatment facilities; we don’t provide treatment ourselves. Free and private — sign in to save your conversations.';

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
  url: SITE_URL,
  logo: absoluteUrl('/images/hero.jpg'),
  image: absoluteUrl(DEFAULT_OG_IMAGE.url),
  description: DEFAULT_DESCRIPTION,
  areaServed: { '@type': 'Country', name: 'United States' },
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
