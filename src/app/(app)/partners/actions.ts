'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { isPartnerType } from '@/lib/partner/types';

/** The signed-in user id, or throw (every action below requires a session). */
async function uid(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user.id;
}

/**
 * Create or update the partner profile (bd_users row). Called right after signup
 * and from /partners/settings. RLS lets a user write only their own row.
 */
export async function savePartnerProfile(input: {
  partner_type?: string | null;
  title?: string | null;
  employer?: string | null;
  phone?: string | null;
}) {
  const supabase = await createClient();
  const user_id = await uid();
  const partner_type = input.partner_type && isPartnerType(input.partner_type) ? input.partner_type : null;
  await supabase.from('bd_users').upsert(
    {
      user_id,
      partner_type,
      title: input.title?.trim() || null,
      employer: input.employer?.trim() || null,
      phone: input.phone?.trim() || null,
    },
    { onConflict: 'user_id' },
  );
}

/** Settings form handler. */
export async function updatePartnerProfileAction(formData: FormData) {
  await savePartnerProfile({
    partner_type: (formData.get('partner_type') as string) || null,
    title: (formData.get('title') as string) || null,
    employer: (formData.get('employer') as string) || null,
    phone: (formData.get('phone') as string) || null,
  });
  revalidatePath('/partners/settings');
  revalidatePath('/partners');
}

// ── saved facilities ─────────────────────────────────────────────────────────

export async function toggleSaveAction(formData: FormData) {
  const facility_id = formData.get('facility_id') as string;
  const saved = formData.get('saved') === '1'; // currently saved? then remove
  if (!facility_id) return;
  const supabase = await createClient();
  const bd_user_id = await uid();
  if (saved) {
    await supabase.from('bd_saved_facilities').delete().eq('bd_user_id', bd_user_id).eq('facility_id', facility_id);
  } else {
    await supabase.from('bd_saved_facilities').upsert(
      { bd_user_id, facility_id },
      { onConflict: 'bd_user_id,facility_id' },
    );
  }
  revalidatePath('/partners');
  revalidatePath('/partners/saved');
  revalidatePath('/partners/search');
}

// ── view history ─────────────────────────────────────────────────────────────

export async function recordViewAction(facilityId: string) {
  if (!facilityId) return;
  const supabase = await createClient();
  const user_id = await uid();
  // Upsert so each facility keeps a single, most-recent row. set_updated_at-style
  // bump via explicit viewed_at (no trigger on this table).
  await supabase.from('partner_view_history').upsert(
    { user_id, facility_id: facilityId, viewed_at: new Date().toISOString() },
    { onConflict: 'user_id,facility_id' },
  );
}

// ── shortlists ───────────────────────────────────────────────────────────────

export async function createListAction(formData: FormData) {
  const supabase = await createClient();
  const owner_id = await uid();
  const title = ((formData.get('title') as string) || '').trim() || 'Recovery options';
  const intro = ((formData.get('intro') as string) || '').trim() || null;
  const { data } = await supabase.from('partner_lists').insert({ owner_id, title, intro }).select('id').single();
  // Optionally seed with a facility (when "New list" is started from a Save action).
  const facility_id = formData.get('facility_id') as string | null;
  if (data?.id && facility_id) {
    await supabase.from('partner_list_items').insert({ list_id: data.id, facility_id });
  }
  revalidatePath('/partners/lists');
  if (data?.id) redirect(`/partners/lists/${data.id}`);
}

export async function renameListAction(formData: FormData) {
  const id = formData.get('list_id') as string;
  if (!id) return;
  const supabase = await createClient();
  await uid();
  await supabase
    .from('partner_lists')
    .update({
      title: ((formData.get('title') as string) || '').trim() || 'Recovery options',
      intro: ((formData.get('intro') as string) || '').trim() || null,
    })
    .eq('id', id);
  revalidatePath(`/partners/lists/${id}`);
  revalidatePath('/partners/lists');
}

export async function deleteListAction(formData: FormData) {
  const id = formData.get('list_id') as string;
  if (!id) return;
  const supabase = await createClient();
  await uid();
  await supabase.from('partner_lists').delete().eq('id', id);
  revalidatePath('/partners/lists');
  redirect('/partners/lists');
}

export async function addToListAction(formData: FormData) {
  const list_id = formData.get('list_id') as string;
  const facility_id = formData.get('facility_id') as string;
  if (!list_id || !facility_id) return;
  const supabase = await createClient();
  await uid();
  await supabase
    .from('partner_list_items')
    .upsert({ list_id, facility_id }, { onConflict: 'list_id,facility_id' });
  revalidatePath(`/partners/lists/${list_id}`);
}

export async function removeFromListAction(formData: FormData) {
  const list_id = formData.get('list_id') as string;
  const facility_id = formData.get('facility_id') as string;
  if (!list_id || !facility_id) return;
  const supabase = await createClient();
  await uid();
  await supabase.from('partner_list_items').delete().eq('list_id', list_id).eq('facility_id', facility_id);
  revalidatePath(`/partners/lists/${list_id}`);
}

/** A short note the family sees beside a facility on the shared shortlist. */
export async function updateItemNoteAction(formData: FormData) {
  const list_id = formData.get('list_id') as string;
  const facility_id = formData.get('facility_id') as string;
  if (!list_id || !facility_id) return;
  const supabase = await createClient();
  await uid();
  await supabase
    .from('partner_list_items')
    .update({ note: ((formData.get('note') as string) || '').trim() || null })
    .eq('list_id', list_id)
    .eq('facility_id', facility_id);
  revalidatePath(`/partners/lists/${list_id}`);
}

/** Toggle public sharing. Generates a token on first share; clears it to unshare. */
export async function toggleShareAction(formData: FormData) {
  const id = formData.get('list_id') as string;
  const shared = formData.get('shared') === '1'; // currently shared? then unshare
  if (!id) return;
  const supabase = await createClient();
  await uid();
  await supabase
    .from('partner_lists')
    .update({ share_token: shared ? null : randomUUID().replace(/-/g, '').slice(0, 16) })
    .eq('id', id);
  revalidatePath(`/partners/lists/${id}`);
}
