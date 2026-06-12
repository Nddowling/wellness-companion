'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createVaultClient } from '@/lib/supabase/vault';
import { sendEmail } from '@/lib/email/send';
import { providerClaimApprovedEmail, staffInviteEmail } from '@/lib/email/templates';
import { SITE_URL } from '@/lib/seo';
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

// ── helpers ───────────────────────────────────────────────────────────────────
function tempPassword(): string {
  return `WC-${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}`;
}

async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

// ── facilities ────────────────────────────────────────────────────────────────
/** Delete a facility (cascades capacity/payers/members/routes/reviews/claims). */
export async function deleteFacility(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const facilityId = String(formData.get('facility_id'));
  await supabase.from('facilities').delete().eq('id', facilityId);
  revalidatePath('/admin/facilities');
  redirect('/admin/facilities');
}

/** Full edit of a facility's profile, levels, payers, flags (admin). */
export async function adminUpdateFacility(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const facilityId = String(formData.get('facility_id'));

  const levels = LEVELS_OF_CARE.filter((l) => formData.get(`level_${l}`) === 'on');
  const payers = PAYER_TYPES.filter((p) => formData.get(`payer_${p}`) === 'on');

  await supabase
    .from('facilities')
    .update({
      name: String(formData.get('name')),
      street: String(formData.get('street') || '') || null,
      city: String(formData.get('city') || '') || null,
      state: String(formData.get('state') || '') || null,
      zip: String(formData.get('zip') || '') || null,
      operator_type: String(formData.get('operator_type') || '') || null,
      priority_tier: String(formData.get('priority_tier') || '') || null,
      website: String(formData.get('website') || '') || null,
      description: String(formData.get('description') || '') || null,
      specialty_programs: String(formData.get('specialty_programs') || '') || null,
      levels_of_care: levels,
      specialties: splitCsv(formData.get('specialties')),
      populations_served: splitCsv(formData.get('populations_served')),
      accreditations: splitCsv(formData.get('accreditations')),
      carriers_named: splitCsv(formData.get('carriers_named')),
      is_gated: formData.get('is_gated') === 'on',
      is_faith_based: formData.get('is_faith_based') === 'on',
      cash_rate: formData.get('cash_rate') ? Number(formData.get('cash_rate')) : null,
      referral_contact: {
        name: String(formData.get('contact_name') || ''),
        email: String(formData.get('contact_email') || ''),
        phone: String(formData.get('contact_phone') || ''),
      },
    })
    .eq('id', facilityId);

  await supabase.from('facility_payers').delete().eq('facility_id', facilityId);
  if (payers.length) {
    await supabase
      .from('facility_payers')
      .insert(payers.map((payer_type) => ({ facility_id: facilityId, payer_type })));
  }
  if (levels.length) {
    await supabase
      .from('facility_capacity')
      .upsert(
        levels.map((level_of_care) => ({ facility_id: facilityId, level_of_care, beds_available: 0 })),
        { onConflict: 'facility_id,level_of_care', ignoreDuplicates: true }
      );
  }

  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath(`/programs/${facilityId}`);
}

const PLANS = ['free', 'starter', 'growth', 'anchor'] as const;
const PLAN_STATUSES = ['active', 'lifetime', 'canceled'] as const;

/**
 * Manually set a facility's subscription tier + status. Every feature gate reads
 * facilities.plan, so this grants/revokes access immediately. It does NOT bill —
 * it's for comped or offline-paid accounts; self-serve billed upgrades go through
 * Stripe checkout. `lifetime` is honored by the webhook (never auto-downgraded).
 */
export async function adminSetPlan(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const facilityId = String(formData.get('facility_id'));
  const plan = String(formData.get('plan'));
  const planStatus = String(formData.get('plan_status') || 'active');
  if (!PLANS.includes(plan as (typeof PLANS)[number])) throw new Error('Invalid plan');
  if (!PLAN_STATUSES.includes(planStatus as (typeof PLAN_STATUSES)[number])) throw new Error('Invalid plan status');

  await supabase.from('facilities').update({ plan, plan_status: planStatus }).eq('id', facilityId);
  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath('/admin/facilities');
  revalidatePath(`/programs/${facilityId}`); // unlock/lock the public profile at once
}

// ── facility members + claims ─────────────────────────────────────────────────
/** Add a person as a facility member by email; create their login if new + email it. */
export async function addFacilityMember(formData: FormData) {
  await requireAdmin();
  const facilityId = String(formData.get('facility_id'));
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!email) return;

  const admin = createAdminClient();
  const password = tempPassword();
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'facility', must_reset_password: true },
  });

  let userId = created?.user?.id ?? null;
  if (created?.user) {
    const { data: facility } = await admin.from('facilities').select('name').eq('id', facilityId).maybeSingle();
    const invite = staffInviteEmail({
      facilityName: facility?.name ?? 'your facility',
      loginUrl: `${SITE_URL}/login`,
      email,
      role: 'staff',
      password,
    });
    await sendEmail({ to: email, subject: invite.subject, html: invite.html, text: invite.text });
  } else {
    userId = await findUserIdByEmail(admin, email);
  }

  if (userId) {
    await admin
      .from('facility_members')
      .upsert(
        { facility_id: facilityId, user_id: userId, role: 'staff' },
        { onConflict: 'facility_id,user_id', ignoreDuplicates: true }
      );
  }
  revalidatePath(`/admin/facilities/${facilityId}`);
}

