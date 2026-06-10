import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

// Lightweight engagement logger for the facility performance summary. The client
// fires a sendBeacon on a profile's call / directions / email tap; we record a
// de-identified count row (no PHI). Best-effort: always 204, never block the user.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(['call', 'directions', 'email']);

export async function POST(request: Request) {
  let body: { facilityId?: string; type?: string; matchId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const facilityId = String(body.facilityId ?? '');
  const type = String(body.type ?? '');
  if (!UUID_RE.test(facilityId) || !TYPES.has(type)) return new Response(null, { status: 204 });
  const matchId = body.matchId && UUID_RE.test(String(body.matchId)) ? String(body.matchId) : null;

  const admin = createAdminClient();
  try {
    // Only log for real, published facilities so the metric stays clean.
    const { data: fac } = await admin
      .from('facilities')
      .select('id')
      .eq('id', facilityId)
      .eq('is_published', true)
      .maybeSingle();
    if (fac) {
      await admin.from('facility_events').insert({
        facility_id: facilityId,
        event_type: type,
        match_id: matchId,
        referrer: request.headers.get('referer'),
      });
    }
  } catch {
    // metrics are best-effort
  }
  return new Response(null, { status: 204 });
}
