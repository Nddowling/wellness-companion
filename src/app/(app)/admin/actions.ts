'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { providerClaimApprovedEmail, staffInviteEmail } from '@/lib/email/templates';
import { SITE_URL } from '@/lib/seo';
import { LEVELS_OF_CARE, PAYER_TYPES, isBedBased } from '@/lib/constants';
import { invalidateFacilityPublic } from '@/lib/facility/invalidate';
import { programListedPayerRecord } from '@/lib/payers';
import { findAuthUserIdByEmail, generateSetPasswordUrl } from '@/lib/supabase/auth-admin';
import { optionalHttpUrl } from '@/lib/http-url';
import { revokeConnectorContact } from '@/lib/vault/seekers';

function splitCsv(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Create a facility plus its selected payers and zeroed capacity rows. */
export async function createFacility(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();

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
      .insert(payers.map((payer_type) => programListedPayerRecord(facility.id, payer_type)));
  }
  const bedLevels = levels.filter(isBedBased);
  if (bedLevels.length) {
    await supabase
      .from('facility_capacity')
      .insert(bedLevels.map((level_of_care) => ({ facility_id: facility.id, level_of_care, beds_available: 0 })));
  }

  await invalidateFacilityPublic(facility.id);
  revalidatePath('/admin');
  redirect(`/admin/facilities/${facility.id}`);
}

/** Update fresh residential-bed availability. */
export async function updateCapacity(formData: FormData) {
  const user = await requireAdmin();
  const supabase = createAdminClient();
  const facilityId = String(formData.get('facility_id'));
  const level = String(formData.get('level_of_care'));
  if (!isBedBased(level)) throw new Error('Only residential capacity is currently supported.');
  const beds = Number(formData.get('beds_available'));

  const { data: facility } = await supabase
    .from('facilities')
    .select('levels_of_care')
    .eq('id', facilityId)
    .maybeSingle();
  if (!facility?.levels_of_care?.includes(level)) throw new Error('This facility does not list residential care.');

  const { error } = await supabase
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
  if (error) throw new Error(`Could not update residential capacity: ${error.message}`);

  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath('/admin');
  await invalidateFacilityPublic(facilityId);
}

/** Toggle whether a facility appears in the public/BD directory. */
export async function togglePublish(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const facilityId = String(formData.get('facility_id'));
  const publish = formData.get('publish') === 'true';

  await supabase.from('facilities').update({ is_published: publish }).eq('id', facilityId);
  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath('/admin');
  await invalidateFacilityPublic(facilityId);
}

/** Stamp that an administrator reviewed this facility record. */
export async function verifyFacility(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const facilityId = String(formData.get('facility_id'));
  await supabase
    .from('facilities')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', facilityId);
  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath('/admin');
  await invalidateFacilityPublic(facilityId);
}

// ── facilities ────────────────────────────────────────────────────────────────
/** Delete a facility (cascades capacity/payers/members/routes/reviews/claims). */
export async function deleteFacility(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const facilityId = String(formData.get('facility_id'));
  await invalidateFacilityPublic(facilityId);
  await supabase.from('facilities').delete().eq('id', facilityId);
  revalidatePath('/admin/facilities');
  redirect('/admin/facilities');
}

/** Full edit of a facility's profile, levels, payers, flags (admin). */
export async function adminUpdateFacility(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
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
      website: optionalHttpUrl(formData.get('website')),
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
      .insert(payers.map((payer_type) => programListedPayerRecord(facilityId, payer_type)));
  }
  const bedLevels = levels.filter(isBedBased);
  const removedBedLevels = LEVELS_OF_CARE.filter((level) => isBedBased(level) && !bedLevels.includes(level));
  if (removedBedLevels.length) {
    await supabase
      .from('facility_capacity')
      .delete()
      .eq('facility_id', facilityId)
      .in('level_of_care', removedBedLevels);
  }
  if (bedLevels.length) {
    await supabase
      .from('facility_capacity')
      .upsert(
        bedLevels.map((level_of_care) => ({ facility_id: facilityId, level_of_care, beds_available: 0 })),
        { onConflict: 'facility_id,level_of_care', ignoreDuplicates: true }
      );
  }

  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath(`/programs/${facilityId}`);
  await invalidateFacilityPublic(facilityId);
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
  const supabase = createAdminClient();
  const facilityId = String(formData.get('facility_id'));
  const plan = String(formData.get('plan'));
  const planStatus = String(formData.get('plan_status') || 'active');
  if (!PLANS.includes(plan as (typeof PLANS)[number])) throw new Error('Invalid plan');
  if (!PLAN_STATUSES.includes(planStatus as (typeof PLAN_STATUSES)[number])) throw new Error('Invalid plan status');

  await supabase.from('facilities').update({ plan, plan_status: planStatus }).eq('id', facilityId);
  revalidatePath(`/admin/facilities/${facilityId}`);
  revalidatePath('/admin/facilities');
  revalidatePath(`/programs/${facilityId}`); // paid legacy entitlement may change immediately
  await invalidateFacilityPublic(facilityId);
}

