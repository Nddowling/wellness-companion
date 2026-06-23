import type { Metadata } from 'next';
import Link from 'next/link';

import { absoluteUrl } from '@/lib/seo';
import { getInvite } from '@/lib/rep/data';
import { RepSignupForm, type InviteContext } from '@/components/rep/RepSignupForm';

const TITLE = 'For facility teams — your professional profile, on the listings you represent';
const DESCRIPTION =
  'Business development, admissions, and marketing pros: build a free LinkedIn-style profile, attach it to your facility’s listing, and invite your colleagues. Show your work with pride.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/for-reps' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl('/for-reps') },
};

const VALUE = [
  { h: 'A profile that shines', p: 'A clean, professional page — headline, experience, the programs you represent — shareable anywhere.' },
  { h: 'Attach to your facility', p: 'Put yourself on your facility’s listing as part of the team. Goes public once your director verifies.' },
  { h: 'Bring your colleagues', p: 'Invite teammates with a link — build out your whole team’s presence together.' },
  { h: 'Free, always', p: 'No cost to you. Your director claims and runs the listing; you just represent it well.' },
];

export default async function ForRepsPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: inviteToken } = await searchParams;
  const invite = inviteToken ? await getInvite(inviteToken) : null;
  const inviteCtx: InviteContext =
    invite && invite.facility
      ? { facilityId: invite.facility.id, facilityName: invite.facility.name, inviterId: invite.inviterId }
      : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <section>
          <span className="inline-block rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
            For facility teams
          </span>
          <h1 className="mt-4 text-3xl font-semibold text-slate-800 sm:text-4xl">
            Represent your facility with pride.
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            You&apos;re the face families meet. Build a professional profile, stand on your facility&apos;s listing as
            part of the team, and bring your colleagues along — free.
          </p>

          {inviteCtx && (
            <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
              {invite?.inviterName ? <strong>{invite.inviterName}</strong> : 'A colleague'} invited you to join{' '}
              <strong>{inviteCtx.facilityName}</strong>&apos;s team. Create your profile to accept.
            </div>
          )}

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {VALUE.map((v) => (
              <div key={v.h}>
                <h3 className="text-sm font-semibold text-slate-800">{v.h}</h3>
                <p className="mt-1 text-sm text-slate-500">{v.p}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-slate-500">
            Already have a profile?{' '}
            <Link href="/login" className="font-medium text-teal-700 underline-offset-2 hover:underline">
              Sign in →
            </Link>
          </p>
        </section>

        <section className="lg:pl-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-slate-800">Create your free profile</h2>
            <p className="mt-1 text-sm text-slate-500">Live the moment you save it.</p>
            <div className="mt-6">
              <RepSignupForm invite={inviteCtx} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
