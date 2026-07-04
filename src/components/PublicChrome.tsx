'use client';

import { usePathname } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { MobileTabBar, type Tab } from '@/components/MobileTabBar';

// Chrome for public interior pages: the persistent search header (top) and a
// thumb-reachable tab bar (bottom, mobile only). Both are suppressed on the
// homepage (designed hero) and the full-height /match flow, which stay chrome-
// free. `children` are Server Components passed through untouched.
const PUBLIC_TABS: Tab[] = [
  { href: '/match', label: 'Find care', icon: 'care' },
  { href: '/programs', label: 'Browse', icon: 'facility' },
  { href: '/treatment', label: 'States', icon: 'home' },
  { href: '/guides', label: 'Guides', icon: 'chat' },
];

export default function PublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === '/' || pathname === '/match' || pathname.startsWith('/match/');

  return (
    <>
      <SiteHeader />
      <div className={bare ? undefined : 'pb-20 lg:pb-0'}>{children}</div>
      {!bare && <MobileTabBar tabs={PUBLIC_TABS} />}
    </>
  );
}
