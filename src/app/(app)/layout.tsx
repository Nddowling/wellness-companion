import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getRoles, homePathFor, profileType } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { normalizePlan } from '@/lib/facility/plan';
import { Logo } from '@/components/Logo';
import { AccountMenu } from '@/components/AccountMenu';
import { MobileTabBar, type Tab } from '@/components/MobileTabBar';
import { ReferFacilityButton } from '@/components/ReferFacilityButton';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const roles = await getRoles();
  if (!roles.user) redirect('/login'); // the authed shell always requires a session
  const { user, facilityIds } = roles;
  const profile = profileType(roles);
  const isFacility = profile === 'facility';
  const homeHref = homePathFor(roles);

  // Persistent "Upgrade" pill when the user's facility is on the Free plan.
  let facilityOnFree = false;
  if (isFacility && facilityIds.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.from('facilities').select('plan').eq('id', facilityIds[0]).maybeSingle();
    facilityOnFree = normalizePlan(data?.plan) === 'free';
  }

  // Nav is built STRICTLY from the canonical profile — each lane sees only its own
  // destinations, so the menu can never expose another profile's pages.
  const links: { href: string; label: string }[] = [];
  const tabs: Tab[] = [];
  if (profile === 'seeker') {
    links.push({ href: '/me', label: 'My care' });
    links.push({ href: '/conversations', label: 'Conversations' });
    links.push({ href: '/programs', label: 'Browse programs' });
    tabs.push({ href: '/me', label: 'My care', icon: 'care' });
    tabs.push({ href: '/conversations', label: 'Conversations', icon: 'chat' });
    tabs.push({ href: '/programs', label: 'Programs', icon: 'facility' });
  } else if (profile === 'facility') {
    links.push({ href: '/facility', label: 'My facility' });
    links.push({ href: '/pricing', label: 'Upgrade' });
    tabs.push({ href: '/facility', label: 'Facility', icon: 'facility' });
    tabs.push({ href: '/pricing', label: 'Upgrade', icon: 'home' });
  } else if (profile === 'admin') {
    links.push({ href: '/admin', label: 'Admin' });
    links.push({ href: '/match', label: 'AI chat (test)' }); // admin-only test of the seeker AI
    tabs.push({ href: '/admin', label: 'Admin', icon: 'admin' });
    tabs.push({ href: '/match', label: 'AI test', icon: 'chat' });
  } else {
    links.push({ href: '/get-started', label: 'Get started' });
    tabs.push({ href: '/get-started', label: 'Get started', icon: 'home' });
  }

  return (
    <div className="min-h-screen text-slate-800">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-5">
            <Link href={homeHref} aria-label="Clear Bed Recovery — home">
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
            {/* Referral CTA — provider (facility) accounts only; never shown to seekers. */}
            {isFacility && <ReferFacilityButton />}
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
              inviteHref={isFacility && facilityIds.length > 0 ? `/facility/${facilityIds[0]}/invite` : null}
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
