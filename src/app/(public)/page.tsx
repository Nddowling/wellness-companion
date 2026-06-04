import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-800">
          You don&apos;t have to figure this out alone.
        </h1>
        <p className="text-lg text-slate-600">
          Wellness Companion helps you find addiction and mental-health treatment that actually fits
          — your situation, your coverage, your needs. No account required to start.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/match"
          className="rounded-md bg-terracotta px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-terracotta-dark"
        >
          Find care — start here →
        </Link>
        <Link href="/login" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:border-teal-300">
          Team sign in
        </Link>
      </div>

      <p className="text-xs text-slate-400">
        If you are in immediate danger or crisis, call or text 988 (Suicide &amp; Crisis Lifeline).
      </p>
    </main>
  );
}
