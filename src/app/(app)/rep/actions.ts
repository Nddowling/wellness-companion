'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
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

export async function updateRepProfileAction(formData: FormData) {
  const supabase = await createClient();
  const user_id = await uid();
  const display_name = ((formData.get('display_name') as string) || '').trim() || 'Recovery professional';
  const specialties = ((formData.get('specialties') as string) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Keep an existing slug stable; generate a unique one on first save.
  const { data: existing } = await supabase.from('rep_profiles').select('slug').eq('user_id', user_id).maybeSingle();
  const slug = existing?.slug ?? `${slugify(display_name)}-${token(6)}`;

  await supabase.from('rep_profiles').upsert(
    {
      user_id,
      slug,
      display_name,
      headline: ((formData.get('headline') as string) || '').trim() || null,
      bio: ((formData.get('bio') as string) || '').trim() || null,
      photo_url: ((formData.get('photo_url') as string) || '').trim() || null,
      linkedin_url: ((formData.get('linkedin_url') as string) || '').trim() || null,
      location: ((formData.get('location') as string) || '').trim() || null,
      specialties,
      is_public: formData.get('is_public') === 'on',
    },
    { onConflict: 'user_id' },
  );
  revalidatePath('/rep');
  revalidatePath(`/p/${slug}`);
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
