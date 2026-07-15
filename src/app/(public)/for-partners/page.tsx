import type { Metadata } from 'next';
import Link from 'next/link';

import { absoluteUrl } from '@/lib/seo';
import { PartnerSignupForm } from '@/components/partner/PartnerSignupForm';

const TITLE = 'For Partners — free tools for comparing published treatment program records';
const DESCRIPTION =
  'Discharge planners, social workers, coaches, clergy, and court coordinators can compare published program records, save options, and share a non-identifying shortlist for free.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/for-partners' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl('/for-partners') },
};

const VALUE = [
  {
    h: 'The whole directory, neutral',
    p: 'Search all published directory records by level of care, location, and program-listed payment category. Results are alphabetical and provider payment does not change the order.',
  },
  {
    h: 'Source-listed direct contact',
    p: 'When a direct facility or intake number is available, the listing shows it rather than substituting a brokered tracking line.',
  },
  {
    h: 'Save programs to revisit',
    p: 'Star published program records so they are one tap away when you need to compare options again.',
  },
  {
    h: 'Share a non-identifying shortlist',
    p: 'Build a printable list of public program options with a system-generated label. Client names and personal notes are not collected.',
  },
];

export default function ForPartnersPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <section>
          <span className="inline-block rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
            For Partners
          </span>
          <h1 className="mt-4 text-3xl font-semibold text-slate-800 sm:text-4xl">
            A neutral directory for referral research.
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Compare published program options, contact programs directly, and confirm level of care, availability,
            payment details, and suitability with the appropriate program, payer, and qualified professional.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {VALUE.map((v) => (
              <div key={v.h}>
                <h3 className="text-sm font-semibold text-slate-800">{v.h}</h3>
                <p className="mt-1 text-sm text-slate-500">{v.p}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-slate-500">
            Program-listed payment options do not guarantee network status, benefits, coverage, admission, or
            clinical suitability. Clear Bed does not determine fit or recommend one program over another.
          </p>

          <p className="mt-8 text-sm text-slate-500">
            Already have a Partner account?{' '}
            <Link href="/login" className="font-medium text-teal-700 underline-offset-2 hover:underline">
              Sign in →
            </Link>
          </p>
        </section>

        <section className="lg:pl-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-slate-800">Create your free Partner account</h2>
            <p className="mt-1 text-sm text-slate-500">Takes about a minute. Then you&apos;re in.</p>
            <div className="mt-6">
              <PartnerSignupForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
