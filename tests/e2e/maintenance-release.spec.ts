import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

test('RELEASE-MAINT-1 · deployment-scoped maintenance freezes pages, APIs, and server actions', () => {
  const proxy = fs.readFileSync(path.join(process.cwd(), 'src/proxy.ts'), 'utf8');

  expect(proxy).toContain("process.env.MAINTENANCE_MODE === '1'");
  expect(proxy).toContain('status: 503');
  expect(proxy).toContain("'Retry-After': '300'");
  expect(proxy).toContain("'Cache-Control': 'no-store, max-age=0'");
  expect(proxy).toContain("'X-Robots-Tag': 'noindex, nofollow, noarchive'");
  expect(proxy.indexOf("process.env.MAINTENANCE_MODE === '1'"))
    .toBeLessThan(proxy.indexOf('Legacy /programs/<uuid>'));
});
