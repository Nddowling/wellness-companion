import 'server-only';

import type { User } from '@supabase/supabase-js';

import { isPartnerType } from '@/lib/partner/types';
import { createAdminClient } from '@/lib/supabase/admin';

const INVITE_TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

function repSlug(name: string, userId: string): string {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'rep';
  return `${base}-${userId.slice(0, 8)}`;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().slice(0, maxLength) || null;
}

/**
 * Materialize the provider-side row represented by verified auth metadata.
 *
 * This is intentionally insert-only. Auth callbacks also run for password
 * recovery, so updating an existing row here could roll back settings or change
 * a Rep's public slug from stale signup metadata.
 */
export async function provisionCanonicalLane(user: User): Promise<boolean> {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const admin = createAdminClient();

  if (meta.role === 'partner') {
    const partnerType =
      typeof meta.partner_type === 'string' && isPartnerType(meta.partner_type) ? meta.partner_type : null;
    const { error } = await admin.from('bd_users').upsert(
      {
        user_id: user.id,
        partner_type: partnerType,
        title: optionalText(meta.professional_title, 120),
        employer: optionalText(meta.employer, 160),
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
    return !error;
  }

  if (meta.role !== 'rep') return true;

  const name = optionalText(meta.full_name, 120) ?? '';
  const { error: profileError } = await admin.from('rep_profiles').upsert(
    {
      user_id: user.id,
      slug: repSlug(name, user.id),
      display_name: name || 'Recovery professional',
      headline: optionalText(meta.headline, 160),
    },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
  if (profileError) return false;

  const inviteToken = optionalText(meta.rep_invite_token, 128);
  if (!inviteToken || !INVITE_TOKEN.test(inviteToken)) return true;

  const { data: invite, error: inviteError } = await admin
    .from('rep_invites')
    .select('facility_id, inviter_id, email')
    .eq('token', inviteToken)
    .maybeSingle();
  if (inviteError) return false;
  if (!invite?.facility_id) return true;

  const invitedEmail = invite.email?.trim().toLowerCase() ?? null;
  if (invitedEmail && invitedEmail !== user.email?.trim().toLowerCase()) return true;

  const { error: affiliationError } = await admin.from('facility_affiliations').upsert(
    {
      user_id: user.id,
      facility_id: invite.facility_id,
      status: 'pending',
      invited_by: invite.inviter_id,
    },
    { onConflict: 'user_id,facility_id', ignoreDuplicates: true },
  );
  return !affiliationError;
}
