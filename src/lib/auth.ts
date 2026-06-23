import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/** Returns the logged-in user or redirects to /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * True when the current user is a platform admin.
 * Relies on RLS: a non-admin selecting platform_admins gets zero rows.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return !!data;
}

/** Returns the user if admin, otherwise redirects. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!(await isAdmin())) redirect('/login?error=not_authorized');
  return user;
}

export type Roles = {
  user: { id: string; email?: string } | null;
  isAdmin: boolean;
  facilityIds: string[];
  isPartner: boolean;
  isRep: boolean;
  isBd: boolean;
  isSeeker: boolean;
};

/**
 * Provider-side = a signed-in facility member or Partner (referrer) who is NOT a
 * Global Admin. These users work the directory to place people and never use the
 * seeker AI intake for themselves, so the consumer "Find care" / match entry points
 * are hidden from them. Global Admins (platform_admins) are intentionally excluded —
 * they can access everything.
 */
export function isProviderSide(r: Roles): boolean {
  return !!r.user && !r.isAdmin && (r.facilityIds.length > 0 || r.isPartner || r.isRep);
}

/** Resolve every role the current user holds in one pass (for nav + routing). */
export async function getRoles(): Promise<Roles> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      user: null,
      isAdmin: false,
      facilityIds: [],
      isPartner: false,
      isRep: false,
      isBd: false,
      isSeeker: false,
    };

  // Lanes tagged at account creation carry a role in user_metadata; no extra query.
  const metaRole = (user.user_metadata as { role?: string } | null)?.role;
  const isSeeker = metaRole === 'seeker';

  const [adminRes, memberRes, bdRes, repRes] = await Promise.all([
    supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('facility_members').select('facility_id').eq('user_id', user.id),
    supabase.from('bd_users').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('rep_profiles').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);

  // Partner (referrer) + Rep (facility-side) lanes: canonical membership is a row
  // (bd_users / rep_profiles); the metadata tag is a fast-path so routing works the
  // instant after signup (before the row read settles).
  const isPartner = !!bdRes.data || metaRole === 'partner';
  const isRep = !!repRes.data || metaRole === 'rep';
  return {
    user: { id: user.id, email: user.email },
    isAdmin: !!adminRes.data,
    facilityIds: (memberRes.data ?? []).map((m) => m.facility_id),
    isPartner,
    isRep,
    isBd: !!bdRes.data,
    isSeeker,
  };
}

/**
 * The single canonical profile a signed-in user belongs to. Every routing/nav
 * decision derives from this. Admin wins (global oversight); then facility
 * membership; then the Partner (referrer) lane; then the seeker tag. "Partner"
 * is the white-glove referral directory for people who place others into care
 * (discharge planners, coaches, clergy…) — a bd_users row is its membership.
 */
export type ProfileType = 'admin' | 'facility' | 'partner' | 'rep' | 'seeker' | 'none';

export function profileType(r: Roles): ProfileType {
  if (!r.user) return 'none';
  if (r.isAdmin) return 'admin';
  if (r.facilityIds.length > 0) return 'facility';
  if (r.isPartner) return 'partner';
  if (r.isRep) return 'rep';
  if (r.isSeeker) return 'seeker';
  return 'none';
}

/** Where this user's lane begins — used to route logins and bounce out-of-lane hits. */
export function homePathFor(r: Roles): string {
  switch (profileType(r)) {
    case 'admin':
      return '/admin';
    case 'facility':
      return r.facilityIds.length === 1 ? `/facility/${r.facilityIds[0]}` : '/facility';
    case 'partner':
      return '/partners';
    case 'rep':
      return '/rep';
    case 'seeker':
      return '/me';
    default:
      return '/get-started'; // no lane yet
  }
}

/**
 * Gate a route to seekers. A signed-in user in a different lane is sent to THEIR
 * home base (not shown an error) so nobody can cross profiles via a typed URL.
 */
export async function requireSeeker() {
  const roles = await getRoles();
  if (!roles.user) redirect('/login');
  if (profileType(roles) !== 'seeker') redirect(homePathFor(roles));
  return roles.user;
}

/** Gate a route to facility members (admins manage via /admin, not here). */
export async function requireFacilityMember(): Promise<{ userId: string; facilityIds: string[] }> {
  const roles = await getRoles();
  if (!roles.user) redirect('/login');
  // Out-of-lane (seeker/admin/none) → their own home base, never another profile's page.
  if (roles.facilityIds.length === 0) redirect(homePathFor(roles));
  return { userId: roles.user.id, facilityIds: roles.facilityIds };
}

/**
 * Gate a route to Partners (referrers). A signed-in user in another lane is sent to
 * THEIR home base (not an error) so nobody can cross profiles via a typed URL.
 */
export async function requirePartner() {
  const roles = await getRoles();
  if (!roles.user) redirect('/login');
  if (profileType(roles) !== 'partner') redirect(homePathFor(roles));
  return roles.user;
}

/**
 * Gate a route to Reps (facility-side professionals). Out-of-lane users go to
 * their own home base. NOTE: a Rep affiliation is display-only — it never grants
 * facility management; that still requires a verified director claim.
 */
export async function requireRep() {
  const roles = await getRoles();
  if (!roles.user) redirect('/login');
  if (profileType(roles) !== 'rep') redirect(homePathFor(roles));
  return roles.user;
}
