import type { Metadata } from 'next';

import { absoluteUrl } from '@/lib/seo';

// The /match page itself is a client component (the live intake conversation),
// so its metadata is declared here in a server-component layout wrapper.
const MATCH_TITLE = 'Find Treatment That Fits — Talk to Our Care Companion';
const MATCH_DESCRIPTION =
  'Answer a few gentle questions and get matched to addiction treatment programs — including those for co-occurring mental-health needs — that fit your situation, insurance, and region. We connect you to treatment facilities; we don’t provide treatment ourselves. Free and private — no account required.';

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

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
