import { Skeleton } from '@/components/ui';

// Instant route-level loading UI. Without this, navigating to /programs blocked on the
// server render (facilities_search + counts + facets over 13.5k rows) with zero feedback
// — the click appeared to do nothing for seconds. Next streams this immediately, then
// swaps in the real page. Mirrors the real layout so nothing jumps when it lands.
export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Finding programs…</span>

      {/* breadcrumb */}
      <Skeleton className="h-3 w-48" />

      {/* heading */}
      <Skeleton className="mt-4 h-8 w-2/3 max-w-sm" />
      <Skeleton className="mt-2 h-3 w-40" />

      {/* level-of-care chip rail */}
      <div className="mt-5 flex gap-1.5 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 shrink-0 rounded-full" />
        ))}
      </div>

      {/* secondary facets */}
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-32 rounded-full" />
      </div>

      {/* results grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
            <div className="mt-3 flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-5/6" />
          </div>
        ))}
      </div>
    </main>
  );
}
