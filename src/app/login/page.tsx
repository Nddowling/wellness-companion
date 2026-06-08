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
  const dest = next && next.startsWith('/') ? next : '/home';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>(isSeeker ? 'signup' : 'signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fn =
      mode === 'signin'
        ? supabase.auth.signInWithPassword({ email, password })
        : // Tag seeker sign-ups so getRoles() routes them to their care dashboard.
          supabase.auth.signUp({
            email,
            password,
            options: isSeeker ? { data: { role: 'seeker' } } : undefined,
          });
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
    router.push(mustReset ? '/reset' : dest);
    router.refresh();
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
            {isSeeker
              ? mode === 'signin'
                ? 'Sign in to pick up your search and saved conversations.'
                : 'Create a free account to find care — your conversations are saved privately so you can return anytime.'
              : mode === 'signin'
                ? 'Sign in to your provider or team account.'
                : 'Set up a provider or team account to get started.'}
          </p>

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
            <Button type="submit" size="lg" disabled={busy} className="w-full">
              {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
              }}
              className="font-medium text-teal-700 underline-offset-2 hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
