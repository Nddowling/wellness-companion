'use client';

import Link from 'next/link';

// Route-segment error boundary (renders inside the root layout).
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-800">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Sorry — an unexpected error occurred on our end. You can try again, or head back home.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Try again
        </button>
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
