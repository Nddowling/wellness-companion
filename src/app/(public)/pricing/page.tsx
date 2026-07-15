import type { Metadata } from 'next';
import Link from 'next/link';

import { PricingTable, type BillingFacilityOption } from '@/components/PricingTable';
import SiteFooter from '@/components/SiteFooter';
import { hasManagedBilling, isBillingCycle, isBillingPlan, isUuid } from '@/lib/billing/guards';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Pricing — Clear Bed Recovery',
  description:
    'Simple flat-fee plans for treatment programs. Facilities pay; people seeking care never do. No per-referral fees — ever.',
  alternates: { canonical: '/pricing' },
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string; facility?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let membershipCount = 0;
  let facilities: BillingFacilityOption[] = [];

  if (user) {
    const { data: memberships } = await supabase
      .from('facility_members')
      .select('facility_id, role')
      .eq('user_id', user.id);
    membershipCount = memberships?.length ?? 0;
    const ownerIds = (memberships ?? [])
      .filter((membership) => membership.role === 'owner')
      .map((membership) => membership.facility_id);
    if (ownerIds.length > 0) {
      const { data } = await supabase
        .from('facilities')
        .select('id, name, plan, plan_status, stripe_subscription_id')
        .in('id', ownerIds)
        .order('name');
      facilities = (data ?? []).map((facility) => ({
        id: facility.id,
        name: facility.name,
        billingManaged: hasManagedBilling(facility),
      }));
    }
  }

  const initialPlan = isBillingPlan(query.plan) ? query.plan : null;
  const initialCycle = isBillingCycle(query.cycle) ? query.cycle : 'monthly';
  const initialFacilityId = isUuid(query.facility) ? query.facility : null;

  return (
    <>
    <main className="text-slate-800">
      <section className="mx-auto max-w-5xl px-6 pb-2 pt-16 text-center">
        <span className="eyebrow text-teal-700">For treatment programs</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
          Simple, flat pricing
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-500">
          Programs can claim a complete public profile free. Paid plans add the in-app analytics and lead-status
          workflow described below.
          People seeking care <strong>never</strong> pay.
        </p>
        {/* Seeker escape — this is provider pricing; never let someone seeking care think they'd pay. */}
        <p className="mx-auto mt-4 max-w-xl rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Looking for treatment for yourself or someone else?{' '}
          <Link href="/match" className="font-semibold underline underline-offset-2">
            Find care →
          </Link>{' '}
          — always free, no account needed.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-8">
        <PricingTable
          facilities={facilities}
          initialCycle={initialCycle}
          initialFacilityId={initialFacilityId}
          initialPlan={initialPlan}
          isSignedIn={!!user}
          membershipCount={membershipCount}
        />
      </section>

      <section className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-xl border border-slate-200 bg-mist/60 p-5 text-sm text-slate-600">
          <h3 className="font-semibold text-slate-800">Flat fees — always</h3>
          <p className="mt-1">
            We never charge per referral, per lead, or per admission. Subscriptions are flat facility fees for the
            implemented in-app analytics and workflow shown on this page; payment does not affect matching or access
            to seeker-consented contact details.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <h2 className="text-xl font-semibold text-slate-800">Not sure where to start?</h2>
        <p className="mt-2 text-sm text-slate-500">
          List your program for free today — you can upgrade to a paid plan anytime.
        </p>
        <Link
          href="/claim"
          className="mt-4 inline-block rounded-md bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Get your free listing →
        </Link>
      </section>
    </main>
    <SiteFooter />
    </>
  );
}
