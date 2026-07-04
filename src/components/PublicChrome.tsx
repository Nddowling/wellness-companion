'use client';

import { usePathname } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { MobileTabBar, type Tab } from '@/components/MobileTabBar';

// Chrome for the directory/content pages: the persistent search header (top) and
// a thumb-reachable tab bar (bottom, mobile only). Scoped to the routes where
// browsing/searching is the job — the homepage hero, the full-height /match flow,
// and the marketing/legal/form pages (which have their own designed layouts and
// sometimes their own logo) stay chrome-free. `children` are Server Components.
const CHROME_ROUTES = ['/programs', '/treatment', '/insurance', '/guides', '/resources', '/library'];

const PUBLIC_TABS: Tab[] = [
  { href: '/match', label: 'Find care', icon: 'care' },
  { href: '/programs', label: 'Browse', icon: 'facility' },
  { href: '/treatment', label: 'States', icon: 'home' },
  { href: '/guides', label: 'Guides', icon: 'chat' },
];

export default function PublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showChrome = CHROME_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  if (!showChrome) return <>{children}</>;

  return (
    <>
      <SiteHeader />
      <div className="pb-20 lg:pb-0">{children}</div>
      <MobileTabBar tabs={PUBLIC_TABS} />
    </>
  );
}
