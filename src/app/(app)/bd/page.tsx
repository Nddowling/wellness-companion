import { redirect } from 'next/navigation';

import { getRoles, homePathFor } from '@/lib/auth';

// The referrer (BD) lane is retired from the UI. The bd_users table + actions stay
// in place for any historical data, but there is no entry point: anyone landing here
// is routed back to their own lane.
export default async function BdHome() {
  const roles = await getRoles();
  if (!roles.user) redirect('/login');
  redirect(homePathFor(roles));
}
