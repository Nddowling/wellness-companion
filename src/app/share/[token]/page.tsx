import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  cityState,
  directPhone,
  getSharedList,
  levelsLabel,
  programListedPaymentSummary,
} from '@/lib/partner/data';
import { Logo } from '@/components/Logo';
import { PrintButton } from '@/components/partner/PrintButton';

// Shared shortlists are unlisted capability links — never index or send their URL as a referrer.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function SharedListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getSharedList(token);
  if (!data) notFound();
  const { list, items } = data;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="Clear Bed Recovery — home">
          <Logo className="text-lg" />
        </Link>
        <PrintButton />
      </div>

      <header className="mt-8">
        <h1 className="text-2xl font-semibold text-slate-800">{list.title}</h1>
        <p className="mt-3 text-sm text-slate-500">
          Here are {items.length} treatment {items.length === 1 ? 'program' : 'programs'} to consider. Each number
          below is the program&apos;s own intake line — call them directly.
        </p>
      </header>

      <div className="mt-6 space-y-4">
        {items.map(({ facility: f }) => {
          const phone = directPhone(f);
          return (
            <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-800">{f.name}</h2>
              <p className="text-sm text-slate-500">
                {cityState(f)} · {levelsLabel(f.levels_of_care)}
              </p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Call intake</dt>
                  <dd>
                    {phone ? (
                      <a href={`tel:${phone}`} className="font-semibold text-teal-700 hover:underline">
                        {phone}
                      </a>
                    ) : (
                      <span className="text-slate-600">Call to verify</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Program-listed payment options
                  </dt>
                  <dd className="text-slate-700">{programListedPaymentSummary(f)}</dd>
                </div>
              </dl>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            This list is empty right now.
          </p>
        )}
      </div>

      <footer className="mt-10 border-t border-slate-100 pt-6 text-xs text-slate-400">
        <p>
          Shared with you via Clear Bed Recovery — a resource navigator, not a medical or crisis service. In an
          emergency call <strong>911</strong>; in crisis, call or text <strong>988</strong>.
        </p>
        <p className="mt-2">
          Programs are listed neutrally. Clear Bed does not rank or recommend one program over another.
        </p>
        <p className="mt-2">
          Payment listings do not guarantee network status, benefits, coverage, admission, or clinical suitability.
          Verify those details directly with the program, payer, and a qualified professional as appropriate.
        </p>
        <p className="mt-2">
          Shortlists use a system-generated label and contain no client name, introduction, or personal program notes.
          Anyone with this link can view and print these public program details until the partner turns sharing off.
        </p>
      </footer>
    </main>
  );
}
