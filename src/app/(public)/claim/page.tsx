import Link from 'next/link';
import type { Metadata } from 'next';

import { Logo } from '@/components/Logo';
import { ClaimFacilityField } from '@/components/ClaimFacilityField';
import { ClaimFunnelAnalytics } from '@/components/analytics/ClaimFunnelAnalytics';
import { submitPublicClaim } from './actions';
import SiteFooter from '@/components/SiteFooter';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Claim your facility — Clear Bed Recovery',
  description:
    'Run a treatment program? Submit an ownership claim to manage your profile, bed reports, and referrals. An administrator reviews claims before granting access.',
  alternates: { canonical: '/claim' },
  // This is an account-access form with status/query variants, not durable
  // informational content. Provider discovery pages link to it directly.
  robots: { index: false, follow: true, noarchive: true },
};

const field = 'w-full rounded border border-slate-300 px-3 py-2 text-sm';

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string; facility?: string }>;
}) {
  const { submitted, error, facility } = await searchParams;

  // Deep-linked from a listing (/claim?facility=<id>) → pre-select their program so
  // they don't search for it again. Biggest friction-killer for inbound campaign traffic.
  let initial: { id: string; name: string; slug: string | null; city: string | null; state: string | null } | undefined;
  if (facility) {
    const admin = createAdminClient();
    const { data } = await admin
      .from('facilities')
      .select('id, name, slug, city, state')
      .eq('id', facility)
      .eq('is_published', true)
      .maybeSingle();
    if (data) initial = data;
  }

  return (
    <>
    <main className="mx-auto min-h-screen max-w-xl px-5 py-10">
      <ClaimFunnelAnalytics facility={initial} submitted={Boolean(submitted)} />
      <Link href="/" aria-label="Clear Bed Recovery — home">
        <Logo className="text-xl" />
      </Link>

      <h1 className="mt-8 font-serif text-3xl text-ink">
        {initial ? `Claim ${initial.name} — free` : 'Claim your facility — free'}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Manage your program&apos;s profile, keep bed availability current, and receive referrals. Tell us
        a little about you and your program. An administrator reviews each ownership claim before granting access;
        we may contact you if the submitted information is not enough.
        Once you&apos;re approved, we&apos;ll email you a link to set your password and sign in.
      </p>

      {submitted && (
        <div className="mt-6 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ Thanks — your claim is in. An administrator will review it and email you a link to set your password
          if it is approved. Already have access? <Link href="/login" className="font-medium underline">Provider login</Link>.
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Please include your email and either pick your facility or type its name.
        </div>
      )}

      {!submitted && (
        <form action={submitPublicClaim} className="mt-6 space-y-4">
          <ClaimFacilityField initial={initial} />

          <div className="grid gap-3 sm:grid-cols-2">
            <input name="claimant_name" required placeholder="Your name" className={field} />
            <input name="claimant_title" placeholder="Your role / title" className={field} />
            <input name="claimant_email" type="email" required placeholder="Work email" className={field} />
            <input name="claimant_phone" placeholder="Phone" className={field} />
          </div>

          <textarea
            name="note"
            rows={3}
            placeholder="Anything that helps us verify you (website, NPI, your role)…"
            className={field}
          />

          <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800">
            Submit ownership claim
          </button>
          <p className="text-center text-xs text-slate-500">
            An administrator reviews claims before access is granted. Already have access?{' '}
            <Link href="/login" className="font-medium text-teal-700 underline">Provider login</Link>
          </p>
        </form>
      )}
    </main>
    <SiteFooter />
    </>
  );
}
