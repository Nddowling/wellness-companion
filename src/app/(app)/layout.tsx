import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getRoles } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { signOut } from './actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, facilityIds, isSeeker } = await getRoles();
  if (!user) redirect('/login'); // the authed shell always requires a session

  const links: { href: string; label: string }[] = [];
  if (isSeeker) {
    links.push({ href: '/me', label: 'My care' });
  } else {
    if (isAdmin) links.push({ href: '/admin', label: 'Admin' });
    if (facilityIds.length > 0) links.push({ href: '/facility', label: 'My facility' });
    links.push({ href: '/bd', label: 'Referrer' }); // self-serve — always available
  }

  return (
    <div className="min-h-screen text-slate-800">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-5">
            <Link href={isSeeker ? '/me' : '/home'} aria-label="Clear Bed Recovery — home">
              <Logo className="text-lg" />
            </Link>
            <nav className="flex gap-4 text-sm">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="text-slate-600 hover:text-teal-700">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">{user.email}</span>
            <form action={signOut}>
              <button className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-teal-400">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
