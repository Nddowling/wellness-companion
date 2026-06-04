'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Self-register the current user as a business developer (referrer). */
export async function registerBd(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from('bd_users').insert({
    user_id: user.id,
    employer: String(formData.get('employer') || '') || null,
    territory: String(formData.get('territory') || '') || null,
    phone: String(formData.get('phone') || '') || null,
  });
  revalidatePath('/bd');
}

/** Save or unsave a facility to the referrer's list (own rows only). */
export async function toggleSaved(formData: FormData) {
  const user = await requireUser();
  const facilityId = String(formData.get('facility_id'));
  const currentlySaved = formData.get('currently_saved') === 'true';
  const supabase = await createClient();

  if (currentlySaved) {
    await supabase
      .from('bd_saved_facilities')
      .delete()
      .eq('bd_user_id', user.id)
      .eq('facility_id', facilityId);
  } else {
    await supabase.from('bd_saved_facilities').insert({ bd_user_id: user.id, facility_id: facilityId });
  }
  revalidatePath('/bd');
  revalidatePath(`/bd/${facilityId}`);
}

/** Add a note about a facility (about places, never patients). */
export async function addNote(formData: FormData) {
  const user = await requireUser();
  const facilityId = String(formData.get('facility_id'));
  const body = String(formData.get('body') || '').trim();
  if (!body) return;
  const supabase = await createClient();
  await supabase.from('bd_facility_notes').insert({ bd_user_id: user.id, facility_id: facilityId, body });
  revalidatePath(`/bd/${facilityId}`);
}

/** Delete one of the referrer's own notes. */
export async function deleteNote(formData: FormData) {
  const user = await requireUser();
  const noteId = String(formData.get('note_id'));
  const facilityId = String(formData.get('facility_id'));
  const supabase = await createClient();
  await supabase.from('bd_facility_notes').delete().eq('id', noteId).eq('bd_user_id', user.id);
  revalidatePath(`/bd/${facilityId}`);
}
