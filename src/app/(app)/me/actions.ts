'use server';

import { revalidatePath } from 'next/cache';

import { requireSeeker } from '@/lib/auth';
import { updateMyInfo } from '@/lib/vault/seekers';

/** A seeker edits only their own contact methods (scoped to their account). */
export async function updateMyInfoAction(formData: FormData) {
  const user = await requireSeeker();
  const seekerId = String(formData.get('seeker_id'));
  const channel = String(formData.get('channel'));
  if (channel !== 'email' && channel !== 'phone') throw new Error('Invalid contact method.');
  if (formData.get('confirmed') !== '1') throw new Error('Confirm the contact permission before saving.');
  await updateMyInfo(user.id, seekerId, { channel, value: String(formData.get('value') || '') });
  revalidatePath('/me');
}
