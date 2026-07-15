import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { serializeJsonLd } from '../../src/components/JsonLd';
import { safeInternalPath } from '../../src/lib/auth/safe-redirect';
import { safeHttpUrl } from '../../src/lib/http-url';
import {
  outboundFallbackPath,
  outboundRedirectDestination,
} from '../../src/lib/outbound-redirect';
import type { Database } from '../../src/types/database';

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

test('SEC-REDIRECT-1 · auth destinations cannot escape the Clear Bed origin', () => {
  for (const hostile of [
    '//evil.example',
    '/\\evil.example',
    '/%5Cevil.example',
    '/%255Cevil.example',
    '/%2Fevil.example',
    '/%0A//evil.example',
    'https://evil.example',
  ]) {
    expect(safeInternalPath(hostile, null), hostile).toBeNull();
  }

  expect(safeInternalPath('/pricing?plan=growth&cycle=monthly', null)).toBe(
    '/pricing?plan=growth&cycle=monthly',
  );
  expect(safeInternalPath('/home#token-like-fragment', null)).toBe('/home');

  expect(source('src/app/auth/callback/route.ts')).toContain('safeInternalPath(');
  expect(source('src/app/login/page.tsx')).toContain('safeInternalPath(');
});

test('SEC-XSS-1 · provider text cannot break out of a JSON-LD script', () => {
  const payload = serializeJsonLd({
    name: '</script><script>alert(document.domain)</script>',
    description: 'A&B\u2028next',
  });

  expect(payload).not.toContain('</script>');
  expect(payload).not.toContain('<script>');
  expect(payload).not.toContain('\u2028');
  expect(payload).toContain('\\u003c/script\\u003e');
  expect(payload).toContain('A\\u0026B\\u2028next');

  const profile = source('src/components/facility/FacilityProfileView.tsx');
  const directory = source('src/app/(public)/programs/page.tsx');
  expect(profile).not.toMatch(/__html:\s*JSON\.stringify/);
  expect(directory).not.toMatch(/__html:\s*JSON\.stringify/);
});

test('SEC-URL-1 · outbound program URLs are limited to absolute HTTP(S)', () => {
  expect(safeHttpUrl('https://example.org/admissions')).toBe('https://example.org/admissions');
  expect(safeHttpUrl('http://example.org')).toBe('http://example.org/');
  expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
  expect(safeHttpUrl('data:text/html,hello')).toBeNull();
  expect(safeHttpUrl('https://user:pass@example.org')).toBeNull();
  expect(safeHttpUrl('not a URL')).toBeNull();

  const goRoute = source('src/app/go/[id]/route.ts');
  const outboundHelper = source('src/lib/outbound-redirect.ts');
  expect(goRoute).toContain('outboundRedirectDestination(createAdminClient(), id)');
  expect(outboundHelper).toContain('safeHttpUrl(facility?.website)');
});

