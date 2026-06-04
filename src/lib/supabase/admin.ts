import 'server-only';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/**
 * Service-role Supabase client for Project A ("Core" — NO PHI).
 *
 * BYPASSES RLS. Server-only — the `server-only` import makes any client bundle
 * that pulls this in fail the build.
 *
 * Used for trusted server operations that have no logged-in user, primarily:
 *  - creating de-identified `matches` + `match_routes` from anonymous seeker intake
 *  - admin maintenance tasks
 *
 * Never expose results that would leak cross-tenant data to a client.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
