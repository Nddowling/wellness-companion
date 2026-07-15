import { redirect } from 'next/navigation';

import { getRoles, homePathFor } from '@/lib/auth';

// The legacy referrer (BD) lane is retired. Historical rows stay in the database,
// but there are no legacy mutation actions or entry points; the canonical partner
// workspace lives under /partners.
export default async function BdHome() {
  const roles = await getRoles();
  if (!roles.user) redirect('/login');
  redirect(homePathFor(roles));
}