test('SEC-PRIVACY-1 · outbound analytics never retain raw Referer URLs', async () => {
  const facilityId = '00000000-0000-4000-8000-000000000001';
  const clickId = '00000000-0000-4000-8000-000000000002';
  const requests: Array<{ path: string; body: unknown }> = [];
  const fetchStub: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    requests.push({
      path,
      body: request.method === 'POST' ? JSON.parse(await request.text()) : null,
    });

    if (path.endsWith('/facilities')) {
      return Response.json({ id: facilityId, website: 'https://provider.example/admissions?keep=1' });
    }
    if (path.endsWith('/outbound_clicks')) {
      return Response.json({ id: clickId }, { status: 201 });
    }
    return Response.json({ code: 'PGRST404', message: 'not found' }, { status: 404 });
  };
  const admin = createClient<Database>('https://supabase.invalid', 'test-service-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchStub },
  });

  const destination = await outboundRedirectDestination(admin, facilityId);
  expect(requests.find((request) => request.path.endsWith('/outbound_clicks'))?.body).toEqual({
    facility_id: facilityId,
    match_id: null,
    referrer: null,
  });
  expect(destination).toContain('https://provider.example/admissions?');
  expect(destination).toContain('keep=1');
  expect(destination).toContain('utm_source=clearbed');
  expect(destination).toContain(`cb_ref=${clickId}`);

  const route = source('src/app/go/[id]/route.ts');
  const helper = source('src/lib/outbound-redirect.ts');
  const migration = source(
    'supabase/project-a/migrations/42_redact_outbound_referrer_urls.sql',
  );
  expect(route).not.toMatch(/headers\.get\(['"]refere?r['"]\)/i);
  expect(helper).toContain('referrer: null');
  expect(helper).toContain('match_id: null');
  expect(migration).toContain('set match_id = null');
  expect(migration).toContain('set referrer = null');
  expect(migration).toContain('check (match_id is null)');
  expect(migration).toContain('check (referrer is null)');
  expect(migration).toContain('from public, anon, authenticated');
  expect(migration).toContain('grant select, insert on table public.outbound_clicks to service_role');
  expect(outboundFallbackPath('../../private?context=secret')).toBe('/programs');
});

test('SEC-PRIVACY-2 · legacy facility events cannot retain match or referrer fields', () => {
  const migration = source(
    'supabase/project-a/migrations/41_restore_facility_events_history.sql',
  );

  expect(migration).toContain('set match_id = null');
  expect(migration).toContain('referrer = null');
  expect(migration).toContain('check (match_id is null)');
  expect(migration).toContain('check (referrer is null)');
  expect(migration).toContain('grant select, insert on table public.facility_events to service_role');
  expect(migration).not.toContain('grant all privileges on table public.facility_events');
});

test('SEC-RELIABILITY-1 · analytics failures preserve redirects and log only safe codes', async () => {
  const facilityId = '00000000-0000-4000-8000-000000000003';
  const privateContext = 'member=secret&intake=private';
  const diagnostics: Array<{ event: string; value: unknown }> = [];
  let inserts = 0;
  const fetchStub: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/facilities')) {
      return Response.json({ id: facilityId, website: 'https://provider.example/start' });
    }
    if (path.endsWith('/outbound_clicks')) {
      inserts += 1;
      return Response.json(
        {
          code: '42501',
          message: `must not be logged: ${privateContext}`,
          details: `must not be logged: https://clearbedrecovery.com/match?${privateContext}`,
        },
        { status: 403 },
      );
    }
    return Response.json({ code: 'PGRST404', message: 'not found' }, { status: 404 });
  };
  const admin = createClient<Database>('https://supabase.invalid', 'test-service-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchStub },
  });

  const destination = await outboundRedirectDestination(admin, facilityId, (event, value) => {
    diagnostics.push({ event, value });
  });
  expect(inserts).toBe(1);
  expect(destination).toBe(
    'https://provider.example/start?utm_source=clearbed&utm_medium=referral&utm_campaign=program_profile',
  );
  expect(diagnostics).toEqual([
    { event: '[outbound-click] insert failed', value: { code: '42501' } },
  ]);
  expect(JSON.stringify(diagnostics)).not.toContain(privateContext);

  const failedLookup = createClient<Database>('https://supabase.invalid', 'test-service-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: async () =>
        Response.json(
          { code: 'PGRST301', message: `must not be logged: ${privateContext}` },
          { status: 403 },
        ),
    },
  });
  diagnostics.length = 0;
  expect(await outboundRedirectDestination(failedLookup, facilityId, (event, value) => {
    diagnostics.push({ event, value });
  })).toBe(`/programs/${facilityId}`);
  expect(diagnostics).toEqual([
    { event: '[outbound-click] facility lookup failed', value: { code: 'PGRST301' } },
  ]);
  expect(JSON.stringify(diagnostics)).not.toContain(privateContext);
});

