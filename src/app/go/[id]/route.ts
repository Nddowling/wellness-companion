import 'server-only';

import { redirect } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';

// Outbound referral redirect. A seeker clicks "Go to website" on a program
// profile and lands here first: we log a de-identified hand-off row (the
// platform's proof that ClearBed sent this person to the facility), then 302
// them onward to the facility's real site with UTM + cb_ref tags appended so
// the facility's own analytics also credit ClearBed.
//
//   /go/<facilityId>?m=<matchId>   →   logs click   →   facility.com/?utm_source=clearbed&cb_ref=<clickId>
//
// We only ever redirect to the website stored on the facility row (never to a
// user-supplied URL), so this is not an open redirect.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const matchId = url.searchParams.get('m');

  const admin = createAdminClient();

  // Only published facilities are reachable from public profiles.
  const { data: facility } = await admin
    .from('facilities')
    .select('id, website')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();

  // Nothing to forward to — send them back to the in-platform profile.
  if (!facility?.website) redirect(`/programs/${id}`);

  // Log the hand-off. The inserted row id becomes the cb_ref token the facility
  // can quote back to us. Best-effort: a logging hiccup must never strand the
  // seeker, so we fall back to an untracked redirect.
  let clickId: string | null = null;
  try {
    const { data: row } = await admin
      .from('outbound_clicks')
      .insert({
        facility_id: id,
        match_id: matchId && UUID_RE.test(matchId) ? matchId : null,
        referrer: request.headers.get('referer'),
      })
      .select('id')
      .single();
    clickId = row?.id ?? null;
  } catch {
    // swallow — attribution is nice-to-have, the redirect is not
  }

  const dest = new URL(facility.website!);
  dest.searchParams.set('utm_source', 'clearbed');
  dest.searchParams.set('utm_medium', 'referral');
  dest.searchParams.set('utm_campaign', 'program_profile');
  if (clickId) dest.searchParams.set('cb_ref', clickId);

  redirect(dest.toString());
}
