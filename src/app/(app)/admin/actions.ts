'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LEVELS_OF_CARE, PAYER_TYPES } from '@/lib/constants';

function splitCsv(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Create a facility plus its selected payers and zeroed capacity rows. */
export async function createFacility(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const levels = LEVELS_OF_CARE.filter((l) => formData.get(`level_${l}`) === 'on');
  const payers = PAYER_TYPES.filter((p) => formData.get(`payer_${p}`) === 'on');

  const { data: facility, error } = await supabase
    .from('facilities')
    .insert({
      name: String(formData.get('name')),
      street: String(formData.get('street') || ''),
      city: String(formData.get('city') || ''),
      state: String(formData.get('state') || ''),
      zip: String(formData.get('zip') || ''),
      npi: String(formData.get('npi') || '') || null,
      license_number: String(formData.get('license_number') || '') || null,
      levels_of_care: levels,
      specialties: splitCsv(formData.get('specialties')),
      populations_served: splitCsv(formData.get('populations_served')),
      accreditations: splitCsv(formData.get('accreditations')),
      is_gated: formData.get('is_gated') === 'on',
      is_faith_based: formData.get('is_faith_based') === 'on',
      cash_rate: formData.get('cash_rate') ? Number(formData.get('cash_rate')) : null,
      referral_contact: {
        name: String(formData.get('contact_name') || ''),
        email: String(formData.get('contact_email') || ''),
        phone: String(formData.get('contact_phone') || ''),
      },
    })
    .select('id')
    .single();

  if (error || !facility) {
    throw new Error(`Could not create facility: ${error?.message}`);
  }

  if (payers.length) {
    await supabase
      .from('facility_payers')
      .insert(payers.map((payer_type) => ({ facility_id: facility.id, payer_type })));
  }
  if (levels.length) {
    await supabase
      .from('facility_capacity')
      .insert(levels.map((level_of_care) => ({ facility_id: facility.id, level_of_care, beds_available: 0 })));
  }

  revalidatePath('/admin');
  redirect(`/admin/facilities/${facility.id}`);
}

/** Update bed availability for one level of care and bump last_updated (the moat). */
export async function updateCapacity(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const facilityId = String(formData.get('facility_id'));
  const level = String(formData.get('level_of_care'));
  const beds = Number(formData.get('beds_available'));

  await supabase
    .from('facility_capacity')
    .upsert(
      {
        facility_id: facilityId,
        level_of_care: level,
        beds_available: Number.isFinite(beds) ? beds : 0,
        last_updated: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: 'facility_id,level_of_care' }
    );

  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath('/admin');
}

/** Toggle whether a facility appears in the public/BD directory. */
export async function togglePublish(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const facilityId = String(formData.get('facility_id'));
  const publish = formData.get('publish') === 'true';

  await supabase.from('facilities').update({ is_published: publish }).eq('id', facilityId);
  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath('/admin');
}

/** Stamp a facility as verified now. */
export async function verifyFacility(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const facilityId = String(formData.get('facility_id'));
  await supabase
    .from('facilities')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', facilityId);
  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath('/admin');
}
