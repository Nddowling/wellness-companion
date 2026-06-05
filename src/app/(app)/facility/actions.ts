'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireFacilityMember, requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { markSeekerConnectedByMatch } from '@/lib/vault/seekers';
import { sendEmail } from '@/lib/email/send';
import { staffInviteEmail } from '@/lib/email/templates';
import { SITE_URL } from '@/lib/seo';
import { normalizePlan, planAllows, photoLimit, seatLimit, EXTRA_SEAT_PRICE_MONTHLY } from '@/lib/facility/plan';

/** A logged-in user requests to manage a facility; an admin approves it. */
export async function requestClaim(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityId) return;
  await supabase
    .from('facility_claims')
    .upsert(
      { user_id: user.id, facility_id: facilityId, note: String(formData.get('note') || '') || null, status: 'pending' },
      { onConflict: 'user_id,facility_id' }
    );
  redirect('/get-started?claimed=1');
}

/** A facility member invites a colleague to help manage the same facility. */
export async function inviteStaff(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const email = String(formData.get('email') || '').trim().toLowerCase();
  const role = String(formData.get('role') || 'staff') === 'owner' ? 'owner' : 'staff';
  if (!email) return;

  const admin = createAdminClient();
  // Find an existing account for that email, or create one.
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users?.find((u) => (u.email ?? '').toLowerCase() === email);

  let userId: string;
  let tempPw: string | null = null;
  if (existing) {
    userId = existing.id;
  } else {
    tempPw = `CB-${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: tempPw,
      email_confirm: true,
    });
    if (error || !created?.user) throw new Error(`Could not invite: ${error?.message ?? 'unknown error'}`);
    userId = created.user.id;
  }

  // Seat cap: every plan includes 2 seats (Admin + 1 BD); more are $69.99/mo each.
  // Re-inviting an existing member is always allowed (doesn't consume a new seat).
  const { data: alreadyMember } = await admin
    .from('facility_members')
    .select('user_id')
    .eq('facility_id', facilityId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!alreadyMember) {
    const [{ count: memberCount }, { data: fac }] = await Promise.all([
      admin.from('facility_members').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId),
      admin.from('facilities').select('extra_seats').eq('id', facilityId).maybeSingle(),
    ]);
    const limit = seatLimit(fac?.extra_seats);
    if ((memberCount ?? 0) >= limit) {
      redirect(`/facility/${facilityId}/invite?seatfull=1&limit=${limit}&price=${EXTRA_SEAT_PRICE_MONTHLY}`);
    }
  }

  await admin
    .from('facility_members')
    .upsert({ facility_id: facilityId, user_id: userId, role }, { onConflict: 'facility_id,user_id' });

  // Email the invite (best-effort — the temp password is still shown in the UI as
  // a fallback so the flow never hard-fails on a mail hiccup).
  const { data: facility } = await admin.from('facilities').select('name').eq('id', facilityId).maybeSingle();
  const invite = staffInviteEmail({
    facilityName: facility?.name ?? 'your facility',
    loginUrl: `${SITE_URL}/login`,
    email,
    role,
    password: tempPw ?? undefined,
  });
  const sent = await sendEmail({ to: email, subject: invite.subject, html: invite.html, text: invite.text });

  revalidatePath(`/facility/${facilityId}`);
  redirect(
    `/facility/${facilityId}/invite?invited=${encodeURIComponent(email)}&emailed=${sent.ok ? 1 : 0}${tempPw ? `&tmp=${encodeURIComponent(tempPw)}` : ''}`
  );
}

/** A facility member updates their own bed count for one level and bumps the moat. */
export async function updateCapacity(formData: FormData) {
  const { userId, facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const level = String(formData.get('level_of_care'));
  const beds = Number(formData.get('beds_available'));
  const supabase = await createClient();

  await supabase.from('facility_capacity').upsert(
    {
      facility_id: facilityId,
      level_of_care: level,
      beds_available: Number.isFinite(beds) && beds >= 0 ? beds : 0,
      last_updated: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: 'facility_id,level_of_care' }
  );

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath('/facility');
}

/** Move an inbound lead through its lifecycle (viewed / accepted / declined). */
export async function setLeadStatus(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const routeId = String(formData.get('route_id'));
  const facilityId = String(formData.get('facility_id'));
  const status = String(formData.get('status'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');
  if (!['sent', 'viewed', 'accepted', 'declined'].includes(status)) throw new Error('Bad status');

  const supabase = await createClient();
  await supabase.from('match_routes').update({ status }).eq('id', routeId);

  // When a facility accepts a lead, the seeker has moved forward — stop nudging them.
  // Best-effort: only when the vault is enabled, and never let it break the action.
  if (status === 'accepted' && process.env.HANDOFF_BAA_SIGNED === 'true') {
    try {
      const { data: route } = await supabase
        .from('match_routes')
        .select('match_id')
        .eq('id', routeId)
        .maybeSingle();
      if (route?.match_id) await markSeekerConnectedByMatch(route.match_id);
    } catch {
      // swallow — conversion tracking must never block the facility workflow
    }
  }

  revalidatePath(`/facility/${facilityId}`);
}

/** Edit the public profile copy: description, website, and "specializes in" text. */
export async function updateProfile(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const supabase = await createClient();
  await supabase
    .from('facilities')
    .update({
      description: String(formData.get('description') || '') || null,
      website: String(formData.get('website') || '') || null,
      specialty_programs: String(formData.get('specialty_programs') || '') || null,
    })
    .eq('id', facilityId);

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath(`/programs/${facilityId}`);
}

/** Upload a photo to storage and append its public URL to the facility's gallery. */
export async function uploadPhoto(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > 8_000_000) throw new Error('Photo must be under 8MB');

  // Service role for storage + the images update (membership already verified).
  const admin = createAdminClient();

  // Plan gate: photos are a Starter+ feature, capped per tier.
  const { data: planRow } = await admin.from('facilities').select('plan, images').eq('id', facilityId).single();
  const plan = normalizePlan(planRow?.plan);
  if (!planAllows(plan, 'photos')) throw new Error('Photos are a paid feature — upgrade to Starter to add them.');
  if ((((planRow?.images as string[] | null) ?? []).length) >= photoLimit(plan)) {
    throw new Error(`Your plan includes up to ${photoLimit(plan)} photos. Upgrade for more.`);
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${facilityId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;

  const { error: upErr } = await admin.storage
    .from('facility-photos')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { data: pub } = admin.storage.from('facility-photos').getPublicUrl(path);

  const { data: row } = await admin.from('facilities').select('images').eq('id', facilityId).single();
  const images = [...((row?.images as string[] | null) ?? []), pub.publicUrl];
  await admin.from('facilities').update({ images }).eq('id', facilityId);

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath(`/programs/${facilityId}`);
}

/** Remove a photo URL from the facility's gallery. */
export async function removePhoto(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  const url = String(formData.get('url') || '');
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const admin = createAdminClient();
  const { data: row } = await admin.from('facilities').select('images').eq('id', facilityId).single();
  const images = ((row?.images as string[] | null) ?? []).filter((u) => u !== url);
  await admin.from('facilities').update({ images }).eq('id', facilityId);

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath(`/programs/${facilityId}`);
}
export async function updateContact(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const supabase = await createClient();
  await supabase
    .from('facilities')
    .update({
      referral_contact: {
        name: String(formData.get('contact_name') || ''),
        email: String(formData.get('contact_email') || ''),
        phone: String(formData.get('contact_phone') || ''),
      },
    })
    .eq('id', facilityId);

  revalidatePath(`/facility/${facilityId}`);
}
