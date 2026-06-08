'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { Button, Input, Label } from '@/components/ui';
import { Logo } from '@/components/Logo';

// Set-a-new-password step. Both providers (after a claim is approved) and seekers
// (after they share contact info mid-chat) are created with a temporary password and
// a `must_reset_password` flag. They sign in with the temp password — which gives them
// a session — then land here to choose a real password. Login is by email, so there's
// no username to set; we just capture an optional display name.

// Standard password rules: ≥8 chars, with an upper- and lower-case letter and a number.
function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[a-z]/.test(pw)) return 'Include a lowercase letter.';
  if (!/[A-Z]/.test(pw)) return 'Include an uppercase letter.';
  if (!/[0-9]/.test(pw)) return 'Include a number.';
  return null;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A session is required to change a password. If they arrived here without one
  // (e.g. an expired temp login), send them to sign in first.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        router.replace('/login');
      } else {
        setReady(true);
        const existing = (data.user.user_metadata as { name?: string } | undefined)?.name;
        if (existing) setName(existing);
      }
    });
    return () => {
      active = false;
    };
  }, [supabase, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('Those passwords don’t match.');

    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_reset_password: false, ...(name.trim() ? { name: name.trim() } : {}) },
    });
    setBusy(false);
    if (error) return setError(error.message);
    // /home routes them to the start of their lane (facility dashboard or /me).
    router.push('/home');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Logo className="mb-8 text-xl" />
        <h1 className="h1 text-ink">Set your password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome! Choose a password to finish setting up your account. You’ll sign in with your email
          and this password from now on.
        </p>

        {!ready ? (
          <p className="mt-7 text-sm text-slate-400">One moment…</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            <div>
              <Label htmlFor="name">Your name (optional)</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Smith" />
            </div>
            <div>
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-slate-400">At least 8 characters, with a capital letter and a number.</p>
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" size="lg" disabled={busy} className="w-full">
              {busy ? 'Saving…' : 'Save password'}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
