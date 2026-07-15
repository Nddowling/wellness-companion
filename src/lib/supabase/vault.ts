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
 * Connection requires the isolated Vault project explicitly. It never falls back
 * to Core: a partial production configuration must fail closed.
 */
/** Non-throwing check — for UIs that degrade gracefully when PHI is gated off. */
export function isVaultEnabled(): boolean {
  return Boolean(
    process.env.HANDOFF_BAA_SIGNED === 'true' &&
      process.env.VAULT_SUPABASE_URL &&
      process.env.VAULT_SUPABASE_SERVICE_ROLE_KEY
  );
}

export function assertVaultEnabled(): void {
  if (!isVaultEnabled()) {
    throw new Error(
      'PHI vault is disabled. Storing seeker identity requires a signed BAA + HIPAA add-on + security review + 42 CFR Part 2 / EKRA legal sign-off. Set HANDOFF_BAA_SIGNED=true only once that is in place.'
    );
  }
}

export function createVaultClient() {
  assertVaultEnabled();
  const url = process.env.VAULT_SUPABASE_URL!;
  const key = process.env.VAULT_SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
