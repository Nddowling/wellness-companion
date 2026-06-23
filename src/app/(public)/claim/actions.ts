'use server';

import { redirect } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';

// Public, pre-account facility claim. A provider tells us who they are and which
// program they run; a Global Admin verifies them and, on approval, an account is
// created and a SET-PASSWORD link is emailed (see admin/actions.ts approveClaim). No
// account exists before approval — verification is the gate. Inserted via the
// service-role admin client because the submitter has no session yet.
export async function submitPublicClaim(formData: FormData) {
  const email = String(formData.get('claimant_email') || '').trim().toLowerCase();
  const facilityId = String(formData.get('facility_id') || '') || null;
  const freetext = String(formData.get('facility_name_freetext') || '').trim() || null;

  // Need a way to reach them, and at least one way to identify the facility.
  if (!email || (!facilityId && !freetext)) redirect('/claim?error=1');

  const admin = createAdminClient();
  await admin.from('facility_claims').insert({
    user_id: null,
    facility_id: facilityId,
    facility_name_freetext: freetext,
    claimant_name: String(formData.get('claimant_name') || '').trim() || null,
    claimant_email: email,
    claimant_phone: String(formData.get('claimant_phone') || '').trim() || null,
    claimant_title: String(formData.get('claimant_title') || '').trim() || null,
    note: String(formData.get('note') || '').trim() || null,
    status: 'pending',
  });

  redirect('/claim?submitted=1');
}
