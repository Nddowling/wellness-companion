'use server';

import { redirect } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';

// Public facility claim WITH self-signup. The claimant creates their account here
// (their own password, auto-confirmed) so they can sign in immediately — but facility
// ACCESS stays gated: approveClaim (admin/actions.ts) links facility_members only
// after a Global Admin verifies the claim. Inserted via the service-role admin client
// because the submitter has no session yet.
export async function submitPublicClaim(formData: FormData) {
  const email = String(formData.get('claimant_email') || '').trim().toLowerCase();
  const facilityId = String(formData.get('facility_id') || '') || null;
  const freetext = String(formData.get('facility_name_freetext') || '').trim() || null;
  const password = String(formData.get('password') || '');
  const name = String(formData.get('claimant_name') || '').trim() || null;

  // Need a way to reach them, a way to identify the facility, and a password so we
  // can stand up their account now.
  if (!email || (!facilityId && !freetext)) redirect('/claim?error=1');
  if (password.length < 8) redirect('/claim?error=pw');

  const admin = createAdminClient();

  // Create the account now with THEIR password (auto-confirmed). No facility_members
  // yet — verification is still the gate to managing a listing. If the email already
  // has an account, skip creation; approveClaim resolves + links it later and they
  // sign in with their existing password.
  let userId: string | null = null;
  let exists = false;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'facility', name, full_name: name, must_reset_password: false },
  });
  if (created?.user) userId = created.user.id;
  else if (error) exists = true; // already registered (or rejected) — file the claim anyway

  await admin.from('facility_claims').insert({
    user_id: userId,
    facility_id: facilityId,
    facility_name_freetext: freetext,
    claimant_name: name,
    claimant_email: email,
    claimant_phone: String(formData.get('claimant_phone') || '').trim() || null,
    claimant_title: String(formData.get('claimant_title') || '').trim() || null,
    note: String(formData.get('note') || '').trim() || null,
    status: 'pending',
  });

  redirect(exists ? '/claim?submitted=1&exists=1' : '/claim?submitted=1');
}
