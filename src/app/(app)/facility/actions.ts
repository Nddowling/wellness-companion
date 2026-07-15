'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireFacilityMember, requireFacilityOwner, requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { staffInviteEmail } from '@/lib/email/templates';
import { SITE_URL } from '@/lib/seo';
import { effectivePlan, photoLimit, planAllows, seatLimit } from '@/lib/facility/plan';
import { PAYER_TYPES, isBedBased, type PayerType } from '@/lib/constants';
import { invalidateFacilityPublic } from '@/lib/facility/invalidate';
import { optionalHttpUrl } from '@/lib/http-url';
import {
  detectImageMedia,
  detectVideoMedia,
  storageObjectPathFromPublicUrl,
} from '@/lib/media/validation';
import { normalizeCommercialCarrierNames } from '@/lib/payers';
import { findAuthUserIdByEmail, generateSetPasswordUrl } from '@/lib/supabase/auth-admin';

const FACILITY_PHOTO_BUCKET = 'facility-photos';
const FACILITY_VIDEO_BUCKET = 'facility-videos';
const FACILITY_VIDEO_MAX_BYTES = 25_000_000;
const SAFE_DATABASE_CODE = /^[a-z0-9_-]{1,32}$/i;

type DatabaseOperationError = { code?: unknown } | null | undefined;

function providerDatabaseFailure(
  operation: string,
  error: DatabaseOperationError,
  publicMessage: string,
  emptyCode = 'unknown',
): never {
  const rawCode = error?.code;
  console.error('[provider-workspace] database operation failed', {
    operation,
    code: typeof rawCode === 'string' && SAFE_DATABASE_CODE.test(rawCode) ? rawCode : emptyCode,
  });
  throw new Error(publicMessage);
}

async function removeStoredObject(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  path: string,
  failureMessage: string,
): Promise<void> {
  const { error } = await admin.storage.from(bucket).remove([path]);
  if (error) throw new Error(failureMessage);
}

async function rejectAndCleanUpload(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  path: string,
  message: string,
): Promise<never> {
  await removeStoredObject(
    admin,
    bucket,
    path,
    'The media could not be published or cleaned up. Please contact support.',
  );
  throw new Error(message);
}

/** A logged-in user requests to manage a facility; an admin approves it. */
export async function requestClaim(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityId) return;
  const { error } = await supabase
    .from('facility_claims')
    .insert({
      user_id: user.id,
      facility_id: facilityId,
      note: String(formData.get('note') || '') || null,
      status: 'pending',
    });
  if (error && error.code !== '23505') throw new Error('Could not submit the ownership request.');
  redirect('/get-started?claimed=1');
}

/** A verified facility owner invites a staff colleague to the same facility. */
export async function inviteStaff(formData: FormData) {
  const facilityId = String(formData.get('facility_id'));
  await requireFacilityOwner(facilityId);

  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid work email.');

  const admin = createAdminClient();
  let userId = await findAuthUserIdByEmail(admin, email);

  // Seat cap: every plan includes two seats. Any larger, documented custom
  // arrangement is provisioned separately in extra_seats; there is no unsupported
  // self-service add-on path. Re-inviting an existing member consumes no seat.
  if (userId) {
    const { data: alreadyMember } = await admin
      .from('facility_members')
      .select('user_id')
      .eq('facility_id', facilityId)
      .eq('user_id', userId)
      .maybeSingle();
    if (alreadyMember) redirect(`/facility/${facilityId}/invite?already=1`);
  }

  {
    const [{ count: memberCount }, { data: fac }] = await Promise.all([
      admin.from('facility_members').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId),
      admin.from('facilities').select('extra_seats').eq('id', facilityId).maybeSingle(),
    ]);
    const limit = seatLimit(fac?.extra_seats);
    if ((memberCount ?? 0) >= limit) {
      redirect(`/facility/${facilityId}/invite?seatfull=1`);
    }
  }

  let setPasswordUrl: string | null = null;
  let newAccount = false;
  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { role: 'facility', must_reset_password: true },
    });
    if (error || !created?.user) {
      // Handle a concurrent account creation without truncating the auth-user scan.
      userId = await findAuthUserIdByEmail(admin, email);
      if (!userId) throw new Error('Could not prepare the invited account.');
    } else {
      userId = created.user.id;
      newAccount = true;
      try {
        setPasswordUrl = await generateSetPasswordUrl(admin, email);
      } catch (error) {
        await admin.auth.admin.deleteUser(userId);
        throw error;
      }
    }
  }

  const { error: membershipError } = await admin
    .from('facility_members')
    .insert({ facility_id: facilityId, user_id: userId, role: 'staff' });
  if (membershipError) {
    if (newAccount) await admin.auth.admin.deleteUser(userId);
    throw new Error('Could not add this staff member.');
  }

  // Email a single-use setup link for a new account, or the ordinary sign-in link
  // for an existing account. No credential is ever relayed through the browser.
  const { data: facility } = await admin.from('facilities').select('name').eq('id', facilityId).maybeSingle();
  const invite = staffInviteEmail({
    facilityName: facility?.name ?? 'your facility',
    actionUrl: setPasswordUrl ?? `${SITE_URL}/login`,
    email,
    role: 'staff',
    newAccount,
  });
  const sent = await sendEmail({ to: email, subject: invite.subject, html: invite.html, text: invite.text });

  revalidatePath(`/facility/${facilityId}`);
  redirect(`/facility/${facilityId}/invite?invited=1&emailed=${sent.ok ? 1 : 0}&new=${newAccount ? 1 : 0}`);
}

