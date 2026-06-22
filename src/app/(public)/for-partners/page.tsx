import type { Metadata } from 'next';
import Link from 'next/link';

import { absoluteUrl } from '@/lib/seo';
import { PartnerSignupForm } from '@/components/partner/PartnerSignupForm';

const TITLE = 'For Partners — the free referral directory for people who place others into care';
const DESCRIPTION =
  'Discharge planners, social workers, coaches, clergy, and court coordinators: search every treatment program, save your go-to facilities, and build a shortlist to hand a family — free, forever.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/for-partners' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl('/for-partners') },
};

const VALUE = [
  {
    h: 'The whole directory, neutral',
    p: 'Every program — inpatient and outpatient — searchable by level of care, location, and insurance. No pay-to-rank: results are need-based, always.',
  },
  {
    h: 'Their own direct line',
    p: 'Every listing shows the facility’s real intake number — never a routed or brokered line. Call who you mean to call.',
  },
  {
    h: 'Save your go-to programs',
    p: 'Star the places you trust so they’re one tap away the next time you’re placing someone.',
  },
  {
    h: 'Hand families a shortlist',
    p: 'Build a clean, printable list of options and share it with a link — your white-glove handoff to a Recovery Friend.',
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
            The directory behind every good referral.
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            You&apos;re the person someone turns to in their hardest moment. Clear Bed gives you a fast, calm way to
            find the right program and hand it off with confidence — free, because you should never pay to help
            someone find care.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {VALUE.map((v) => (
              <div key={v.h}>
                <h3 className="text-sm font-semibold text-slate-800">{v.h}</h3>
                <p className="mt-1 text-sm text-slate-500">{v.p}</p>
              </div>
            ))}
          </div>

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
