'use server';

import { randomBytes, randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import {
  getRoles,
  homePathFor,
  profileType,
  requireFacilityOwner,
  requireRep,
} from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { postgresNullableText } from '@/lib/supabase/rpc';
import { detectImageMedia, storageObjectPathFromPublicUrl } from '@/lib/media/validation';
import { slugify } from '@/lib/rep/data';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REP_PHOTO_BUCKET = 'rep-photos';

function token(): string {
  return randomBytes(24).toString('base64url');
}

async function existingFacilityId(raw: unknown): Promise<string | null> {
  const facilityId = String(raw ?? '').trim();
  if (!UUID_PATTERN.test(facilityId)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.from('facilities').select('id').eq('id', facilityId).maybeSingle();
  return error ? null : (data?.id ?? null);
}

function optionalLinkedInUrl(raw: unknown): string | null | false {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/(^|\.)linkedin\.com$/i.test(url.hostname)) return false;
    return url.toString();
  } catch {
    return false;
  }
}

// ── profile ──────────────────────────────────────────────────────────────────

/** useActionState shape — surfaces success/failure inline instead of failing silently. */
export type RepProfileState = { ok: boolean; error?: string; savedAt?: number };

export async function updateRepProfileAction(
  _prev: RepProfileState,
  formData: FormData,
): Promise<RepProfileState> {
  const rep = await requireRep();
  const supabase = await createClient();
  const user_id = rep.id;
  const display_name = String(formData.get('display_name') ?? '').trim().slice(0, 120) || 'Recovery professional';
  const specialties = ((formData.get('specialties') as string) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => s.slice(0, 80));
  const linkedin_url = optionalLinkedInUrl(formData.get('linkedin_url'));
  if (linkedin_url === false) {
    return { ok: false, error: 'Enter a valid https://linkedin.com profile URL.' };
  }

  // Keep an existing slug stable + fall back to the current photo when no new one is picked.
  const { data: existing, error: existingError } = await supabase
    .from('rep_profiles')
    .select('slug, photo_url')
    .eq('user_id', user_id)
    .maybeSingle();
  if (existingError) return { ok: false, error: 'Could not load the current profile.' };
  const slug = existing?.slug ?? `${slugify(display_name)}-${token().slice(0, 8)}`;

  // Photo: a newly selected device image is uploaded to the public rep-photos bucket;
  // otherwise keep the current one (or clear it if the user chose "Remove photo").
  const file = formData.get('photo');
  const removePhoto = formData.get('remove_photo') === '1';
  const changesPhoto = (file instanceof File && file.size > 0) || removePhoto;
  let requestedPhotoUrl: string | null = existing?.photo_url ?? null;
  let uploadedPath: string | null = null;
  let photoAdmin: ReturnType<typeof createAdminClient> | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > 4_000_000) return { ok: false, error: 'That image is very large — please pick one under 4MB.' };
    const media = await detectImageMedia(file);
    if (!media) return { ok: false, error: 'Choose a valid JPEG, PNG, WebP, or AVIF image.' };

    photoAdmin = createAdminClient();
    uploadedPath = `${user_id}/${randomUUID()}.${media.extension}`;
    const { error: upErr } = await photoAdmin.storage
      .from(REP_PHOTO_BUCKET)
      .upload(uploadedPath, file, {
        contentType: media.mimeType,
        cacheControl: '31536000',
        upsert: false,
      });
    if (upErr) return { ok: false, error: 'Photo upload failed. Please try again.' };

    requestedPhotoUrl = photoAdmin.storage.from(REP_PHOTO_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
    const verifiedPath = storageObjectPathFromPublicUrl(
      requestedPhotoUrl,
      REP_PHOTO_BUCKET,
      user_id,
      process.env.SUPABASE_URL ?? '',
    );
    if (verifiedPath !== uploadedPath) {
      const { error: cleanupError } = await photoAdmin.storage.from(REP_PHOTO_BUCKET).remove([uploadedPath]);
      return cleanupError
        ? { ok: false, error: 'The photo URL was invalid and storage cleanup needs support.' }
        : { ok: false, error: 'Could not prepare the photo URL.' };
    }
  } else if (removePhoto) {
    requestedPhotoUrl = null;
    photoAdmin = createAdminClient();
  }

  const { error } = await supabase
    .from('rep_profiles')
    .update({
      slug,
      display_name,
      headline: String(formData.get('headline') ?? '').trim().slice(0, 160) || null,
      bio: String(formData.get('bio') ?? '').trim().slice(0, 2_000) || null,
      linkedin_url,
      location: String(formData.get('location') ?? '').trim().slice(0, 160) || null,
      specialties,
      is_public: formData.get('is_public') === 'on',
    })
    .eq('user_id', user_id);
  if (error) {
    if (photoAdmin && uploadedPath) {
      const { error: cleanupError } = await photoAdmin.storage.from(REP_PHOTO_BUCKET).remove([uploadedPath]);
      if (cleanupError) return { ok: false, error: 'The profile was not saved and photo cleanup needs support.' };
    }
    return { ok: false, error: `Could not save: ${error.message}` };
  }

  if (changesPhoto && photoAdmin) {
    const previousPhotoUrl = existing?.photo_url ?? null;
    const { error: swapError } = await photoAdmin.rpc('swap_rep_profile_photo', {
      p_user_id: user_id,
      p_expected_url: postgresNullableText(previousPhotoUrl),
      p_new_url: postgresNullableText(requestedPhotoUrl),
    });
    if (swapError) {
      if (uploadedPath) {
        const { error: cleanupError } = await photoAdmin.storage.from(REP_PHOTO_BUCKET).remove([uploadedPath]);
        if (cleanupError) return { ok: false, error: 'The photo changed elsewhere and storage cleanup needs support.' };
      }
      return {
        ok: false,
        error: swapError.code === '40001'
          ? 'Your photo changed in another session. Refresh and try again.'
          : 'Could not update the profile photo.',
      };
    }

    const previousPath = previousPhotoUrl
      ? storageObjectPathFromPublicUrl(
          previousPhotoUrl,
          REP_PHOTO_BUCKET,
          user_id,
          process.env.SUPABASE_URL ?? '',
        )
      : null;
    if (previousPath && previousPhotoUrl !== requestedPhotoUrl) {
      const { error: previousDeleteError } = await photoAdmin.storage.from(REP_PHOTO_BUCKET).remove([previousPath]);
      if (previousDeleteError) {
        const { error: rollbackError } = await photoAdmin.rpc('swap_rep_profile_photo', {
          p_user_id: user_id,
          p_expected_url: postgresNullableText(requestedPhotoUrl),
          p_new_url: postgresNullableText(previousPhotoUrl),
        });
        if (rollbackError) {
          return { ok: false, error: 'The old photo could not be cleaned up. Please contact support.' };
        }
        if (uploadedPath) {
          const { error: newDeleteError } = await photoAdmin.storage.from(REP_PHOTO_BUCKET).remove([uploadedPath]);
          if (newDeleteError) {
            return { ok: false, error: 'The photo change was rolled back, but storage cleanup needs support.' };
          }
        }
        return { ok: false, error: 'The old photo could not be deleted, so the photo change was rolled back.' };
      }
    }
  }

  revalidatePath('/rep');
  revalidatePath(`/p/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

// ── affiliations (rep self-attaches; status starts pending) ──────────────────

export async function addAffiliationAction(formData: FormData) {
  const rep = await requireRep();
  const facility_id = await existingFacilityId(formData.get('facility_id'));
  if (!facility_id) return;
  const admin = createAdminClient();
  const { error } = await admin.from('facility_affiliations').upsert(
    {
      user_id: rep.id,
      facility_id,
      title: String(formData.get('title') ?? '').trim().slice(0, 120) || null,
      status: 'pending',
    },
    { onConflict: 'user_id,facility_id', ignoreDuplicates: true },
  );
  if (error) throw new Error('Could not request that affiliation.');
  revalidatePath('/rep');
}

export async function removeAffiliationAction(formData: FormData) {
  const rep = await requireRep();
  const facility_id = String(formData.get('facility_id') ?? '');
  if (!facility_id) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from('facility_affiliations')
    .delete()
    .eq('user_id', rep.id)
    .eq('facility_id', facility_id);
  if (error) throw new Error('Could not remove that affiliation.');
  revalidatePath('/rep');
}

// ── invites (the viral colleague loop) ───────────────────────────────────────

export async function createInviteAction(formData: FormData) {
  const rep = await requireRep();
  const supabase = await createClient();
  const rawFacilityId = String(formData.get('facility_id') ?? '').trim();
  const facility_id = rawFacilityId ? await existingFacilityId(rawFacilityId) : null;
  if (rawFacilityId && !facility_id) throw new Error('Choose a valid facility.');
  const { error } = await supabase.from('rep_invites').insert({ token: token(), inviter_id: rep.id, facility_id });
  if (error) throw new Error('Could not create the invitation.');
  revalidatePath('/rep');
}

export async function deleteInviteAction(formData: FormData) {
  const rep = await requireRep();
  const t = formData.get('token') as string;
  if (!t) return;
  const supabase = await createClient();
  const { error } = await supabase.from('rep_invites').delete().eq('token', t).eq('inviter_id', rep.id);
  if (error) throw new Error('Could not delete the invitation.');
  revalidatePath('/rep');
}

// ── verification (director of the claimed facility, or admin) ─────────────────
// RLS: only a facility_member of facility_id (or admin) may update these rows.

export async function setAffiliationStatusAction(formData: FormData) {
  const id = formData.get('affiliation_id') as string;
  const status = formData.get('status') as string;
  const facility_id = formData.get('facility_id') as string;
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(facility_id) || !['verified', 'rejected', 'pending'].includes(status)) return;
  const roles = await getRoles();
  if (!roles.user) redirect('/login');
  if (!roles.isAdmin) {
    if (profileType(roles) !== 'facility' || !roles.facilityIds.includes(facility_id)) {
      redirect(homePathFor(roles));
    }
    await requireFacilityOwner(facility_id);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_facility_affiliation_status', {
    p_affiliation_id: id,
    p_status: status,
  });
  if (error) throw new Error('Could not update the affiliation.');
  revalidatePath(`/facility/${facility_id}`);
  revalidatePath(`/programs/${facility_id}`);
}
