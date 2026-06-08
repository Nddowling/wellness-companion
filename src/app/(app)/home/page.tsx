import { redirect } from 'next/navigation';

import { getRoles, homePathFor } from '@/lib/auth';

// Post-login router — sends each user to the start of THEIR lane (admin / facility /
// seeker). homePathFor is the single source of truth; the legacy BD lane is dormant,
// so a roleless account falls through to /get-started.
export default async function HomePage() {
  const roles = await getRoles();
  if (!roles.user) redirect('/login');
  redirect(homePathFor(roles));
}
