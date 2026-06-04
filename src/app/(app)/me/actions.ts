'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth';
import { updateMyInfo } from '@/lib/vault/seekers';

/** A seeker edits ONLY their own identity info (scoped to their account). */
export async function updateMyInfoAction(formData: FormData) {
  const user = await requireUser();
  const seekerId = String(formData.get('seeker_id'));
  await updateMyInfo(user.id, seekerId, {
    name: String(formData.get('name') || '') || undefined,
    email: String(formData.get('email') || '') || undefined,
    phone: String(formData.get('phone') || '') || undefined,
    dob: String(formData.get('dob') || '') || undefined,
    insurance: String(formData.get('insurance') || '') || undefined,
  });
  revalidatePath('/me');
}
