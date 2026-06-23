// Data helpers for the Reps lane (facility-side professional profiles).
//
//  • Rep-owned rows (own profile, own affiliations/invites) → cookie client (RLS).
//  • Public reads (a profile by slug, a facility's verified team) → service client,
//    same as the rest of the public directory.
//  • Reps may attach to UNPUBLISHED facilities (that's the whole seeding point), so
//    affiliation/team facility lookups must NOT filter on is_published.
import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'rep'
  );
}

export type RepProfile = {
  user_id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  location: string | null;
  specialties: string[];
  is_public: boolean;
};

export async function getRepProfile(userId: string): Promise<RepProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('rep_profiles').select('*').eq('user_id', userId).maybeSingle();
  return (data as RepProfile) ?? null;
}

/** A public profile by slug (service client; only is_public profiles are shown). */
export async function getRepBySlug(slug: string): Promise<RepProfile | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('rep_profiles')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle();
  return (data as RepProfile) ?? null;
}

export type FacilityLite = { id: string; name: string; city: string | null; state: string | null };

/** Facility names by id (no is_published filter — reps attach to unclaimed listings). */
export async function getFacilityNames(ids: string[]): Promise<Map<string, FacilityLite>> {
  if (!ids.length) return new Map();
  const admin = createAdminClient();
  const { data } = await admin.from('facilities').select('id, name, city, state').in('id', ids);
  return new Map((data ?? []).map((f) => [f.id, f as FacilityLite]));
}

export type Affiliation = {
  id: string;
  facility_id: string;
  title: string | null;
  status: string;
  facility: FacilityLite | null;
};

export async function getMyAffiliations(userId: string): Promise<Affiliation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('facility_affiliations')
    .select('id, facility_id, title, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  const rows = data ?? [];
  const names = await getFacilityNames(rows.map((r) => r.facility_id));
  return rows.map((r) => ({
    id: r.id,
    facility_id: r.facility_id,
    title: r.title,
    status: r.status,
    facility: names.get(r.facility_id) ?? null,
  }));
}

export type TeamMember = {
  user_id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  photo_url: string | null;
  title: string | null;
};

/** Verified, public team members for a facility's PUBLIC listing (service client). */
export async function getVerifiedTeam(facilityId: string): Promise<TeamMember[]> {
  const admin = createAdminClient();
  const { data: affs } = await admin
    .from('facility_affiliations')
    .select('user_id, title')
    .eq('facility_id', facilityId)
    .eq('status', 'verified');
  const rows = affs ?? [];
  if (!rows.length) return [];
  const { data: profiles } = await admin
    .from('rep_profiles')
    .select('user_id, slug, display_name, headline, photo_url, is_public')
    .in(
      'user_id',
      rows.map((r) => r.user_id),
    )
    .eq('is_public', true);
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return rows
    .map((r): TeamMember | null => {
      const p = byId.get(r.user_id);
      if (!p) return null;
      return {
        user_id: p.user_id,
        slug: p.slug,
        display_name: p.display_name,
        headline: p.headline,
        photo_url: p.photo_url,
        title: r.title,
      };
    })
    .filter((x): x is TeamMember => x !== null);
}

export type PendingMember = {
  affiliation_id: string;
  display_name: string;
  slug: string;
  headline: string | null;
  title: string | null;
};

/** Pending affiliations for a facility — director review (page is access-gated). */
export async function getPendingTeam(facilityId: string): Promise<PendingMember[]> {
  const admin = createAdminClient();
  const { data: affs } = await admin
    .from('facility_affiliations')
    .select('id, user_id, title')
    .eq('facility_id', facilityId)
    .eq('status', 'pending');
  const rows = affs ?? [];
  if (!rows.length) return [];
  const { data: profiles } = await admin
    .from('rep_profiles')
    .select('user_id, slug, display_name, headline')
    .in(
      'user_id',
      rows.map((r) => r.user_id),
    );
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return rows.map((r) => {
    const p = byId.get(r.user_id);
    return {
      affiliation_id: r.id,
      display_name: p?.display_name ?? 'A colleague',
      slug: p?.slug ?? '',
      headline: p?.headline ?? null,
      title: r.title,
    };
  });
}

export type ManagedMember = {
  affiliation_id: string;
  display_name: string;
  slug: string;
  headline: string | null;
  title: string | null;
  status: string;
};

/** All non-rejected affiliations for a facility (director management view). */
export async function getFacilityTeamManage(facilityId: string): Promise<ManagedMember[]> {
  const admin = createAdminClient();
  const { data: affs } = await admin
    .from('facility_affiliations')
    .select('id, user_id, title, status, created_at')
    .eq('facility_id', facilityId)
    .neq('status', 'rejected')
    .order('created_at');
  const rows = affs ?? [];
  if (!rows.length) return [];
  const { data: profiles } = await admin
    .from('rep_profiles')
    .select('user_id, slug, display_name, headline')
    .in(
      'user_id',
      rows.map((r) => r.user_id),
    );
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return rows.map((r) => {
    const p = byId.get(r.user_id);
    return {
      affiliation_id: r.id,
      display_name: p?.display_name ?? 'A colleague',
      slug: p?.slug ?? '',
      headline: p?.headline ?? null,
      title: r.title,
      status: r.status,
    };
  });
}

export type RepInvite = { token: string; facility_id: string | null; facility: FacilityLite | null; created_at: string };

export async function getMyInvites(userId: string): Promise<RepInvite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('rep_invites')
    .select('token, facility_id, created_at')
    .eq('inviter_id', userId)
    .order('created_at', { ascending: false });
  const rows = data ?? [];
  const names = await getFacilityNames(rows.map((r) => r.facility_id).filter((x): x is string => !!x));
  return rows.map((r) => ({
    token: r.token,
    facility_id: r.facility_id,
    facility: r.facility_id ? names.get(r.facility_id) ?? null : null,
    created_at: r.created_at,
  }));
}

/** A rep's verified facilities — for their PUBLIC profile (service client). */
export async function getRepVerifiedFacilities(
  userId: string,
): Promise<{ facility: FacilityLite; title: string | null }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('facility_affiliations')
    .select('facility_id, title')
    .eq('user_id', userId)
    .eq('status', 'verified');
  const rows = data ?? [];
  const names = await getFacilityNames(rows.map((r) => r.facility_id));
  return rows
    .map((r) => ({ facility: names.get(r.facility_id), title: r.title }))
    .filter((x): x is { facility: FacilityLite; title: string | null } => !!x.facility);
}

/** Read an invite by token (service client — the invitee can't read rep_invites). */
export async function getInvite(token: string) {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from('rep_invites')
    .select('token, inviter_id, facility_id')
    .eq('token', token)
    .maybeSingle();
  if (!invite) return null;
  let facility: FacilityLite | null = null;
  let inviterName: string | null = null;
  if (invite.facility_id) {
    const names = await getFacilityNames([invite.facility_id]);
    facility = names.get(invite.facility_id) ?? null;
  }
  const { data: inviter } = await admin
    .from('rep_profiles')
    .select('display_name')
    .eq('user_id', invite.inviter_id)
    .maybeSingle();
  inviterName = inviter?.display_name ?? null;
  return { token: invite.token, inviterId: invite.inviter_id, facility, inviterName };
}