// ── facility members + claims ─────────────────────────────────────────────────
/** Add a staff member by email; new users receive a single-use setup link. */
export async function addFacilityMember(formData: FormData) {
  await requireAdmin();
  const facilityId = String(formData.get('facility_id'));
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid work email.');

  const admin = createAdminClient();
  let userId = await findAuthUserIdByEmail(admin, email);
  let newAccount = false;
  let setPasswordUrl: string | null = null;
  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { role: 'facility', must_reset_password: true },
    });
    if (error || !created?.user) {
      userId = await findAuthUserIdByEmail(admin, email);
      if (!userId) throw new Error('Could not prepare the invited account.');
    } else {
      userId = created.user.id;
      newAccount = true;
      try {
        setPasswordUrl = await generateSetPasswordUrl(admin, email);
      } catch (error) {
        await admin.auth.admin.deleteUser(userId);
        throw error;
      }
    }
  }

  const { error: membershipError } = await admin
    .from('facility_members')
    .upsert(
      { facility_id: facilityId, user_id: userId, role: 'staff' },
      { onConflict: 'facility_id,user_id', ignoreDuplicates: true }
    );
  if (membershipError) {
    if (newAccount) await admin.auth.admin.deleteUser(userId);
    throw new Error('Could not add this staff member.');
  }

  const { data: facility } = await admin.from('facilities').select('name').eq('id', facilityId).maybeSingle();
  const invite = staffInviteEmail({
    facilityName: facility?.name ?? 'your facility',
    actionUrl: setPasswordUrl ?? `${SITE_URL}/login`,
    email,
    role: 'staff',
    newAccount,
  });
  const sent = await sendEmail({ to: email, subject: invite.subject, html: invite.html, text: invite.text });
  revalidatePath(`/admin/facilities/${facilityId}`);
  if (!sent.ok) {
    throw new Error('The member was added, but the invite email could not be delivered. Ask them to use Forgot password.');
  }
}

export async function removeFacilityMember(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const memberId = String(formData.get('member_id'));
  const facilityId = String(formData.get('facility_id'));
  await admin.from('facility_members').delete().eq('id', memberId);
  revalidatePath(`/admin/facilities/${facilityId}`);
}

// Returned to the admin UI so approval is usable even when the email can't be
// delivered (no SMTP / unverified domain) — the admin can then hand off the
// set-password link directly.
export type ApproveResult =
  | { ok: true; email: string | null; setPasswordUrl: string | null; mailSent: boolean; facilityLinked: boolean }
  | { ok: false; error: string }
  | null;

export async function approveClaim(_prev: ApproveResult, formData: FormData): Promise<ApproveResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const claimId = String(formData.get('claim_id'));
  const { data: claim, error: claimError } = await admin
    .from('facility_claims')
    .select('user_id, facility_id, claimant_email, claimant_name')
    .eq('id', claimId)
    .single();
  if (claimError || !claim) return { ok: false, error: 'Claim not found.' };

  let email = (claim.claimant_email as string | null)?.trim().toLowerCase() || null;
  if (!email && claim.user_id) {
    const { data: existingAuth } = await admin.auth.admin.getUserById(claim.user_id);
    email = existingAuth.user?.email?.trim().toLowerCase() || null;
  }
  if (!email) return { ok: false, error: 'This claim has no email to set up an account.' };
  if (!claim.facility_id) {
    return { ok: false, error: 'Create or link the facility listing before approving this claim.' };
  }

  // The account is created ONLY after an administrator approves the ownership claim
  // existing at all. We seed a throwaway password; the provider sets their own via the
  // emailed set-password link (so there's never a temp password to relay).
  let userId = claim.user_id as string | null;
  let newAccount = false;
  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { role: 'facility', must_reset_password: true, name: claim.claimant_name ?? null },
    });
    if (created?.user?.id) {
      userId = created.user.id;
      newAccount = true;
    } else {
      userId = await findAuthUserIdByEmail(admin, email);
    }
    if (!userId) {
      return {
        ok: false,
        error: createError ? 'The provider account could not be created.' : 'The provider account could not be found.',
      };
    }
  }

  // Migration 38 performs membership + claim approval atomically and rejects an
  // existing Partner, Rep, or Admin identity. If we just created an Auth account
  // and the transaction fails, remove that unused account as compensation.
  const { data: approved, error: approvalError } = await admin.rpc('approve_facility_claim', {
    p_claim_id: claimId,
    p_user_id: userId,
  });
  if (approvalError || !approved?.[0]?.approved_facility_id) {
    let cleanupFailed = false;
    if (newAccount) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(userId);
      cleanupFailed = !!cleanupError;
    }
    return {
      ok: false,
      error: cleanupFailed
        ? 'Approval was rejected and the unused account needs manual cleanup.'
        : approvalError?.message.includes('canonical provider lanes')
          ? 'This account already belongs to a different provider workspace.'
          : 'The ownership claim could not be approved safely.',
    };
  }

  await invalidateFacilityPublic(claim.facility_id);

  // Single-use set-password link → /reset. Emailed (branded) AND returned to the admin
  // UI as a fallback, so an email-delivery failure never blocks the provider getting in.
  let setPasswordUrl: string | null = null;
  try {
    setPasswordUrl = await generateSetPasswordUrl(admin, email);
  } catch {
    // The admin result explicitly reports a missing link below; membership is kept
    // so retrying approval or normal password recovery can finish setup safely.
  }

  let mailSent = false;
  if (setPasswordUrl) {
    const { data: facility } = await admin.from('facilities').select('name').eq('id', claim.facility_id).maybeSingle();
    const mail = providerClaimApprovedEmail({
      facilityName: facility?.name ?? 'your facility',
      setPasswordUrl,
      email,
    });
    const res = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
    mailSent = res.ok;
  }
  revalidatePath('/admin/claims');
  return { ok: true, email, setPasswordUrl, mailSent, facilityLinked: true };
}

