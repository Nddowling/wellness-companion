import Link from 'next/link';

import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  // Pending-work counts → "needs attention" badges in the nav.
  const supabase = createAdminClient();
  const [claims, reviews] = await Promise.all([
    supabase.from('facility_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('facility_reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const NAV: { href: string; label: string; count?: number }[] = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/facilities', label: 'Facilities' },
    { href: '/admin/seekers', label: 'Seeker contacts' },
    { href: '/admin/claims', label: 'Claims', count: claims.count ?? 0 },
    { href: '/admin/reviews', label: 'Reviews', count: reviews.count ?? 0 },
  ];

  return (
    <div className="space-y-5">
      <nav
        aria-label="Admin sections"
        className="flex snap-x gap-1 overflow-x-auto rounded-lg bg-white p-1 ring-1 ring-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-700"
          >
            {n.label}
            {n.count ? (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                {n.count}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
