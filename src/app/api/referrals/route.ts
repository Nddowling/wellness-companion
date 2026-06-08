import 'server-only';

import { getRoles } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

// Capture a facility-to-facility referral. Auth-required and facility-only: the
// referrer is the signed-in member's facility. The reward (50% off next month, up to
// 3 free months) is granted later, when the referred facility starts a paid plan
// (see the Stripe webhook). Written via the service-role client (deny-all RLS).
export async function POST(request: Request) {
  const roles = await getRoles();
  if (!roles.user) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const referrerFacilityId = roles.facilityIds[0];
  if (!referrerFacilityId) return Response.json({ error: 'Not a facility account' }, { status: 403 });

  let body: { referred_name?: string; referred_email?: string; referred_phone?: string; referred_note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = String(body.referred_name ?? '').trim();
  const email = String(body.referred_email ?? '').trim().toLowerCase();
  if (!name || !email) {
    return Response.json({ error: 'A facility name and email are required.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('facility_referrals').insert({
    referrer_facility_id: referrerFacilityId,
    referred_name: name,
    referred_email: email,
    referred_phone: String(body.referred_phone ?? '').trim() || null,
    referred_note: String(body.referred_note ?? '').trim() || null,
    status: 'pending',
  });
  if (error) return Response.json({ error: 'Could not save the referral.' }, { status: 500 });

  return Response.json({ ok: true });
}
