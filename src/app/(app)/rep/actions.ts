'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { slugify } from '@/lib/rep/data';

async function uid(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user.id;
}

function token(len = 16): string {
  return randomUUID().replace(/-/g, '').slice(0, len);
}

// ── profile ──────────────────────────────────────────────────────────────────

/** useActionState shape — surfaces success/failure inline instead of failing silently. */
export type RepProfileState = { ok: boolean; error?: string; savedAt?: number };

export async function updateRepProfileAction(
  _prev: RepProfileState,
  formData: FormData,
): Promise<RepProfileState> {
  const supabase = await createClient();
  const user_id = await uid();
  const display_name = ((formData.get('display_name') as string) || '').trim() || 'Recovery professional';
  const specialties = ((formData.get('specialties') as string) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Keep an existing slug stable + fall back to the current photo when no new one is picked.
  const { data: existing } = await supabase
    .from('rep_profiles')
    .select('slug, photo_url')
    .eq('user_id', user_id)
    .maybeSingle();
  const slug = existing?.slug ?? `${slugify(display_name)}-${token(6)}`;

  // Photo: a newly selected device image is uploaded to the public rep-photos bucket;
  // otherwise keep the current one (or clear it if the user chose "Remove photo").
  let photo_url: string | null = existing?.photo_url ?? null;
  const file = formData.get('photo');
  if (file instanceof File && file.size > 0) {
    if (file.size > 25_000_000) return { ok: false, error: 'That image is very large — please pick one under 25MB.' };
    if (!file.type.startsWith('image/')) return { ok: false, error: 'That file isn’t an image.' };
    const admin = createAdminClient();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${user_id}/${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from('rep-photos')
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true });
    if (upErr) return { ok: false, error: `Photo upload failed: ${upErr.message}` };
    photo_url = admin.storage.from('rep-photos').getPublicUrl(path).data.publicUrl;
  } else if (formData.get('remove_photo') === '1') {
    photo_url = null;
  }

  const { error } = await supabase.from('rep_profiles').upsert(
    {
      user_id,
      slug,
      display_name,
      headline: ((formData.get('headline') as string) || '').trim() || null,
      bio: ((formData.get('bio') as string) || '').trim() || null,
      photo_url,
      linkedin_url: ((formData.get('linkedin_url') as string) || '').trim() || null,
      location: ((formData.get('location') as string) || '').trim() || null,
      specialties,
      is_public: formData.get('is_public') === 'on',
    },
    { onConflict: 'user_id' },
  );
  if (error) return { ok: false, error: `Could not save: ${error.message}` };

  revalidatePath('/rep');
  revalidatePath(`/p/${slug}`);
  return { ok: true, savedAt: Date.now() };
}

// ── affiliations (rep self-attaches; status starts pending) ──────────────────

export async function addAffiliationAction(formData: FormData) {
  const facility_id = formData.get('facility_id') as string;
  if (!facility_id) return;
  const supabase = await createClient();
  const user_id = await uid();
  await supabase.from('facility_affiliations').upsert(
    { user_id, facility_id, title: ((formData.get('title') as string) || '').trim() || null, status: 'pending' },
    { onConflict: 'user_id,facility_id', ignoreDuplicates: true },
  );
  revalidatePath('/rep');
}

export async function removeAffiliationAction(formData: FormData) {
  const facility_id = formData.get('facility_id') as string;
  if (!facility_id) return;
  const supabase = await createClient();
  const user_id = await uid();
  await supabase.from('facility_affiliations').delete().eq('user_id', user_id).eq('facility_id', facility_id);
  revalidatePath('/rep');
}

// ── invites (the viral colleague loop) ───────────────────────────────────────

export async function createInviteAction(formData: FormData) {
  const supabase = await createClient();
  const inviter_id = await uid();
  const facility_id = (formData.get('facility_id') as string) || null;
  await supabase.from('rep_invites').insert({ token: token(20), inviter_id, facility_id });
  revalidatePath('/rep');
}

export async function deleteInviteAction(formData: FormData) {
  const t = formData.get('token') as string;
  if (!t) return;
  const supabase = await createClient();
  await uid();
  await supabase.from('rep_invites').delete().eq('token', t);
  revalidatePath('/rep');
}

// ── verification (director of the claimed facility, or admin) ─────────────────
// RLS: only a facility_member of facility_id (or admin) may update these rows.

export async function setAffiliationStatusAction(formData: FormData) {
  const id = formData.get('affiliation_id') as string;
  const status = formData.get('status') as string;
  const facility_id = formData.get('facility_id') as string;
  if (!id || !['verified', 'rejected', 'pending'].includes(status)) return;
  const supabase = await createClient();
  await uid();
  await supabase.from('facility_affiliations').update({ status }).eq('id', id);
  if (facility_id) {
    revalidatePath(`/facility/${facility_id}`);
    revalidatePath(`/programs/${facility_id}`);
  }
}
