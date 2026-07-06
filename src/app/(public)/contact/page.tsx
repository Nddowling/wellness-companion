import type { Metadata } from 'next';
import Link from 'next/link';

import { SITE_NAME, absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Contact Clear Bed Recovery',
  description:
    'Reach Clear Bed Recovery — a free, private directory that connects people to addiction and mental-health treatment. We’re a connector, not a treatment provider. In crisis, call or text 988.',
  alternates: { canonical: '/contact' },
  openGraph: { title: `Contact | ${SITE_NAME}`, description: 'How to reach Clear Bed Recovery.', url: absoluteUrl('/contact') },
};

const EMAIL = 'Nick.dowling@clearbedrecovery.com';
const PHONE_DISPLAY = '(904) 548-8047';
const PHONE_TEL = '+19045488047';

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      {/* Crisis resource — unmissable styled block, above everything else. Never
          monetized, never inline. */}
      <section
        role="alert"
        aria-label="Crisis resources"
        className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-600 text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4M12 16h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-bold text-rose-900">In crisis right now?</h2>
            <p className="mt-1 text-sm text-rose-900/90">
              Call or text{' '}
              <a href="tel:988" className="font-bold underline decoration-2 underline-offset-2">988</a>{' '}
              — the Suicide &amp; Crisis Lifeline, free and confidential, 24/7. For a medical emergency, call{' '}
              <a href="tel:911" className="font-bold underline decoration-2 underline-offset-2">911</a>.
            </p>
          </div>
        </div>
      </section>

      <h1 className="mt-8 font-serif text-3xl text-ink">Contact {SITE_NAME}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Clear Bed Recovery is a free, private directory that helps people find addiction and mental-health treatment that
        fits their situation, insurance, and region. We&apos;re a <strong>connector — we don&apos;t provide treatment
        ourselves</strong>, we never take per-referral or per-admission fees, and we never sell ranking.
      </p>

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">Looking for treatment</h2>
          <p className="mt-1 text-sm text-slate-600">
            The fastest way to get help is our free, private guide — answer a few questions and we&apos;ll surface programs
            that fit, with real-time availability. No account needed.
          </p>
          <Link href="/match" className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline">
            Find treatment →
          </Link>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">Run a treatment program?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Claim your free profile to manage your listing, keep bed availability current, and receive referrals. We verify
            every claim before granting access.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/claim" className="font-medium text-teal-700 hover:underline">Claim your facility →</Link>
            <a href={`mailto:${EMAIL}`} className="text-teal-700 hover:underline">Provider support: {EMAIL}</a>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">Press, partnerships &amp; data</h2>
          <p className="mt-1 text-sm text-slate-600">
            We publish original data on treatment access and availability. For press or partnership inquiries:{' '}
            <a href={`mailto:${EMAIL}`} className="font-medium text-teal-700 hover:underline">{EMAIL}</a>.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-700">General</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-slate-500">Call</dt>
              <dd><a href={`tel:${PHONE_TEL}`} className="font-medium text-teal-700 hover:underline">{PHONE_DISPLAY}</a></dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-slate-500">Email</dt>
              <dd><a href={`mailto:${EMAIL}`} className="font-medium text-teal-700 hover:underline">{EMAIL}</a></dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-slate-500">Serving</dt>
              <dd className="text-slate-700">Families nationwide · based in Georgia</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-400">
        Clear Bed Recovery is not a treatment provider and does not offer medical advice. If this is a medical emergency,
        call 911.
      </p>
    </main>
  );
}
