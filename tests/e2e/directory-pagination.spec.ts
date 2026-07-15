import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

test('SEO-DATA-1 · high-volume directory hubs paginate beyond PostgREST max_rows', () => {
  const helper = source('src/lib/supabase/public-pagination.ts');
  expect(helper).toContain('const PAGE_SIZE = 1_000');
  expect(helper).toContain('page(from, from + PAGE_SIZE - 1)');
  expect(helper).toContain('if (batch.length < PAGE_SIZE) return rows');

  for (const file of [
    'src/app/(public)/treatment/[state]/page.tsx',
    'src/app/(public)/treatment/[state]/[seg]/page.tsx',
    'src/app/(public)/treatment/[state]/[seg]/[level]/page.tsx',
    'src/app/(public)/insurance/[payer]/page.tsx',
    'src/app/(public)/insurance/[payer]/[state]/page.tsx',
  ]) {
    const loader = source(file);
    expect(loader, file).toContain('collectPublicRows(');
    expect(loader, file).toContain('.range(from, to)');
  }

  const stateHub = source('src/app/(public)/treatment/[state]/page.tsx');
  const payerHub = source('src/app/(public)/insurance/[payer]/page.tsx');
  const payerStateHub = source('src/app/(public)/insurance/[payer]/[state]/page.tsx');
  expect(stateHub).toContain('rows.slice(0, DIRECTORY_PREVIEW_LIMIT)');
  expect(payerStateHub).toContain('r.rows.slice(0, DIRECTORY_PREVIEW_LIMIT)');
  expect(payerHub).toContain("supabase.rpc('facilities_facet_counts'");
  expect(payerHub).toContain('export function generateStaticParams()');
});

test('ADMIN-DATA-1 · dashboard totals use exact counts and bounded capacity pagination', () => {
  const metrics = source('src/lib/metrics.ts');

  expect(metrics).toContain("{ count: 'exact', head: true }");
  expect(metrics).toContain("collectPublicRows('admin open residential capacity'");
  expect(metrics).toContain(".eq('facilities.is_published', true)");
  expect(metrics).toContain("console.error('[admin-metrics] query failed'");
  expect(metrics).not.toContain('facs.data ?? []');
});