export async function removeFacilityMember(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const memberId = String(formData.get('member_id'));
  const facilityId = String(formData.get('facility_id'));
  await admin.from('facility_members').delete().eq('id', memberId);
  revalidatePath(`/admin/facilities/${facilityId}`);
}

// Returned to the admin UI so approval is usable even when the credentials email
// can't be delivered (e.g. Resend sandbox / unverified domain) — the admin can then
// relay the temp password by hand.
export type ApproveResult =
  | { ok: true; email: string | null; tempPassword: string | null; mailSent: boolean; facilityLinked: boolean }
  | { ok: false; error: string }
  | null;

export async function approveClaim(_prev: ApproveResult, formData: FormData): Promise<ApproveResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const claimId = String(formData.get('claim_id'));
  const { data: claim } = await admin
    .from('facility_claims')
    .select('user_id, facility_id, claimant_email, claimant_name')
    .eq('id', claimId)
    .single();
  if (!claim) return { ok: false, error: 'Claim not found.' };

  // Resolve the provider's account. Public claims arrive with NO user_id — create
  // their login now (temp password + must-reset), so verification is the only gate
  // to a provider account existing at all.
  let userId = claim.user_id as string | null;
  let tempPw: string | null = null;
  const email = (claim.claimant_email as string | null)?.trim().toLowerCase() || null;
  if (!userId && email) {
    tempPw = tempPassword();
    const { data: created } = await admin.auth.admin.createUser({
      email,
      password: tempPw,
      email_confirm: true,
      user_metadata: { role: 'facility', must_reset_password: true, name: claim.claimant_name ?? null },
    });
    userId = created?.user?.id ?? (await findUserIdByEmail(admin, email));
    if (!created?.user) tempPw = null; // account already existed — no new temp password to send
  }

  // Membership requires a known facility (a "not listed" claim has none — the admin
  // links the facility after creating it, then the account is already in place).
  if (userId && claim.facility_id) {
    await admin
      .from('facility_members')
      .upsert(
        { facility_id: claim.facility_id, user_id: userId, role: 'staff' },
        { onConflict: 'facility_id,user_id', ignoreDuplicates: true }
      );
  }
  await admin.from('facility_claims').update({ status: 'approved' }).eq('id', claimId);

  // Tell them they're verified + how to sign in. The send can fail (sandbox / no
  // verified domain) — we report that back so the admin can hand off credentials.
  let mailSent = false;
  if (email) {
    const { data: facility } = claim.facility_id
      ? await admin.from('facilities').select('name').eq('id', claim.facility_id).maybeSingle()
      : { data: null };
    const mail = providerClaimApprovedEmail({
      facilityName: facility?.name ?? 'your facility',
      loginUrl: `${SITE_URL}/login`,
      email,
      password: tempPw ?? undefined,
    });
    const res = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
    mailSent = res.ok;
  }
  revalidatePath('/admin/claims');
  return { ok: true, email, tempPassword: tempPw, mailSent, facilityLinked: !!(userId && claim.facility_id) };
}

export async function rejectClaim(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from('facility_claims').update({ status: 'rejected' }).eq('id', String(formData.get('claim_id')));
  revalidatePath('/admin/claims');
}

// ── review moderation ─────────────────────────────────────────────────────────
/** Approve a pending public review → it becomes visible on the facility profile. */
export async function approveReview(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const id = String(formData.get('review_id'));
  const facilityId = String(formData.get('facility_id') || '');
  await admin.from('facility_reviews').update({ status: 'approved' }).eq('id', id);
  revalidatePath('/admin/reviews');
  if (facilityId) revalidatePath(`/programs/${facilityId}`);
}

/** Reject a pending review → it never appears publicly. */
export async function rejectReview(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from('facility_reviews').update({ status: 'rejected' }).eq('id', String(formData.get('review_id')));
  revalidatePath('/admin/reviews');
}

// ── seekers (PHI vault — service role) ─────────────────────────────────────────
export async function adminCreateSeeker(formData: FormData) {
  await requireAdmin();
  const vault = createVaultClient();
  await vault.from('vault_seekers').insert({
    name: String(formData.get('name') || '') || null,
    email: String(formData.get('email') || '') || null,
    phone: String(formData.get('phone') || '') || null,
    dob: String(formData.get('dob') || '') || null,
    insurance: String(formData.get('insurance') || '') || null,
    coverage_status: String(formData.get('coverage_status') || '') || null,
    status: 'active',
  });
  revalidatePath('/admin/seekers');
  redirect('/admin/seekers');
}

export async function adminUpdateSeeker(formData: FormData) {
  await requireAdmin();
  const vault = createVaultClient();
  const id = String(formData.get('seeker_id'));
  await vault
    .from('vault_seekers')
    .update({
      name: String(formData.get('name') || '') || null,
      email: String(formData.get('email') || '') || null,
      phone: String(formData.get('phone') || '') || null,
      dob: String(formData.get('dob') || '') || null,
      insurance: String(formData.get('insurance') || '') || null,
      status: String(formData.get('status') || 'active'),
    })
    .eq('id', id);
  revalidatePath(`/admin/seekers/${id}`);
}

export async function adminDeleteSeeker(formData: FormData) {
  await requireAdmin();
  const vault = createVaultClient();
  await vault.from('vault_seekers').delete().eq('id', String(formData.get('seeker_id')));
  revalidatePath('/admin/seekers');
  redirect('/admin/seekers');
}
