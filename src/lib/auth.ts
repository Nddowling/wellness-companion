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
  isBd: boolean;
};

/** Resolve every role the current user holds in one pass (for nav + routing). */
export async function getRoles(): Promise<Roles> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false, facilityIds: [], isBd: false };

  const [adminRes, memberRes, bdRes] = await Promise.all([
    supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('facility_members').select('facility_id').eq('user_id', user.id),
    supabase.from('bd_users').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);

  return {
    user: { id: user.id, email: user.email },
    isAdmin: !!adminRes.data,
    facilityIds: (memberRes.data ?? []).map((m) => m.facility_id),
    isBd: !!bdRes.data,
  };
}

/** Gate a route to facility members (admins manage via /admin, not here). */
export async function requireFacilityMember(): Promise<{ userId: string; facilityIds: string[] }> {
  const { user, facilityIds } = await getRoles();
  if (!user) redirect('/login');
  if (facilityIds.length === 0) redirect('/login?error=no_facility_access');
  return { userId: user.id, facilityIds };
}