/** A facility member updates fresh residential-bed capacity. */
export async function updateCapacity(formData: FormData) {
  const { userId, facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const level = String(formData.get('level_of_care'));
  if (!isBedBased(level)) throw new Error('Only residential capacity is currently supported.');
  const beds = Number(formData.get('beds_available'));
  const admin = createAdminClient();

  const { data: facility } = await admin
    .from('facilities')
    .select('levels_of_care')
    .eq('id', facilityId)
    .maybeSingle();
  if (!facility?.levels_of_care?.includes(level)) throw new Error('This facility does not list residential care.');

  const { error } = await admin.from('facility_capacity').upsert(
    {
      facility_id: facilityId,
      level_of_care: level,
      beds_available: Number.isFinite(beds) && beds >= 0 ? beds : 0,
      last_updated: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: 'facility_id,level_of_care' }
  );
  if (error) throw new Error(`Could not update residential capacity: ${error.message}`);

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath('/facility');
  // Bed counts show on every public card — refresh the directory + SEO listings too.
  revalidatePath(`/programs/${facilityId}`);
  revalidatePath('/programs');
  revalidatePath('/treatment', 'layout');
  revalidatePath('/insurance', 'layout');
  await invalidateFacilityPublic(facilityId);
}

/** Move an inbound lead through its lifecycle (viewed / accepted / declined). */
export async function setLeadStatus(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const routeId = String(formData.get('route_id'));
  const facilityId = String(formData.get('facility_id'));
  const status = String(formData.get('status'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');
  if (!['sent', 'viewed', 'accepted', 'declined'].includes(status)) throw new Error('Bad status');

  const admin = createAdminClient();
  const { data: facility, error: facilityError } = await admin
    .from('facilities')
    .select('plan, plan_status')
    .eq('id', facilityId)
    .maybeSingle();
  if (facilityError) {
    providerDatabaseFailure(
      'lead_plan_lookup',
      facilityError,
      'Could not verify the lead-status workflow. Please try again.',
    );
  }
  if (!facility) {
    providerDatabaseFailure(
      'lead_plan_lookup',
      null,
      'Could not verify the lead-status workflow. Please try again.',
      'not_found',
    );
  }
  if (!facility || !planAllows(effectivePlan(facility.plan, facility.plan_status), 'followUpWorkflow')) {
    throw new Error('The lead-status workflow requires a Growth or Anchor plan.');
  }

  const { data: transitions, error: transitionError } = await admin.rpc('set_provider_lead_status', {
    p_route_id: routeId,
    p_facility_id: facilityId,
    p_status: status,
  });
  const transition = transitions?.[0];
  if (transitionError || !transition || transition.updated_route_id !== routeId) {
    providerDatabaseFailure(
      'lead_status_transition',
      transitionError,
      'Could not update this lead. Refresh the page and try again.',
      transition ? 'unexpected_result' : 'not_found',
    );
  }

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath(`/facility/${facilityId}/contacts`);
}

/** Edit the public profile copy: description, website, and "specializes in" text. */
export async function updateProfile(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from('facilities')
    .update({
      description: String(formData.get('description') || '') || null,
      website: optionalHttpUrl(formData.get('website')),
      specialty_programs: String(formData.get('specialty_programs') || '') || null,
    })
    .eq('id', facilityId)
    .select('id')
    .maybeSingle();
  if (error || !updated) {
    providerDatabaseFailure(
      'profile_update',
      error,
      'Could not save the facility profile. Please try again.',
      'not_found',
    );
  }

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath(`/programs/${facilityId}`);
  await invalidateFacilityPublic(facilityId);
}

/**
 * Facility self-reports payment categories and named commercial carriers. These
 * are program-listed options, not proof of network participation or member-specific
 * benefits. The legacy cash-rate field is intentionally not edited or published
 * until the model can capture its service, unit, and effective date.
 */
export async function updateInsurance(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const cats = new Set(
    formData.getAll('payer_type').map(String).filter((v): v is PayerType => (PAYER_TYPES as readonly string[]).includes(v))
  );
  const carriers = normalizeCommercialCarrierNames(formData.getAll('carrier').map(String));
  if (carriers.length) cats.add('commercial'); // named carrier also enables the generic commercial category

  const payerTypes = [...cats].sort();
  const admin = createAdminClient();
  const { data: replacements, error } = await admin.rpc('replace_facility_insurance', {
    p_facility_id: facilityId,
    p_payer_types: payerTypes,
    p_carriers_named: carriers,
  });
  const replacement = replacements?.[0];
  if (
    error ||
    !replacement ||
    replacement.updated_facility_id !== facilityId ||
    replacement.payer_count !== payerTypes.length ||
    replacement.carrier_count !== carriers.length
  ) {
    providerDatabaseFailure(
      'insurance_replace',
      error,
      'Could not save insurance and payment options. Please try again.',
      replacement ? 'unexpected_result' : 'not_found',
    );
  }

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath(`/programs/${facilityId}`);
  await invalidateFacilityPublic(facilityId);
}

/** Upload a photo to storage and append its public URL to the facility's gallery. */
export async function uploadPhoto(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > 8_000_000) throw new Error('Photo must be under 8MB');
  const media = await detectImageMedia(file);
  if (!media) throw new Error('Choose a valid JPEG, PNG, WebP, or AVIF image.');

  // Service role for storage + the images update (membership already verified).
  const admin = createAdminClient();

  // Photos are free (a full profile is unlocked by a free claim). Resolve the
  // effective plan anyway so a canceled/invalid billing status can never inherit
  // a paid allowance if the limits diverge in the future.
  const { data: planRow, error: planError } = await admin
    .from('facilities')
    .select('plan, plan_status, images')
    .eq('id', facilityId)
    .single();
  if (planError || !planRow) throw new Error('Could not verify the facility photo allowance.');
  const plan = effectivePlan(planRow?.plan, planRow?.plan_status);
  if ((((planRow?.images as string[] | null) ?? []).length) >= photoLimit(plan)) {
    throw new Error(`You can publish up to ${photoLimit(plan)} photos.`);
  }

  const path = `${facilityId}/${randomUUID()}.${media.extension}`;

  const { error: upErr } = await admin.storage
    .from(FACILITY_PHOTO_BUCKET)
    .upload(path, file, { contentType: media.mimeType, cacheControl: '31536000', upsert: false });
  if (upErr) throw new Error('Photo upload failed. Please try again.');

  const { data: pub } = admin.storage.from(FACILITY_PHOTO_BUCKET).getPublicUrl(path);
  const verifiedPath = storageObjectPathFromPublicUrl(
    pub.publicUrl,
    FACILITY_PHOTO_BUCKET,
    facilityId,
    process.env.SUPABASE_URL ?? '',
  );
  if (verifiedPath !== path) {
    await rejectAndCleanUpload(admin, FACILITY_PHOTO_BUCKET, path, 'Could not prepare the photo URL.');
  }

  const { data: appendedCount, error: appendError } = await admin.rpc('append_facility_media_url', {
    p_facility_id: facilityId,
    p_kind: 'photo',
    p_url: pub.publicUrl,
  });
  if (appendError || appendedCount === null) {
    await rejectAndCleanUpload(
      admin,
      FACILITY_PHOTO_BUCKET,
      path,
      appendError?.code === '23514'
        ? `You can publish up to ${photoLimit(plan)} photos.`
        : 'Could not add the photo to this facility.',
    );
  }

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath(`/programs/${facilityId}`);
  await invalidateFacilityPublic(facilityId);
}

/** Remove a photo URL from the facility's gallery. */
export async function removePhoto(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  const url = String(formData.get('url') || '');
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const admin = createAdminClient();
  const objectPath = storageObjectPathFromPublicUrl(
    url,
    FACILITY_PHOTO_BUCKET,
    facilityId,
    process.env.SUPABASE_URL ?? '',
  );
  const { data: removed, error: removeError } = await admin.rpc('remove_facility_media_url', {
    p_facility_id: facilityId,
    p_kind: 'photo',
    p_url: url,
  });
  if (removeError) throw new Error('Could not remove the photo from this facility.');
  if (removed && objectPath) {
    try {
      await removeStoredObject(admin, FACILITY_PHOTO_BUCKET, objectPath, 'Could not delete the stored photo.');
    } catch {
      const { error: restoreError } = await admin.rpc('append_facility_media_url', {
        p_facility_id: facilityId,
        p_kind: 'photo',
        p_url: url,
      });
      if (restoreError) {
        throw new Error('The photo was removed from the gallery, but storage cleanup needs support.');
      }
      throw new Error('The stored photo could not be deleted, so the gallery was restored.');
    }
  }

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath(`/programs/${facilityId}`);
  await invalidateFacilityPublic(facilityId);
}

/** Upload a profile video and append its public URL to the facility. */
export async function uploadVideo(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const file = formData.get('video');
  if (!(file instanceof File) || file.size === 0) return;
  // Server Actions are capped at 30MB in next.config; leave headroom for the
  // multipart envelope instead of advertising an unreachable 200MB limit.
  if (file.size > FACILITY_VIDEO_MAX_BYTES) throw new Error('Video must be under 25MB');
  const media = await detectVideoMedia(file);
  if (!media) throw new Error('Choose a valid MP4, MOV, WebM, or Ogg video.');

  const admin = createAdminClient();
  const { data: planRow, error: planError } = await admin
    .from('facilities')
    .select('plan, plan_status, videos')
    .eq('id', facilityId)
    .single();
  if (planError || !planRow) throw new Error('Could not verify the facility video allowance.');
  const plan = effectivePlan(planRow?.plan, planRow?.plan_status);
  if (!planAllows(plan, 'video')) throw new Error('Your current plan does not include profile video.');
  if ((((planRow?.videos as string[] | null) ?? []).length) >= 5) {
    throw new Error('You can publish up to 5 videos.');
  }

  const path = `${facilityId}/${randomUUID()}.${media.extension}`;
  const { error: upErr } = await admin.storage
    .from(FACILITY_VIDEO_BUCKET)
    .upload(path, file, { contentType: media.mimeType, cacheControl: '31536000', upsert: false });
  if (upErr) throw new Error('Video upload failed. Please try again.');

  const { data: pub } = admin.storage.from(FACILITY_VIDEO_BUCKET).getPublicUrl(path);
  const verifiedPath = storageObjectPathFromPublicUrl(
    pub.publicUrl,
    FACILITY_VIDEO_BUCKET,
    facilityId,
    process.env.SUPABASE_URL ?? '',
  );
  if (verifiedPath !== path) {
    await rejectAndCleanUpload(admin, FACILITY_VIDEO_BUCKET, path, 'Could not prepare the video URL.');
  }

  const { data: appendedCount, error: appendError } = await admin.rpc('append_facility_media_url', {
    p_facility_id: facilityId,
    p_kind: 'video',
    p_url: pub.publicUrl,
  });
  if (appendError || appendedCount === null) {
    await rejectAndCleanUpload(
      admin,
      FACILITY_VIDEO_BUCKET,
      path,
      appendError?.code === '23514'
        ? 'You can publish up to 5 videos.'
        : 'Could not add the video to this facility.',
    );
  }

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath(`/programs/${facilityId}`);
  await invalidateFacilityPublic(facilityId);
}

/** Remove a video URL from the facility. */
export async function removeVideo(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  const url = String(formData.get('url') || '');
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const admin = createAdminClient();
  const objectPath = storageObjectPathFromPublicUrl(
    url,
    FACILITY_VIDEO_BUCKET,
    facilityId,
    process.env.SUPABASE_URL ?? '',
  );
  const { data: removed, error: removeError } = await admin.rpc('remove_facility_media_url', {
    p_facility_id: facilityId,
    p_kind: 'video',
    p_url: url,
  });
  if (removeError) throw new Error('Could not remove the video from this facility.');
  if (removed && objectPath) {
    try {
      await removeStoredObject(admin, FACILITY_VIDEO_BUCKET, objectPath, 'Could not delete the stored video.');
    } catch {
      const { error: restoreError } = await admin.rpc('append_facility_media_url', {
        p_facility_id: facilityId,
        p_kind: 'video',
        p_url: url,
      });
      if (restoreError) {
        throw new Error('The video was removed from the gallery, but storage cleanup needs support.');
      }
      throw new Error('The stored video could not be deleted, so the gallery was restored.');
    }
  }

  revalidatePath(`/facility/${facilityId}`);
  revalidatePath(`/programs/${facilityId}`);
  await invalidateFacilityPublic(facilityId);
}

export async function updateContact(formData: FormData) {
  const { facilityIds } = await requireFacilityMember();
  const facilityId = String(formData.get('facility_id'));
  if (!facilityIds.includes(facilityId)) throw new Error('Not your facility');

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from('facilities')
    .update({
      referral_contact: {
        name: String(formData.get('contact_name') || ''),
        email: String(formData.get('contact_email') || ''),
        phone: String(formData.get('contact_phone') || ''),
      },
    })
    .eq('id', facilityId)
    .select('id')
    .maybeSingle();
  if (error || !updated) {
    providerDatabaseFailure(
      'contact_update',
      error,
      'Could not save the intake contact. Please try again.',
      'not_found',
    );
  }

  revalidatePath(`/facility/${facilityId}`);
  await invalidateFacilityPublic(facilityId);
}
