import Link from 'next/link';

import { requireAdmin } from '@/lib/auth';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/facilities', label: 'Facilities' },
  { href: '/admin/seekers', label: 'Seeker contacts' },
  { href: '/admin/claims', label: 'Claims' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-700"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
