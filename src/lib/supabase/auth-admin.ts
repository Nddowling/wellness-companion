import 'server-only';

import { SITE_URL } from '@/lib/seo';
import { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Find an auth user without silently stopping at Supabase's first users page. */
export async function findAuthUserIdByEmail(admin: AdminClient, email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error('Could not check the invited account.');
    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) return match.id;
    if (users.length < perPage) return null;
  }
  throw new Error('Could not safely search all invited accounts.');
}

/**
 * Build a single-use recovery capability for a newly provisioned account. The
 * raw generated password is never shown, emailed, logged, or placed in a URL.
 */
export async function generateSetPasswordUrl(admin: AdminClient, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${SITE_URL}/reset` },
  });
  if (error) throw new Error('Could not create a secure set-password link.');
  const hashed = data?.properties?.hashed_token ?? null;
  const url = hashed
    ? `${SITE_URL}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=recovery&next=/reset`
    : (data?.properties?.action_link ?? null);
  if (!url) throw new Error('Could not create a secure set-password link.');
  return url;
}
