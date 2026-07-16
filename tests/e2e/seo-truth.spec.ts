import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import robots from '../../src/app/robots';
import { organizationJsonLd, SITE_URL } from '../../src/lib/seo';

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

test('SEO-SITEMAP-1 · sitemap is complete-or-error and uses defensible modification dates', () => {
  const sitemap = source('src/app/sitemap.ts');

  expect(sitemap).toContain('for (let from = 0; ; from += PAGE)');
  expect(sitemap).not.toContain('from < 100000');
  expect(sitemap).toContain('.order("id", { ascending: true })');
  expect(sitemap).toContain('throw new Error("Sitemap facility query failed.")');
  expect(sitemap).toContain('refusing a partial sitemap');
  expect(sitemap).toContain('throw new Error("Sitemap URL limit exceeded.")');
  expect(sitemap).not.toContain('lastModified: now');
  expect(sitemap).toContain('sitemapDate(f.updated_at)');

  for (const route of [
    '/contact',
    '/for-partners',
    '/for-reps',
    '/insurance',
    '/library',
    '/pricing',
    '/privacy',
    '/terms',
  ]) {
    expect(sitemap, `${route} should be present in the canonical public sitemap`).toContain(
      `["${route}",`,
    );
  }
  expect(sitemap).toContain('...PAYERS.map((payer)');
});

test('SEO-ROBOTS-1 · private and tracking surfaces are excluded for every declared crawler', () => {
  const config = robots();
  expect(config.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  expect(config.host).toBe(SITE_URL);
  expect(Array.isArray(config.rules)).toBe(true);

  for (const rule of Array.isArray(config.rules) ? config.rules : [config.rules]) {
    const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    for (const route of ['/api/', '/auth/', '/facility', '/partners', '/go/', '/share/']) {
      expect(disallow, `${String(rule.userAgent)} should exclude ${route}`).toContain(route);
    }
  }
});

test('SEO-CANONICAL-1 · query variants and mixed-case dynamic paths do not create indexable duplicates', () => {
  const programs = source('src/app/(public)/programs/page.tsx');
  const claim = source('src/app/(public)/claim/page.tsx');
  const reps = source('src/app/(public)/for-reps/page.tsx');
  const state = source('src/app/(public)/treatment/[state]/page.tsx');
  const city = source('src/app/(public)/treatment/[state]/[seg]/page.tsx');
  const cityLevel = source('src/app/(public)/treatment/[state]/[seg]/[level]/page.tsx');
  const payer = source('src/app/(public)/insurance/[payer]/page.tsx');
  const payerState = source('src/app/(public)/insurance/[payer]/[state]/page.tsx');

  expect(programs).toContain("alternates: { canonical: '/programs' }");
  expect(programs).toContain('Object.keys(query).length > 0');
  expect(programs).toContain('robots: { index: false, follow: true, noarchive: true }');

  expect(claim).toContain("alternates: { canonical: '/claim' }");
  expect(claim).toContain('robots: { index: false, follow: true, noarchive: true }');

  expect(reps).toContain('export async function generateMetadata');
  expect(reps).toContain("referrer: 'no-referrer'");
  expect(reps).toContain('robots: { index: false, follow: false, noarchive: true }');

  for (const route of [state, city, cityLevel, payer, payerState]) {
    expect(route).toContain('permanentRedirect(');
  }
  expect(state).toContain('stateSlug(loaded.code)');
  expect(city).toContain('stateSlug(r.code)');
  expect(cityLevel).toContain('slugify(r.cityName)');
  expect(payer).toContain('payer !== p.slug');
  expect(payerState).toContain('payer !== r.p.slug || state !== canonicalState');
});

test('SEO-DATA-1 · public directory reads do not cache database failures as empty or missing pages', () => {
  const guardedRoutes = [
    'src/lib/facility/load.ts',
    'src/app/(public)/treatment/page.tsx',
    'src/app/(public)/treatment/[state]/page.tsx',
    'src/app/(public)/treatment/[state]/[seg]/page.tsx',
    'src/app/(public)/treatment/[state]/[seg]/[level]/page.tsx',
    'src/app/(public)/insurance/[payer]/page.tsx',
    'src/app/(public)/insurance/[payer]/[state]/page.tsx',
  ];

  for (const route of guardedRoutes) {
    const routeSource = source(route);
    expect(
      routeSource.includes('throwOnPublicReadError(') || routeSource.includes('collectPublicRows('),
      `${route} must distinguish an empty result from a read failure`,
    ).toBe(true);
  }

  const guard = source('src/lib/public-read-error.ts');
  const pagination = source('src/lib/supabase/public-pagination.ts');
  expect(pagination).toContain('throwOnPublicReadError(context, result.error)');
  expect(guard).toContain("code: error.code ?? 'unknown'");
  expect(guard).not.toMatch(/message|details|hint/);
  expect(guard).toContain("throw new Error('Public directory data is temporarily unavailable.')");
});

test('SEO-SCHEMA-1 · structured data is page-scoped and contains only representative media/facts', () => {
  expect(organizationJsonLd.logo).toBe(`${SITE_URL}/icon-512.png`);
  expect(organizationJsonLd).not.toHaveProperty('slogan');

  const rootLayout = source('src/app/layout.tsx');
  const home = source('src/app/(public)/page.tsx');
  const facility = source('src/components/facility/FacilityProfileView.tsx');

  expect(rootLayout).not.toContain('<JsonLd');
  expect(home).toContain('<JsonLd data={[organizationJsonLd, websiteJsonLd]} />');
  expect(facility).not.toContain("medicalSpecialty: 'Addiction'");
  expect(facility).toContain('...(images.length ? { image: images.slice(0, 3) } : {})');
  expect(facility).not.toContain("images.length ? images.slice(0, 3) : [absoluteUrl(DEFAULT_OG_IMAGE.url)]");
});

test('SEO-VERCEL-1 · retired outreach endpoint is not still scheduled in Vercel', () => {
  expect(JSON.parse(source('vercel.json'))).toEqual({});
  expect(source('src/app/api/cron/weekly-reminders/route.ts')).toContain('status: 410');
});
