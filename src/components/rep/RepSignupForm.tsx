'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { Button, Input, Label } from '@/components/ui';

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'rep'
  );
}

export type InviteContext = { facilityId: string; facilityName: string; inviterId: string } | null;

/**
 * Free, self-serve Rep signup. Creates the auth user (role=rep), the LinkedIn-style
 * rep_profiles row (live immediately), and — if they arrived via a colleague's invite
 * — a pending affiliation to that facility.
 */
export function RepSignupForm({ invite }: { invite?: InviteContext }) {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', headline: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { role: 'rep', full_name: form.name.trim(), phone: form.phone.trim() || null } },
    });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    if (!data.session) {
      setBusy(false);
      setCheck(true);
      return;
    }
    const userId = data.user?.id;
    if (userId) {
      const slug = `${slugify(form.name)}-${crypto.randomUUID().slice(0, 6)}`;
      await supabase.from('rep_profiles').insert({
        user_id: userId,
        slug,
        display_name: form.name.trim() || 'Recovery professional',
        headline: form.headline.trim() || null,
      });
      if (invite) {
        await supabase.from('facility_affiliations').insert({
          user_id: userId,
          facility_id: invite.facilityId,
          status: 'pending',
          invited_by: invite.inviterId,
        });
      }
    }
    router.push('/rep');
    router.refresh();
  }

  if (check) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <strong>Almost there.</strong> We sent a confirmation link to {form.email}. Confirm it, then sign in to
        finish your profile.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="r-name">Your name</Label>
          <Input id="r-name" required value={form.name} onChange={set('name')} placeholder="Jordan Rivera" />
        </div>
        <div>
          <Label htmlFor="r-email">Work email</Label>
          <Input id="r-email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@facility.com" />
        </div>
      </div>
      <div>
        <Label htmlFor="r-phone">Phone</Label>
        <Input id="r-phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 123-4567" />
      </div>
      <div>
        <Label htmlFor="r-headline">Headline</Label>
        <Input id="r-headline" value={form.headline} onChange={set('headline')} placeholder="Admissions Director · 8 yrs in recovery care" />
      </div>
      <div>
        <Label htmlFor="r-pass">Create a password</Label>
        <Input id="r-pass" type="password" required autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="••••••••" />
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy ? 'Creating your profile…' : 'Create my free profile'}
      </Button>
      <p className="text-center text-xs text-slate-400">
        Free, always. Your profile goes live immediately — you can add your facility and invite colleagues next.
      </p>
    </form>
  );
}
