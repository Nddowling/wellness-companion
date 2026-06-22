'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { Button, Input, Label } from '@/components/ui';
import { Logo } from '@/components/Logo';

// useSearchParams() requires a Suspense boundary in this Next version.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  // A seeker arrives via /login?role=seeker&next=/match (the care funnel); everyone
  // else is a provider/team member. `next` is where we send them after auth.
  const isSeeker = params.get('role') === 'seeker';
  const next = params.get('next');
  // Same-origin paths only — reject protocol-relative ("//evil.com") open redirects.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  const dest = safeNext ?? '/home';
  // Coming from a plan CTA: we'll resume Stripe checkout straight after sign-in.
  const resumingCheckout = !!safeNext && safeNext.startsWith('/api/checkout');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Providers NEVER self-sign-up: claiming + admin verification is the only door in
  // (see claim/actions.ts). Only seekers may create an account from this page.
  const [mode, setMode] = useState<'signin' | 'signup'>(isSeeker ? 'signup' : 'signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // API destinations (e.g. resume checkout) need a real navigation to run the handler.
  function go(d: string) {
    if (d.startsWith('/api/')) window.location.assign(d);
    else {
      router.push(d);
      router.refresh();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fn =
      mode === 'signin'
        ? supabase.auth.signInWithPassword({ email, password })
        : // Only seekers reach signup here — tag them so getRoles() routes them to care.
          supabase.auth.signUp({ email, password, options: { data: { role: 'seeker' } } });
    const { data, error } = await fn;
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Temp-password accounts (approved providers, mid-chat seekers) must choose a real
    // password before anything else.
    const mustReset = (data?.user?.user_metadata as { must_reset_password?: boolean } | undefined)
      ?.must_reset_password;
    go(mustReset ? '/reset' : dest);
  }

  // Self-service password recovery: emails a link back to /reset (which lets the
  // recovered session set a new password). Standard, and prevents lockout.
  async function handleForgot() {
    if (!email) {
      setError('Enter your email above first, then tap “Forgot password”.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResetSent(true);
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — gives the sign-in a sense of place instead of a bare form. */}
      <section className="relative isolate hidden overflow-hidden lg:block">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/facility.jpg')" }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-ink/90 via-brand/85 to-brand/65" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/70 via-transparent to-ink/30" />
        <div className="flex h-full flex-col justify-between p-12 text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
          <Link href="/" aria-label="Clear Bed Recovery — home">
            <Logo tone="light" className="text-xl" />
          </Link>
          <div className="max-w-md">
            <h2 className="h2 text-white">The live directory behind every good referral.</h2>
            <p className="lead mt-3" style={{ color: '#fff' }}>
              Sign in to keep your beds and profile current, browse programs, and track the people
              you&apos;re helping into care.
            </p>
          </div>
          <p className="text-xs text-white/75">
            A resource navigator — not a medical or crisis service.
          </p>
        </div>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <Link href="/" aria-label="Clear Bed Recovery — home" className="mb-8 inline-block lg:hidden">
            <Logo className="text-xl" />
          </Link>
          <h1 className="h1 text-ink">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {resumingCheckout
              ? 'Sign in to continue — we’ll take you straight to checkout to start your plan.'
              : isSeeker
                ? mode === 'signin'
                  ? 'Sign in to pick up your search and saved conversations.'
                  : 'Create a free account to find care — your conversations are saved privately so you can return anytime.'
                : 'Sign in to your provider or team account.'}
          </p>

          {/* Seeker escape — this page is for providers; never trap someone seeking care. */}
          {!isSeeker && (
            <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800">
              Looking for treatment?{' '}
              <Link href="/match" className="font-semibold underline underline-offset-2">
                Find care →
              </Link>{' '}
              — free, and no account needed to start.
            </p>
          )}

          {/* Partner door — referrers self-signup (unlike verified facilities). */}
          {!isSeeker && (
            <p className="mt-2 text-xs text-slate-500">
              Refer people into care?{' '}
              <Link href="/for-partners" className="font-medium text-teal-700 underline-offset-2 hover:underline">
                Join as a Partner →
              </Link>
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@organization.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            {resetSent && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Check your inbox — we sent a link to reset your password.
              </p>
            )}
            {mode === 'signin' && (
              <button
                type="button"
                onClick={handleForgot}
                disabled={busy}
                className="-mt-1 self-start text-xs font-medium text-teal-700 underline-offset-2 hover:underline disabled:opacity-50"
              >
                Forgot password?
              </button>
            )}
            <Button type="submit" size="lg" disabled={busy} className="w-full">
              {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          {isSeeker ? (
            <p className="mt-6 text-center text-sm text-slate-500">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setResetSent(false);
                  setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                }}
                className="font-medium text-teal-700 underline-offset-2 hover:underline"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          ) : (
            // Providers don't self-sign-up — point newcomers to the verified claim flow.
            <p className="mt-6 text-center text-sm text-slate-500">
              Run a treatment program?{' '}
              <Link href="/claim" className="font-medium text-teal-700 underline-offset-2 hover:underline">
                Claim your facility →
              </Link>
              <span className="mt-1 block text-xs text-slate-400">
                We verify every program and set up your account once you&apos;re approved.
              </span>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
