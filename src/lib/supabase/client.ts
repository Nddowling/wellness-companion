import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database';

/**
 * Browser Supabase client for Project A ("Core" — NO PHI).
 * Used in client components. Subject to RLS as the logged-in user (or anon).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
