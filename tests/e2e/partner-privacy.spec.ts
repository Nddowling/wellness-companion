import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  generateShareToken,
  isValidShareToken,
  newShortlistIdentity,
  shortlistDisplayTitle,
} from '../../src/lib/partner/shortlist-privacy';

const root = process.cwd();
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PARTNER-PRIVACY-1 · shortlist labels and share tokens are system generated', () => {
  expect(
    shortlistDisplayTitle('00000001-0000-4000-8000-000000000000', '2026-07-15T18:30:00.000Z'),
  ).toBe('Treatment program shortlist #00000001 - 2026-07-15');

  const identity = newShortlistIdentity(new Date('2026-07-15T18:30:00.000Z'));
  expect(identity.title).toBe(shortlistDisplayTitle(identity.id, identity.created_at));
  expect(identity.title).toMatch(/^Treatment program shortlist #[0-9]{8} - 2026-07-15$/);

  const tokens = Array.from({ length: 64 }, generateShareToken);
  expect(new Set(tokens).size).toBe(tokens.length);
  for (const token of tokens) {
    expect(isValidShareToken(token)).toBe(true);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  }
  expect(isValidShareToken('0123456789abcdef')).toBe(false);
});

test('PARTNER-PRIVACY-2 · shortlist UI and DTOs never load or render legacy free text', () => {
  const actions = source('src/app/(app)/partners/actions.ts');
  const shortlistActions = actions.split('// ── shortlists')[1] ?? '';
  const listIndex = source('src/app/(app)/partners/lists/page.tsx');
  const listDetail = source('src/app/(app)/partners/lists/[id]/page.tsx');
  const shared = source('src/app/share/[token]/page.tsx');
  const menu = source('src/components/partner/AddToListMenu.tsx');
  const data = source('src/lib/partner/data.ts');
  const shortlistData = data.split('export async function getPartnerLists')[1] ?? '';

  expect(shortlistActions).not.toMatch(/formData\.get\(['"](?:title|intro|note)['"]\)/);
  expect(actions).not.toMatch(/renameListAction|updateItemNoteAction/);
  for (const ui of [listIndex, listDetail, menu]) {
    expect(ui).not.toMatch(/name=["'](?:title|intro|note)["']/);
  }
  expect(listDetail).not.toMatch(/list\.intro|\{\s*note\s*\}|defaultValue=\{note/);
  expect(shared).not.toMatch(/list\.intro|\{\s*note\s*\}|defaultValue=\{note/);
  expect(shortlistData).not.toContain("select('*')");
  expect(shortlistData).not.toMatch(/\.select\(['"][^'"]*\b(?:title|intro|note)\b/);
  expect(shortlistData).toContain('shortlistDisplayTitle(row.id, row.created_at)');
  expect(shared).toContain('Anyone with this link can view and print');
  expect(shared).toContain("referrer: 'no-referrer'");
});

test('PARTNER-PRIVACY-3 · DB migration scrubs text, rotates links, and preserves RLS', () => {
  const migration = source('supabase/project-a/migrations/33_minimize_partner_shortlist_data.sql');

  expect(migration).toContain('create trigger trg_partner_lists_privacy');
  expect(migration).toContain('create trigger trg_partner_list_items_privacy');
  expect(migration).toContain('new.title := format(');
  expect(migration).toContain('new.intro := null;');
  expect(migration).toContain('new.note := null;');
  expect(migration).toContain('update public.partner_lists');
  expect(migration).toContain('update public.partner_list_items');
  expect(migration).toContain("extensions.gen_random_bytes(32)");
  expect(migration).toContain('partner_lists_share_token_strength_check');
  expect(migration).toContain('alter table public.partner_lists enable row level security');
  expect(migration).toContain('alter table public.partner_list_items enable row level security');
  expect(migration).not.toMatch(/drop\s+policy/i);
});

test('PARTNER-PRIVACY-4 · partner program lookup keeps typed text out of URLs and history', () => {
  const home = source('src/app/(app)/partners/page.tsx');
  const search = source('src/app/(app)/partners/search/page.tsx');
  const lookup = source('src/components/partner/ProgramLookup.tsx');
  const combobox = source('src/components/search/useProgramCombobox.ts');

  expect(home).toContain('<ProgramLookup />');
  expect(home).not.toMatch(/name=["']q["']|action=["']\/partners\/search["']/);
  expect(search).not.toMatch(/name=["']q["']|\.set\(['"]q['"]|name\.ilike|city\.ilike/);
  expect(search).toContain('if (q !== undefined || hasNonCanonicalFacet)');
  expect(combobox).toContain("fetch('/api/facilities/search', {");
  expect(combobox).toContain("method: 'POST'");
  expect(combobox).toContain('body: JSON.stringify({ q })');
  expect(lookup).toContain('router.push(`/partners/facility/${hit.id}`)');
  expect(lookup).not.toMatch(/URLSearchParams|[?&]q=/);
});

test('PARTNER-AUTH-1 · every partner mutation is role-gated and referral writes compensate safely', () => {
  const actions = source('src/app/(app)/partners/actions.ts');
  const exportedActions = [...actions.matchAll(/export async function ([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  const roleChecks = actions.match(/await requirePartner\(\)/g) ?? [];

  expect(exportedActions).toEqual([
    'updatePartnerProfileAction',
    'submitReferralAction',
    'toggleSaveAction',
    'recordViewAction',
    'createListAction',
    'deleteListAction',
    'addToListAction',
    'removeFromListAction',
    'toggleShareAction',
  ]);
  expect(roleChecks).toHaveLength(exportedActions.length);
  expect(actions).not.toMatch(/async function uid\b|auth\.getUser\(\)/);

  const publishedHelperStart = actions.indexOf('async function publishedFacilityId');
  const firstActionStart = actions.indexOf('export async function');
  const publishedHelper = actions.slice(publishedHelperStart, firstActionStart);
  expect(publishedHelper).toContain('if (!UUID_PATTERN.test(facilityId)) return null;');
  expect(publishedHelper).toContain(".eq('is_published', true)");

  const facilityWriteActions = [
    'submitReferralAction',
    'toggleSaveAction',
    'recordViewAction',
    'createListAction',
    'addToListAction',
  ];
  for (const [index, actionName] of facilityWriteActions.entries()) {
    const start = actions.indexOf(`export async function ${actionName}`);
    const nextName = facilityWriteActions[index + 1];
    const nextExport = nextName ? actions.indexOf(`export async function ${nextName}`, start + 1) : actions.length;
    const body = actions.slice(start, nextExport);
    expect(body).toContain('publishedFacilityId(');
  }
  expect(actions).toContain('if (seedRaw && !facility_id) return;');
  expect(actions).toContain('if (routeError) {');
  expect(actions).toContain(".from('matches')\n      .delete()");
  expect(actions).toContain(".eq('bd_user_id', partner.id)");
  expect(actions).toContain("throw new Error('Referral could not be recorded safely')");
});

test('PARTNER-TRUTH-1 · partner surfaces avoid payment, outcome, and clinical-fit overclaims', () => {
  const facility = source('src/app/(app)/partners/facility/[id]/page.tsx');
  const row = source('src/components/partner/FacilityRow.tsx');
  const detail = source('src/app/(app)/partners/lists/[id]/page.tsx');
  const shared = source('src/app/share/[token]/page.tsx');
  const home = source('src/app/(app)/partners/page.tsx');
  const referrals = source('src/app/(app)/partners/referrals/page.tsx');
  const marketing = source('src/app/(public)/for-partners/page.tsx');
  const combined = [facility, row, detail, shared, home, referrals, marketing].join('\n');

  for (const paymentSurface of [facility, row, detail, shared, marketing]) {
    expect(paymentSurface).toContain('Program-listed payment options');
  }
  expect(combined).not.toMatch(
    /Accepts:|Insurance accepted|Reached care|Everyone you&apos;ve referred into care|find the right program|every good referral/i,
  );
  expect(combined).toMatch(/network status|network, benefits/);
  expect(combined).toMatch(/does not confirm admission|do not guarantee network status/);
  expect(combined).toMatch(/clinical suitability/);
  expect(referrals).toContain("accepted: 'Marked accepted'");
  expect(referrals).not.toContain('{fac.routeStatus}');
});
