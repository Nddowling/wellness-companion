import 'server-only';

import { readBoundedJson } from '@/lib/request-body';
import {
  anonymousBudgetHeaders,
  consumeAnonymousBudget,
} from '@/lib/security/anonymous-guard';
import { createAdminClient } from '@/lib/supabase/admin';

// Lightweight engagement logger for the facility performance summary. The client
// fires a sendBeacon on a profile's call / directions / email tap; we record a
// facility-level count row with no seeker/match identifier. Best-effort: always 204,
// never block the user.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(['call', 'directions', 'email']);
const MAX_BODY_BYTES = 2 * 1024;

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await readBoundedJson(request, MAX_BODY_BYTES);
  } catch {
    return new Response(null, { status: 204 });
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return new Response(null, { status: 204 });
  }
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== 'facilityId' && key !== 'type')) {
    return new Response(null, { status: 204 });
  }

  const facilityId = String(body.facilityId ?? '');
  const type = String(body.type ?? '');
  if (!UUID_RE.test(facilityId) || !TYPES.has(type)) return new Response(null, { status: 204 });

  const budget = await consumeAnonymousBudget(request, 'track');
  const responseHeaders = anonymousBudgetHeaders(budget);
  if (!budget.ok) return new Response(null, { status: 204, headers: responseHeaders });

  const admin = createAdminClient();
  try {
    // Only log for real, published facilities so the metric stays clean.
    const { data: fac, error: facilityError } = await admin
      .from('facilities')
      .select('id')
      .eq('id', facilityId)
      .eq('is_published', true)
      .maybeSingle();
    if (facilityError) {
      console.error('[facility-event] facility lookup failed', {
        code: facilityError.code ?? 'unknown',
      });
      return new Response(null, { status: 204, headers: responseHeaders });
    }
    if (fac) {
      const { error: insertError } = await admin.from('facility_events').insert({
        facility_id: facilityId,
        event_type: type,
        match_id: null,
        // Referrer URLs can contain search or intake context. Counts do not need
        // them, so never retain the header.
        referrer: null,
      });
      if (insertError) {
        console.error('[facility-event] insert failed', {
          code: insertError.code ?? 'unknown',
        });
      }
    }
  } catch (error) {
    console.error('[facility-event] unexpected failure', {
      kind: error instanceof Error ? error.name : 'unknown',
    });
  }
  return new Response(null, { status: 204, headers: responseHeaders });
}
