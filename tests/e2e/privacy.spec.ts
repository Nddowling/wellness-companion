import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { previewOnly } from './helpers';
import type { Database } from '../../src/types/database';

loadEnvConfig(process.cwd());

test('PRIV-P0 · handoff stores nothing without consent and rejects prohibited fields', async ({ request }) => {
  previewOnly();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!url || !key, 'Service-role preview credentials are required for DB-effect assertions');
  const admin = createClient<Database>(url!, key!, { auth: { persistSession: false } });

  const matchRes = await request.post('/api/match', {
    headers: { 'idempotency-key': crypto.randomUUID() },
    data: {
      region_zip3: '787',
      care_level_needed: 'residential',
      payer_type: 'self_pay',
      concern_category: 'unsure',
    },
  });
  expect(matchRes.status()).toBe(200);
  const matchId = (await matchRes.json()).match_id as string;

  try {
    const { data: savedMatch } = await admin
      .from('matches')
      .select('coverage_status')
      .eq('id', matchId)
      .single();
    expect(savedMatch?.coverage_status).toBeNull();

    const declined = await request.post('/api/handoff', {
      data: {
        match_id: matchId,
        contact: {},
        consents: { share: false, email: false },
      },
    });
    expect(declined.status()).toBe(200);
    expect((await declined.json()).shared).toBe(false);

    const { count: declinedCount } = await admin
      .from('vault_seekers')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', matchId);
    expect(declinedCount).toBe(0);

    const { data: declinedEvents } = await admin
      .from('vault_consent_events')
      .select('channel, granted, seeker_id')
      .eq('match_id', matchId);
    expect(declinedEvents).toEqual(
      expect.arrayContaining([
        { channel: 'share', granted: false, seeker_id: null },
        { channel: 'email', granted: false, seeker_id: null },
      ]),
    );

    const prohibited = await request.post('/api/handoff', {
      data: {
        match_id: matchId,
        contact: { phone: '+1 555 010 9911' },
        consents: { share: true, email: false },
        face_sheet: { date_of_birth: '1980-01-01', member_id: 'DO-NOT-STORE', narrative: 'private' },
      },
    });
    expect(prohibited.status()).toBe(400);

    const { count: prohibitedCount } = await admin
      .from('vault_seekers')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', matchId);
    expect(prohibitedCount).toBe(0);
  } finally {
    await admin.from('vault_consent_events').delete().eq('match_id', matchId);
    await admin.from('vault_seekers').delete().eq('match_id', matchId);
    await admin.from('matches').delete().eq('id', matchId);
  }
});

test('PRIV-P0 · consented handoff stores only one contact method and server-routed interests', async ({ request }) => {
  previewOnly();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!url || !key, 'Service-role preview credentials are required for DB-effect assertions');
  const admin = createClient<Database>(url!, key!, { auth: { persistSession: false } });

  const matchRes = await request.post('/api/match', {
    headers: { 'idempotency-key': crypto.randomUUID() },
    data: {
      region_zip3: '787',
      care_level_needed: 'residential',
      payer_type: 'self_pay',
      concern_category: 'unsure',
    },
  });
  expect(matchRes.status()).toBe(200);
  const matchId = (await matchRes.json()).match_id as string;

  try {
    const shared = await request.post('/api/handoff', {
      data: {
        match_id: matchId,
        contact: { phone: '+1 555 010 9922' },
        consents: { share: true, email: false },
      },
    });
    expect(shared.status()).toBe(200);
    expect((await shared.json()).shared).toBe(true);

    const { data: seekers } = await admin
      .from('vault_seekers')
      .select('id, email, phone, coverage_status, consent_share, consent_email')
      .eq('match_id', matchId);
    expect(seekers).toHaveLength(1);
    expect(seekers?.[0]).toMatchObject({
      email: null,
      phone: '+1 555 010 9922',
      coverage_status: null,
      consent_share: true,
      consent_email: false,
    });

    const seekerId = seekers![0].id;
    const [{ data: interests }, { data: routes }] = await Promise.all([
      admin.from('vault_seeker_interest').select('facility_id').eq('seeker_id', seekerId),
      admin.from('match_routes').select('facility_id').eq('match_id', matchId),
    ]);
    expect((interests ?? []).map((row) => row.facility_id).sort()).toEqual(
      (routes ?? []).map((row) => row.facility_id).sort(),
    );

    // A browser retry updates the same match-scoped lead instead of duplicating it.
    const retried = await request.post('/api/handoff', {
      data: {
        match_id: matchId,
        contact: { phone: '+1 555 010 9922' },
        consents: { share: true, email: false },
      },
    });
    expect(retried.status()).toBe(200);
    const { count: retryCount } = await admin
      .from('vault_seekers')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', matchId);
    expect(retryCount).toBe(1);
  } finally {
    await admin.from('vault_consent_events').delete().eq('match_id', matchId);
    await admin.from('vault_seekers').delete().eq('match_id', matchId);
    await admin.from('matches').delete().eq('id', matchId);
  }
});
