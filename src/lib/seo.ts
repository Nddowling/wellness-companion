// Centralized SEO config + schema.org JSON-LD builders. Single source of truth
// for brand, canonical host, and structured data used across metadata, the
// sitemap, robots, and per-page <JsonLd>.

import { stateSlug, slugify } from '@/lib/geo';

export const SITE_NAME = 'Clear Bed Recovery';

// Canonical host. www → apex 308-redirects, so the apex is canonical. Hardcoded
// (not from env) because NEXT_PUBLIC_SITE_URL points at the *.vercel.app preview
// host, which must never appear in canonical/OG tags.
export const SITE_URL = 'https://clearbedrecovery.com';

export const DEFAULT_TITLE =
  'Clear Bed Recovery — Find Addiction Treatment That Fits';

export const DEFAULT_DESCRIPTION =
  'Clear Bed Recovery helps you browse addiction treatment — including programs for co-occurring mental-health needs — by level of care, payment type, region, and dated availability reports. We connect you to facilities; we don’t provide treatment. Free and no account required to start.';

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
  // A crawlable, square brand mark (not the editorial hero photograph).
  logo: absoluteUrl('/icon-512.png'),
  image: absoluteUrl(DEFAULT_OG_IMAGE.url),
  description: DEFAULT_DESCRIPTION,
  // Public NAP for a hidden-address service-area business: Name + phone + service
  // area. No PostalAddress (the street stays private / GBP-verification only).
  telephone: '+1-904-548-8047',
  email: 'hello@clearbedrecovery.com',
  areaServed: { '@type': 'Country', name: 'United States' },
  // Subjects the organization actually covers across its public directory and guides.
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
    telephone: '+1-904-548-8047',
    email: 'hello@clearbedrecovery.com',
    areaServed: 'US',
    availableLanguage: ['English'],
  },
  // NOTE: add real verified social profiles here (LinkedIn, Instagram, X) — Google
  // treats sameAs as an entity-trust signal. Leaving empty rather than guessing.
} as const;

/** schema.org WebSite identity. Public search avoids raw free-text query URLs. */
export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
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

/** ItemList matching the visible facilities on a directory/landing page. */
export function facilityItemListJsonLd(
  items: { id: string; name: string; slug?: string | null; city?: string | null; state?: string | null }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.slice(0, 50).map((f, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      // Emit the canonical slug URL directly (not the UUID URL, which only 301s) so
      // structured data matches the page's canonical and doesn't dilute the signal.
      url:
        f.slug && f.city && f.state
          ? absoluteUrl(`/treatment/${stateSlug(f.state.toUpperCase())}/${slugify(f.city)}/${f.slug}`)
          : absoluteUrl(`/programs/${f.id}`),
      name: [f.name, [f.city, f.state].filter(Boolean).join(', ')].filter(Boolean).join(' — '),
    })),
  };
}

/** FAQPage matching question/answer pairs that are also visible on the page. */
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
