import 'server-only';

import { revalidatePath, revalidateTag } from 'next/cache';

import { facilityPath } from '@/lib/facility/href';
import { createAdminClient } from '@/lib/supabase/admin';

/** Purge every cached public representation of one facility after a mutation. */
export async function invalidateFacilityPublic(facilityId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: facility } = await admin
    .from('facilities')
    .select('id, slug, city, state')
    .eq('id', facilityId)
    .maybeSingle();

  revalidateTag(`facility:${facilityId}`, { expire: 0 });
  revalidatePath(`/programs/${facilityId}`);
  revalidatePath('/programs');
  revalidatePath('/treatment', 'layout');
  revalidatePath('/insurance', 'layout');

  if (!facility) return;
  if (facility.slug) revalidateTag(`facility-slug:${facility.slug}`, { expire: 0 });
  if (facility.state && facility.city) {
    revalidateTag(`facilities:${facility.state.toUpperCase()}:${facility.city}`, { expire: 0 });
  }
  revalidatePath(facilityPath(facility));
}
