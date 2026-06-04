'use server';

import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';

// Public review submission. Seekers have no account, so this runs server-side with
// the service-role client. Reviews are public content (not PHI). Stored as
// 'approved' for now so they appear immediately — add moderation before launch.
export async function addReview(formData: FormData) {
  const facilityId = String(formData.get('facility_id') || '');
  const body = String(formData.get('body') || '').trim().slice(0, 4000);
  const author = String(formData.get('author_name') || '').trim().slice(0, 120);
  const ratingRaw = Number(formData.get('rating'));
  const rating = Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;

  if (!facilityId || body.length < 2) return;

  const supabase = createAdminClient();
  await supabase.from('facility_reviews').insert({
    facility_id: facilityId,
    author_name: author || null,
    rating,
    body,
    status: 'approved',
  });

  revalidatePath(`/programs/${facilityId}`);
}
