'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { requirePartner } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPartnerType } from '@/lib/partner/types';
import { generateShareToken, newShortlistIdentity } from '@/lib/partner/shortlist-privacy';
import { LEVELS_OF_CARE, PAYER_TYPES } from '@/lib/constants';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PartnerProfileInput = {
  partner_type?: string | null;
  title?: string | null;
  employer?: string | null;
  phone?: string | null;
};

/** Accept only an existing published directory record at every facility-ID write boundary. */
async function publishedFacilityId(raw: unknown): Promise<string | null> {
  const facilityId = String(raw ?? '').trim();
  if (!UUID_PATTERN.test(facilityId)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('facilities')
    .select('id')
    .eq('id', facilityId)
    .eq('is_published', true)
    .maybeSingle();
  return error ? null : (data?.id ?? null);
}

/**
 * Update the existing partner profile from /partners/settings. Lane creation is
 * reserved for the verified auth callback; settings can never self-create it.
 */
async function savePartnerProfile(user_id: string, input: PartnerProfileInput) {
  const supabase = await createClient();
  const partner_type = input.partner_type && isPartnerType(input.partner_type) ? input.partner_type : null;
  const { error } = await supabase
    .from('bd_users')
    .update({
      partner_type,
      title: input.title?.trim() || null,
      employer: input.employer?.trim() || null,
      phone: input.phone?.trim() || null,
    })
    .eq('user_id', user_id);
  if (error) throw new Error('Could not save the partner profile.');
}

/** Settings form handler. */
export async function updatePartnerProfileAction(formData: FormData) {
  const partner = await requirePartner();
  await savePartnerProfile(partner.id, {
    partner_type: (formData.get('partner_type') as string) || null,
    title: (formData.get('title') as string) || null,
    employer: (formData.get('employer') as string) || null,
    phone: (formData.get('phone') as string) || null,
  });
  revalidatePath('/partners/settings');
  revalidatePath('/partners');
}

// ── referrals ────────────────────────────────────────────────────────────────

/**
 * File a referral: a de-identified `matches` row (source='bd', attributed to the
 * signed-in partner) plus a `match_routes` row to the chosen facility. match_routes
 * insert is admin-gated, so this runs through the service-role client — attribution
 * is set server-side from the authenticated user, never trusted from the form.
 */
export async function submitReferralAction(formData: FormData) {
  const partner = await requirePartner();
  const facility_id = await publishedFacilityId(formData.get('facility_id'));
  if (!facility_id) return;

  const careRaw = ((formData.get('care_level') as string) || '').trim();
  const payerRaw = ((formData.get('payer_type') as string) || '').trim();
  const care_level_needed = (LEVELS_OF_CARE as readonly string[]).includes(careRaw) ? careRaw : null;
  const payer_type = (PAYER_TYPES as readonly string[]).includes(payerRaw) ? payerRaw : null;

  const admin = createAdminClient();
  const { data: match, error: matchError } = await admin
    .from('matches')
    .insert({ source: 'bd', bd_user_id: partner.id, status: 'routed', care_level_needed, payer_type })
    .select('id')
    .single();
  if (matchError || !match?.id) return;

  const { error: routeError } = await admin
    .from('match_routes')
    .insert({ match_id: match.id, facility_id, status: 'sent' });
  if (routeError) {
    // The two writes cannot be bundled by PostgREST, so compensate immediately.
    // match_routes cascades on match deletion if the insert result was ambiguous.
    const { error: cleanupError } = await admin
      .from('matches')
      .delete()
      .eq('id', match.id)
      .eq('bd_user_id', partner.id);
    if (cleanupError) throw new Error('Referral could not be recorded safely');
    return;
  }

  revalidatePath('/partners');
  revalidatePath('/partners/referrals');
  redirect('/partners/referrals');
}

// ── saved facilities ─────────────────────────────────────────────────────────

export async function toggleSaveAction(formData: FormData) {
  const partner = await requirePartner();
  const facility_id = await publishedFacilityId(formData.get('facility_id'));
  const saved = formData.get('saved') === '1'; // currently saved? then remove
  if (!facility_id) return;
  const supabase = await createClient();
  const bd_user_id = partner.id;
  if (saved) {
    const { error } = await supabase
      .from('bd_saved_facilities')
      .delete()
      .eq('bd_user_id', bd_user_id)
      .eq('facility_id', facility_id);
    if (error) throw new Error('Could not remove the saved program.');
  } else {
    const { error } = await supabase.from('bd_saved_facilities').upsert(
      { bd_user_id, facility_id },
      { onConflict: 'bd_user_id,facility_id' },
    );
    if (error) throw new Error('Could not save the program.');
  }
  revalidatePath('/partners');
  revalidatePath('/partners/saved');
  revalidatePath('/partners/search');
}

// ── view history ─────────────────────────────────────────────────────────────

export async function recordViewAction(facilityId: string) {
  const partner = await requirePartner();
  const facility_id = await publishedFacilityId(facilityId);
  if (!facility_id) return;
  const supabase = await createClient();
  // Upsert so each facility keeps a single, most-recent row. set_updated_at-style
  // bump via explicit viewed_at (no trigger on this table).
  const { error } = await supabase.from('partner_view_history').upsert(
    { user_id: partner.id, facility_id, viewed_at: new Date().toISOString() },
    { onConflict: 'user_id,facility_id' },
  );
  if (error) throw new Error('Could not update partner history.');
}

// ── shortlists ───────────────────────────────────────────────────────────────

export async function createListAction(formData: FormData) {
  const partner = await requirePartner();
  const seedRaw = String(formData.get('facility_id') ?? '').trim();
  const facility_id = seedRaw ? await publishedFacilityId(seedRaw) : null;
  if (seedRaw && !facility_id) return;
  const supabase = await createClient();
  const identity = newShortlistIdentity();
  const { data, error: listError } = await supabase
    .from('partner_lists')
    .insert({ owner_id: partner.id, ...identity, intro: null })
    .select('id')
    .single();
  if (listError || !data?.id) throw new Error('Could not create the shortlist.');
  // Optionally seed with a facility (when "New list" is started from a Save action).
  if (facility_id) {
    const { error: seedError } = await supabase
      .from('partner_list_items')
      .insert({ list_id: data.id, facility_id });
    if (seedError) {
      const { error: cleanupError } = await supabase
        .from('partner_lists')
        .delete()
        .eq('id', data.id)
        .eq('owner_id', partner.id);
      if (cleanupError) throw new Error('The shortlist could not be created safely.');
      throw new Error('Could not add the program to the new shortlist.');
    }
  }
  revalidatePath('/partners/lists');
  redirect(`/partners/lists/${data.id}`);
}

export async function deleteListAction(formData: FormData) {
  const partner = await requirePartner();
  const id = formData.get('list_id') as string;
  if (!UUID_PATTERN.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from('partner_lists').delete().eq('id', id).eq('owner_id', partner.id);
  if (error) throw new Error('Could not delete the shortlist.');
  revalidatePath('/partners/lists');
  redirect('/partners/lists');
}

export async function addToListAction(formData: FormData) {
  await requirePartner();
  const list_id = formData.get('list_id') as string;
  const facility_id = await publishedFacilityId(formData.get('facility_id'));
  if (!UUID_PATTERN.test(list_id) || !facility_id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from('partner_list_items')
    .upsert({ list_id, facility_id }, { onConflict: 'list_id,facility_id' });
  if (error) throw new Error('Could not add the program to that shortlist.');
  revalidatePath(`/partners/lists/${list_id}`);
}

export async function removeFromListAction(formData: FormData) {
  await requirePartner();
  const list_id = formData.get('list_id') as string;
  const facility_id = String(formData.get('facility_id') ?? '');
  if (!UUID_PATTERN.test(list_id) || !UUID_PATTERN.test(facility_id)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from('partner_list_items')
    .delete()
    .eq('list_id', list_id)
    .eq('facility_id', facility_id);
  if (error) throw new Error('Could not remove the program from that shortlist.');
  revalidatePath(`/partners/lists/${list_id}`);
}

/** Toggle public sharing. Generates a token on first share; clears it to unshare. */
export async function toggleShareAction(formData: FormData) {
  const partner = await requirePartner();
  const id = formData.get('list_id') as string;
  if (!UUID_PATTERN.test(id)) return;
  const supabase = await createClient();
  const { data: list, error: listError } = await supabase
    .from('partner_lists')
    .select('share_token')
    .eq('id', id)
    .eq('owner_id', partner.id)
    .maybeSingle();
  if (listError) throw new Error('Could not load the sharing state.');
  if (!list) return;
  const { error } = await supabase
    .from('partner_lists')
    .update({ share_token: list.share_token ? null : generateShareToken() })
    .eq('id', id)
    .eq('owner_id', partner.id);
  if (error) {
    throw new Error(list.share_token ? 'Sharing could not be disabled.' : 'Sharing could not be enabled.');
  }
  revalidatePath(`/partners/lists/${id}`);
}
