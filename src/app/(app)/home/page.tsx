import { redirect } from 'next/navigation';

import { getRoles } from '@/lib/auth';

// Post-login router — sends each user to the portal that fits their role.
export default async function HomePage() {
  const { user, isAdmin, facilityIds, isBd, isSeeker } = await getRoles();
  if (!user) redirect('/login');
  if (isSeeker) redirect('/me');
  if (isAdmin) redirect('/admin');
  if (facilityIds.length === 1) redirect(`/facility/${facilityIds[0]}`); // straight to their profile
  if (facilityIds.length > 1) redirect('/facility');
  if (isBd) redirect('/bd');
  // No role yet — let them choose: referrer or claim a facility.
  redirect('/get-started');
}
