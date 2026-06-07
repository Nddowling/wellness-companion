import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getRoles } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { normalizePlan } from '@/lib/facility/plan';
import { Logo } from '@/components/Logo';
import { AccountMenu } from '@/components/AccountMenu';
import { MobileTabBar, type Tab } from '@/components/MobileTabBar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, facilityIds, isSeeker } = await getRoles();
  if (!user) redirect('/login'); // the authed shell always requires a session

  // Persistent "Upgrade" pill when the user's facility is on the Free plan.
  let facilityOnFree = false;
  if (!isSeeker && facilityIds.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.from('facilities').select('plan').eq('id', facilityIds[0]).maybeSingle();
    facilityOnFree = normalizePlan(data?.plan) === 'free';
  }

  const links: { href: string; label: string }[] = [];
  if (isSeeker) {
    links.push({ href: '/me', label: 'My care' });
  } else {
    if (isAdmin) links.push({ href: '/admin', label: 'Admin' });
    if (facilityIds.length > 0) links.push({ href: '/facility', label: 'My facility' });
    links.push({ href: '/bd', label: 'Referrer' }); // self-serve — always available
  }

  // App-like bottom tab bar (mobile). Same destinations as the desktop nav.
  const tabs: Tab[] = isSeeker
    ? [{ href: '/me', label: 'My care', icon: 'care' }]
    : [
        { href: '/home', label: 'Home', icon: 'home' },
        ...((facilityIds.length > 0
          ? [{ href: '/facility', label: 'Facility', icon: 'facility' }]
          : []) as Tab[]),
        { href: '/bd', label: 'Referrer', icon: 'referrer' },
        ...((isAdmin ? [{ href: '/admin', label: 'Admin', icon: 'admin' }] : []) as Tab[]),
      ];

  return (
    <div className="min-h-screen text-slate-800">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-5">
            <Link href={isSeeker ? '/me' : '/home'} aria-label="Clear Bed Recovery — home">
              <Logo className="text-lg" />
            </Link>
            {/* Desktop nav; on mobile these live in the bottom tab bar */}
            <nav className="hidden gap-4 text-sm lg:flex">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="text-slate-600 hover:text-teal-700">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {facilityOnFree && (
              <Link
                href="/pricing"
                className="rounded-full bg-terracotta px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-terracotta-dark"
              >
                ⬆ Upgrade
              </Link>
            )}
            <AccountMenu
              email={user.email ?? ''}
              inviteHref={!isSeeker && facilityIds.length > 0 ? `/facility/${facilityIds[0]}/invite` : null}
            />
          </div>
        </div>
      </header>
      {/* pb leaves room for the fixed mobile tab bar so content is never hidden behind it */}
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:px-6 lg:py-8 lg:pb-8">{children}</main>
      <MobileTabBar tabs={tabs} />
    </div>
  );
}
