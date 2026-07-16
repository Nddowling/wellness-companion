'use server';

import { revalidatePath } from 'next/cache';

import { requireSeeker } from '@/lib/auth';
import { updateMyInfo } from '@/lib/vault/seekers';

/** A seeker edits only their own already-consented connector identity. */
export async function updateMyInfoAction(formData: FormData) {
  const user = await requireSeeker();
  const seekerId = String(formData.get('seeker_id'));
  if (formData.get('confirmed') !== '1') throw new Error('Confirm the contact permission before saving.');
  await updateMyInfo(user.id, seekerId, {
    name: String(formData.get('name') || ''),
    email: String(formData.get('email') || ''),
    phone: String(formData.get('phone') || ''),
  });
  revalidatePath('/me');
}
