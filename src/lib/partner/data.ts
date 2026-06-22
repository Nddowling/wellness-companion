// Data helpers for the Partners (referrer) lane.
//
// Two access paths, on purpose:
//  • Partner-owned rows (saved, history, lists, profile) → the cookie-bound
//    createClient(), so RLS scopes every read to the signed-in partner.
//  • Facility directory rows → createAdminClient() (published only), same as the
//    public /programs directory. Partners browse the whole open directory.
import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { LEVEL_LABELS, PAYER_LABELS, type CapacityRow, type LevelOfCare, type PayerType } from '@/lib/constants';

export type FacilitySummary = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  main_phone: string | null;
  intake_line: string | null;
  levels_of_care: string[];
  carriers_named: string[];
  facility_payers: { payer_type: string }[];
  facility_capacity: CapacityRow[];
};

const SUMMARY_SELECT =
  'id, name, city, state, main_phone, intake_line, levels_of_care, carriers_named, facility_payers(payer_type), facility_capacity(level_of_care, beds_available, last_updated)';

/** Published facility summaries for a set of ids, in the order the ids were given. */
export async function getFacilitySummaries(ids: string[]): Promise<FacilitySummary[]> {
  if (!ids.length) return [];
  const admin = createAdminClient();
  const { data } = await admin.from('facilities').select(SUMMARY_SELECT).in('id', ids).eq('is_published', true);
  const rows = (data ?? []) as FacilitySummary[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is FacilitySummary => !!r);
}

// ── display helpers (shared across every partner view) ───────────────────────

export function cityState(f: { city: string | null; state: string | null }): string {
  return [f.city, f.state].filter(Boolean).join(', ') || 'Location on file';
}

export function levelsLabel(levels: string[] | null | undefined): string {
  const ls = (levels ?? []).map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l);
  return ls.join(', ') || 'Programs vary';
}

export function acceptedSummary(f: {
  facility_payers?: { payer_type: string }[];
  carriers_named?: string[];
}): string {
  const gov = (f.facility_payers ?? [])
    .filter((p) => p.payer_type !== 'commercial')
    .map((p) => PAYER_LABELS[p.payer_type as PayerType] ?? p.payer_type);
  const all = [...gov, ...(f.carriers_named ?? [])];
  if (!all.length) return 'Call to verify coverage';
  return all.slice(0, 4).join(' · ') + (all.length > 4 ? ` +${all.length - 4} more` : '');
}

/** The facility's OWN direct line — the core trust signal we never route or broker. */
export function directPhone(f: { main_phone: string | null; intake_line: string | null }): string | null {
  return f.intake_line || f.main_phone || null;
}

// ── partner-owned reads (RLS-scoped to the signed-in partner) ────────────────

export type PartnerProfile = {
  user_id: string;
  employer: string | null;
  phone: string | null;
  partner_type: string | null;
  title: string | null;
};

export async function getPartnerProfile(userId: string): Promise<PartnerProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('bd_users')
    .select('user_id, employer, phone, partner_type, title')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

export async function getSavedFacilityIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('bd_saved_facilities')
    .select('facility_id, created_at')
    .order('created_at', { ascending: false });
  return (data ?? []).map((r) => r.facility_id);
}

export async function getRecentlyViewedIds(limit = 12): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('partner_view_history')
    .select('facility_id, viewed_at')
    .order('viewed_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => r.facility_id);
}

export type PartnerListRow = {
  id: string;
  title: string;
  intro: string | null;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
};

export async function getPartnerLists(): Promise<PartnerListRow[]> {
  const supabase = await createClient();
  const { data: lists } = await supabase
    .from('partner_lists')
    .select('id, title, intro, share_token, created_at, updated_at')
    .order('updated_at', { ascending: false });
  const rows = lists ?? [];
  const ids = rows.map((l) => l.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: items } = await supabase.from('partner_list_items').select('list_id').in('list_id', ids);
    for (const it of items ?? []) counts[it.list_id] = (counts[it.list_id] ?? 0) + 1;
  }
  return rows.map((l) => ({ ...l, item_count: counts[l.id] ?? 0 }));
}

export type ListItemWithFacility = { note: string | null; position: number; facility: FacilitySummary };

async function joinItems(
  items: { facility_id: string; note: string | null; position: number }[],
): Promise<ListItemWithFacility[]> {
  const facilities = await getFacilitySummaries(items.map((i) => i.facility_id));
  const byId = new Map(facilities.map((f) => [f.id, f]));
  return items
    .map((i) => ({ note: i.note, position: i.position, facility: byId.get(i.facility_id) }))
    .filter((x): x is ListItemWithFacility => !!x.facility);
}

/** A list the signed-in partner owns, with its facilities resolved (RLS-scoped). */
export async function getListDetail(listId: string) {
  const supabase = await createClient();
  const { data: list } = await supabase.from('partner_lists').select('*').eq('id', listId).maybeSingle();
  if (!list) return null;
  const { data: items } = await supabase
    .from('partner_list_items')
    .select('facility_id, note, position')
    .eq('list_id', listId)
    .order('position');
  return { list, items: await joinItems(items ?? []) };
}

/** A publicly-shared list by token — read with the service client (visitor is anon). */
export async function getSharedList(token: string) {
  const admin = createAdminClient();
  const { data: list } = await admin
    .from('partner_lists')
    .select('id, title, intro, share_token')
    .eq('share_token', token)
    .maybeSingle();
  if (!list) return null;
  const { data: items } = await admin
    .from('partner_list_items')
    .select('facility_id, note, position')
    .eq('list_id', list.id)
    .order('position');
  return { list, items: await joinItems(items ?? []) };
}
