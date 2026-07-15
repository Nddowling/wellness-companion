import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { absoluteUrl } from '@/lib/seo';
import { getRoles, isProviderSide } from '@/lib/auth';

// The /match page itself is a client component (the live intake conversation),
// so its metadata is declared here in a server-component layout wrapper.
const MATCH_TITLE = 'Narrow Addiction-Treatment Directory Options';
const MATCH_DESCRIPTION =
  'Answer a few limited questions to narrow addiction-treatment directory options by listed level, reported payment information, and region. A provider determines clinical fit and admission. Free to use with no account required to start.';

export const metadata: Metadata = {
  title: MATCH_TITLE,
  description: MATCH_DESCRIPTION,
  alternates: { canonical: '/match' },
  openGraph: {
    title: MATCH_TITLE,
    description: MATCH_DESCRIPTION,
    url: absoluteUrl('/match'),
  },
};

export default async function MatchLayout({ children }: { children: React.ReactNode }) {
  const roles = await getRoles();
  // The seeker AI is open to everyone — no account needed to start. An account is
  // created mid-conversation once they choose to share contact details. Provider-side
  // users (facility members) don't use this funnel and are sent to their dashboard;
  // a Global Admin is NOT provider-side, so they can open it as a test.
  if (isProviderSide(roles)) redirect('/home');
  return children;
}
