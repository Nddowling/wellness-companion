'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export type ReviewResult = { ok: boolean; error?: string } | null;

// Public review submission. Seekers have no account, so this runs server-side with
// the service-role client. Reviews are public content (not PHI). Stored as
// 'pending' — a Global Admin approves them in /admin/reviews before they go public
// (moderation guard for this YMYL site). useActionState signature so the form can
// show pending + success feedback.
export async function addReview(_prev: ReviewResult, formData: FormData): Promise<ReviewResult> {
  const facilityId = String(formData.get('facility_id') || '');
  const body = String(formData.get('body') || '').trim().slice(0, 4000);
  const author = String(formData.get('author_name') || '').trim().slice(0, 120);
  const ratingRaw = Number(formData.get('rating'));
  const rating = Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;

  if (!facilityId || body.length < 2) return { ok: false, error: 'Please write a short comment first.' };

  const supabase = createAdminClient();
  const { error } = await supabase.from('facility_reviews').insert({
    facility_id: facilityId,
    author_name: author || null,
    rating,
    body,
    status: 'pending',
  });
  if (error) return { ok: false, error: 'Sorry — that didn’t post. Please try again.' };

  return { ok: true };
}