test('SEC-ABUSE-1 · retired AI and anonymous writes do not retain raw identifiers', () => {
  const guard = source('src/lib/security/anonymous-guard.ts');
  const intakeRoute = source('src/app/api/intake/route.ts');
  const matchRoute = source('src/app/api/match/route.ts');
  const handoffRoute = source('src/app/api/handoff/route.ts');
  const migration = source(
    'supabase/project-a/migrations/40_protect_anonymous_workflows.sql',
  );

  expect(guard).toContain("request.headers.get('x-vercel-forwarded-for')");
  expect(guard).toContain("keyedSecurityDigest('anonymous-ip'");
  expect(guard).not.toMatch(/console\.(?:log|error)\([^\n]*(?:address|sessionToken|p_ip_key)/);
  expect(intakeRoute).toContain('status: 410');
  expect(intakeRoute).not.toMatch(/@anthropic-ai|streamText|messages\s*:/);
  expect(matchRoute).toContain("consumeAnonymousBudget(request, 'match')");
  expect(handoffRoute).toContain("consumeAnonymousBudget(request, 'handoff')");
  expect(migration).toContain('alter table public.api_rate_limits enable row level security');
  expect(migration).toContain('alter table public.match_request_keys enable row level security');
  expect(migration).toContain('to service_role');
  expect(migration).toContain('pg_advisory_xact_lock');
  expect(migration).toContain('facility.is_published');
  expect(migration).toContain("p_endpoint = 'handoff'");
  expect(migration).not.toMatch(/(?:ip_address|raw_ip|contact|payer_carrier)\s+(?:text|jsonb)/);
});

test('SEC-HANDOFF-1 · connector replay is recipient-bound and legacy email state remains truthful', () => {
  const route = source('src/app/api/handoff/route.ts');
  const token = source('src/lib/matching/handoff-token.ts');
  const matchPage = source('src/app/(public)/match/page.tsx');
  const emailSender = source('src/lib/email/send.ts');
  const envExample = source('.env.example');
  const migration = source(
    'supabase/project-a/migrations/37_atomic_connector_handoff.sql',
  );

  expect(route).toContain('readBoundedJson(request, MAX_BODY_BYTES)');
  expect(route).not.toMatch(/\.from\(['"]match_routes['"]\)/);
  expect(route).toContain('recipientFacilityIds: facilities.map');
  expect(route).toContain('contactSaved');
  expect(route).toContain('sendSensitiveEmail');
  expect(route).toContain('sensitiveEmailConfigured()');
  expect(route).toContain('emailCopyAvailable: sensitiveEmailConfigured()');
  expect(route).toContain("consents.email && !sensitiveEmailConfigured()");
  expect(route).not.toMatch(/\bsendEmail\(/);
  expect(matchPage).toContain("fetch('/api/handoff', { cache: 'no-store' })");
  expect(matchPage).toContain('...(emailCopyAvailable');
  expect(token).toContain('recipientFacilityIds: [...recipientFacilityIds]');
  expect(migration).toContain('p_recipient_facility_ids uuid[]');
  expect(migration).toContain('from unnest(v_recipient_ids)');
  expect(migration).toContain("set delivery_status = 'legacy_unknown'");
  expect(migration).toContain("set delivery_status = 'legacy_duplicate'");
  expect(migration).not.toContain("set delivery_status = 'sent'\nwhere delivery_status is null");
  expect(migration).toContain("else 'recipient_mismatch'::text");

  const sensitiveStart = emailSender.indexOf('export function sensitiveEmailConfigured');
  const genericStart = emailSender.indexOf('export async function sendEmail', sensitiveStart + 1);
  const sensitiveSender = emailSender.slice(sensitiveStart, genericStart);
  expect(sensitiveStart).toBeGreaterThanOrEqual(0);
  expect(genericStart).toBeGreaterThan(sensitiveStart);
  expect(sensitiveSender).toContain("process.env.SENSITIVE_EMAIL_BAA_APPROVED === 'true'");
  expect(sensitiveSender).toContain('smtpTransport().sendMail');
  expect(sensitiveSender).not.toContain('RESEND_API_KEY');
  expect(envExample).toContain('SENSITIVE_EMAIL_BAA_APPROVED=false');
});

test('SEC-QA-1 · write-capable tests require explicit isolated-environment opt-in', () => {
  const helpers = source('tests/e2e/helpers.ts');
  const config = source('playwright.config.ts');

  expect(helpers).toContain("process.env.QA_ALLOW_WRITES !== '1'");
  expect(config).toContain('reuseExistingServer: false');
  expect(config).toContain("'http://localhost:3100'");
});
