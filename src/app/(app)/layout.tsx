import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getRoles } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, facilityIds, isBd } = await getRoles();
  if (!user) redirect('/login'); // the authed shell always requires a session

  const links: { href: string; label: string }[] = [];
  if (isAdmin) links.push({ href: '/admin', label: 'Admin' });
  if (facilityIds.length > 0) links.push({ href: '/facility', label: 'My facility' });
  links.push({ href: '/bd', label: 'Referrer' }); // self-serve — always available

  return (
    <div className="min-h-screen text-slate-800">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-5">
            <Link href="/home" className="font-semibold text-teal-800">
              Wellness Companion
            </Link>
            <nav className="flex gap-4 text-sm">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="text-slate-600 hover:text-teal-700">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <span className="text-xs text-slate-500">{user?.email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
