'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { PARTNER_TYPE_GROUPS } from '@/lib/partner/types';
import { Button, Input, Label } from '@/components/ui';

/**
 * Lightweight Partner self-signup. Unlike facilities (verified claim only), partners
 * are wide-open: name + email + password + how-you-refer, and they're in. Creates the
 * auth user (tagged for post-confirmation provisioning) and the canonical
 * bd_users profile row. Authorization never trusts the metadata tag by itself.
 */
export function PartnerSignupForm() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    partner_type: '',
    title: '',
    employer: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          role: 'partner',
          full_name: form.name.trim(),
          partner_type: form.partner_type,
          professional_title: form.title.trim() || null,
          employer: form.employer.trim() || null,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/partners`,
      },
    });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    // No active session means email confirmation is required — tell them to check.
    if (!data.session) {
      setBusy(false);
      setCheck(true);
      return;
    }
    const provisioned = await fetch('/api/auth/provision', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (!provisioned.ok) {
      setBusy(false);
      setError('Your account was created, but the Partner profile could not be completed. Please sign in and try again.');
      return;
    }
    router.push('/partners');
    router.refresh();
  }

  if (check) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <strong>Almost there.</strong> We sent a confirmation link to {form.email}. Open it and you&apos;ll land in
        your Partner dashboard.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="p-name">Your name</Label>
          <Input id="p-name" required value={form.name} onChange={set('name')} placeholder="Jordan Rivera" />
        </div>
        <div>
          <Label htmlFor="p-email">Work email</Label>
          <Input id="p-email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@organization.org" />
        </div>
      </div>

      <div>
        <Label htmlFor="p-type">How do you refer people?</Label>
        <select
          id="p-type"
          required
          value={form.partner_type}
          onChange={set('partner_type')}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
        >
          <option value="" disabled>
            Select your role…
          </option>
          {PARTNER_TYPE_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="p-title">Title (optional)</Label>
          <Input id="p-title" value={form.title} onChange={set('title')} placeholder="Discharge Planner" />
        </div>
        <div>
          <Label htmlFor="p-org">Organization (optional)</Label>
          <Input id="p-org" value={form.employer} onChange={set('employer')} placeholder="Grady Memorial Hospital" />
        </div>
      </div>

      <div>
        <Label htmlFor="p-pass">Create a password</Label>
        <Input id="p-pass" type="password" required autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="••••••••" />
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy ? 'Creating your account…' : 'Create my free Partner account'}
      </Button>
      <p className="text-center text-xs text-slate-400">Free for everyone who refers. No facility billing, ever.</p>
    </form>
  );
}
