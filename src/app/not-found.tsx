import Link from 'next/link';

import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <Link href="/" aria-label="Clear Bed Recovery — home">
        <Logo className="text-xl" />
      </Link>
      <h1 className="mt-10 text-2xl font-semibold text-slate-800">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The page may have moved or no longer exists. You can find a treatment program or head back home.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/match"
          className="rounded-md bg-terracotta px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-terracotta-dark"
        >
          Find care →
        </Link>
        <Link
          href="/programs"
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-teal-400"
        >
          Browse programs
        </Link>
        <Link
          href="/"
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-teal-400"
        >
          Home
        </Link>
      </div>
      <p className="mt-10 text-xs text-slate-400">
        In an emergency call <strong>911</strong>. In crisis, call or text <strong>988</strong> — anytime.
      </p>
    </main>
  );
}
