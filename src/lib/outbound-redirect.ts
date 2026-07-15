import type { SupabaseClient } from '@supabase/supabase-js';

import { safeHttpUrl } from '@/lib/http-url';
import type { Database } from '@/types/database';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_DIAGNOSTIC_RE = /^[a-z0-9_-]{1,32}$/i;

type OutboundAdminClient = SupabaseClient<Database>;
type Diagnostic = Readonly<{ code: string } | { kind: string }>;
type OutboundLogger = (event: string, diagnostic: Diagnostic) => void;

const defaultLogger: OutboundLogger = (event, diagnostic) => {
  console.error(event, diagnostic);
};

function safeDiagnostic(value: unknown): string {
  return typeof value === 'string' && SAFE_DIAGNOSTIC_RE.test(value) ? value : 'unknown';
}

export function outboundFallbackPath(facilityId: string): string {
  return UUID_RE.test(facilityId) ? `/programs/${facilityId}` : '/programs';
}

/**
 * Resolve a public outbound destination while keeping analytics best-effort.
 *
 * The service-role client is injected by the route so this module remains easy to
 * exercise without a database. Diagnostics deliberately retain only a fixed event
 * name and a short error code/kind: database messages, URLs, ids, and request headers
 * can contain private context and must never enter logs.
 */
export async function outboundRedirectDestination(
  admin: OutboundAdminClient,
  facilityId: string,
  log: OutboundLogger = defaultLogger,
): Promise<string> {
  const fallback = outboundFallbackPath(facilityId);
  if (!UUID_RE.test(facilityId)) return fallback;

  let facility: { id: string; website: string | null } | null = null;
  try {
    const { data, error } = await admin
      .from('facilities')
      .select('id, website')
      .eq('id', facilityId)
      .eq('is_published', true)
      .maybeSingle();

    if (error) {
      log('[outbound-click] facility lookup failed', {
        code: safeDiagnostic(error.code),
      });
      return fallback;
    }
    facility = data;
  } catch (error) {
    log('[outbound-click] facility lookup failed unexpectedly', {
      kind: safeDiagnostic(error instanceof Error ? error.name : null),
    });
    return fallback;
  }

  const website = safeHttpUrl(facility?.website);
  if (!website) return fallback;

  let clickId: string | null = null;
  try {
    const { data: row, error } = await admin
      .from('outbound_clicks')
      .insert({
        facility_id: facilityId,
        match_id: null,
        // Referrer URLs may contain search/intake context. Attribution needs only
        // the facility and timestamp, so the database constraint requires NULL.
        referrer: null,
      })
      .select('id')
      .single();

    if (error) {
      log('[outbound-click] insert failed', {
        code: safeDiagnostic(error.code),
      });
    } else {
      clickId = row.id;
    }
  } catch (error) {
    log('[outbound-click] insert failed unexpectedly', {
      kind: safeDiagnostic(error instanceof Error ? error.name : null),
    });
  }

  const destination = new URL(website);
  destination.searchParams.set('utm_source', 'clearbed');
  destination.searchParams.set('utm_medium', 'referral');
  destination.searchParams.set('utm_campaign', 'program_profile');
  if (clickId) destination.searchParams.set('cb_ref', clickId);

  return destination.toString();
}
