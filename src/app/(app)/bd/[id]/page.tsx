import { redirect } from 'next/navigation';

import { getRoles, homePathFor } from '@/lib/auth';

// Retired referrer (BD) lane — no entry point. See bd/page.tsx.
export default async function BdFacility() {
  const roles = await getRoles();
  if (!roles.user) redirect('/login');
  redirect(homePathFor(roles));
}