// One-click "create listing from this submission" for a NOT-LISTED claim. The public
// claim form folds a manual add into facility_name_freetext as "Name — City, State —
// Website"; we parse that, create a published facility, and link the claim to it — so
// the admin can then Approve normally (which grants access). No DB work by hand.
export async function createListingFromClaim(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const claimId = String(formData.get('claim_id'));
  const { data: claim } = await admin
    .from('facility_claims')
    .select('facility_id, facility_name_freetext')
    .eq('id', claimId)
    .single();
  if (!claim || claim.facility_id) {
    revalidatePath('/admin/claims');
    return; // already linked to a real facility — nothing to create
  }

  const raw = String(claim.facility_name_freetext ?? '').trim();
  if (!raw) {
    revalidatePath('/admin/claims');
    return;
  }
  const parts = raw.split('—').map((s) => s.trim()).filter(Boolean);
  const name = parts[0] || raw;
  const loc = parts.find((p) => p.includes(',')) ?? '';
  const webRaw = parts.find((p) => /\.[a-z]{2,}/i.test(p) && !p.includes(',')) ?? '';
  const [cityRaw, stateRaw] = loc.split(',').map((s) => s.trim());
  const website = webRaw ? (/^https?:\/\//i.test(webRaw) ? webRaw : `https://${webRaw}`) : null;

  const { data: fac } = await admin
    .from('facilities')
    // verification_status ('unverified') + needs_review (true) come from column defaults.
    .insert({
      name,
      city: cityRaw || null,
      state: stateRaw ? stateRaw.toUpperCase().slice(0, 2) : null,
      website,
      is_published: true,
    })
    .select('id')
    .single();

  if (fac?.id) {
    await admin.from('facility_claims').update({ facility_id: fac.id }).eq('id', claimId);
    await invalidateFacilityPublic(fac.id);
  }
  revalidatePath('/admin/claims');
}

export async function rejectClaim(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const claimId = String(formData.get('claim_id'));
  const { data: claim } = await admin.from('facility_claims').select('facility_id').eq('id', claimId).maybeSingle();
  await admin.from('facility_claims').update({ status: 'rejected' }).eq('id', claimId);
  if (claim?.facility_id) await invalidateFacilityPublic(claim.facility_id);
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
  if (facilityId) await invalidateFacilityPublic(facilityId);
}

/** Reject a pending review → it never appears publicly. */
export async function rejectReview(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const reviewId = String(formData.get('review_id'));
  const { data: review } = await admin.from('facility_reviews').select('facility_id').eq('id', reviewId).maybeSingle();
  await admin.from('facility_reviews').update({ status: 'rejected' }).eq('id', reviewId);
  if (review?.facility_id) await invalidateFacilityPublic(review.facility_id);
  revalidatePath('/admin/reviews');
}

// ── consented connector contacts (service role) ────────────────────────────────
export async function adminUpdateSeeker(formData: FormData) {
  await requireAdmin();
  const vault = createAdminClient();
  const id = String(formData.get('seeker_id'));
  const status = String(formData.get('status') || 'active');
  if (!['active', 'connected', 'unsubscribed'].includes(status)) throw new Error('Invalid connector status.');
  if (status === 'unsubscribed') {
    await revokeConnectorContact(id, 'admin_revocation');
  } else {
    // Only a new, explicit seeker handoff may reactivate a revoked record.
    const { data, error } = await vault
      .from('vault_seekers')
      .update({ status })
      .eq('id', id)
      .neq('status', 'unsubscribed')
      .select('id')
      .maybeSingle();
    if (error || !data) throw new Error('Could not update this connector status.');
  }
  revalidatePath(`/admin/seekers/${id}`);
}

export async function adminDeleteSeeker(formData: FormData) {
  await requireAdmin();
  const vault = createAdminClient();
  const { error } = await vault.from('vault_seekers').delete().eq('id', String(formData.get('seeker_id')));
  if (error) throw new Error('Could not delete the connector record.');
  revalidatePath('/admin/seekers');
  redirect('/admin/seekers');
}
