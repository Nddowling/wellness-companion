import 'server-only';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/**
 * PROJECT B — "VAULT" (PHI). Server-only, service-role, RLS-bypassing.
 *
 * Holds seeker identity + the link to a de-identified match (the vault_* tables).
 * Storing PHI here is permitted ONLY with a signed BAA + HIPAA add-on + completed
 * security review + healthcare-attorney sign-off (HIPAA + 42 CFR Part 2 + EKRA).
 * That gate is represented by HANDOFF_BAA_SIGNED — `assertVaultEnabled()` throws
 * unless it is explicitly set, so PHI can never be written by accident.
 *
 * Connection: uses VAULT_SUPABASE_URL / VAULT_SUPABASE_SERVICE_ROLE_KEY when set
 * (the isolated, BAA-covered project — the production target). Until that project
 * exists it falls back to the Core project, where the vault_* tables are locked
 * down by deny-all RLS and reachable only via this service-role client.
 */
/** Non-throwing check — for UIs that degrade gracefully when PHI is gated off. */
export function isVaultEnabled(): boolean {
  return process.env.HANDOFF_BAA_SIGNED === 'true';
}

export function assertVaultEnabled(): void {
  if (process.env.HANDOFF_BAA_SIGNED !== 'true') {
    throw new Error(
      'PHI vault is disabled. Storing seeker identity requires a signed BAA + HIPAA add-on + security review + 42 CFR Part 2 / EKRA legal sign-off. Set HANDOFF_BAA_SIGNED=true only once that is in place.'
    );
  }
}

export function createVaultClient() {
  assertVaultEnabled();
  const url = process.env.VAULT_SUPABASE_URL || process.env.SUPABASE_URL!;
  const key = process.env.VAULT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
