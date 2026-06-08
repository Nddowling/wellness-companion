'use client';

import { useState } from 'react';

// Header CTA for provider (facility) accounts only. Opens a modal where they enter a
// facility they want to refer; when that facility starts a paid plan they earn 50%
// off their next month (two paid referrals = a free month, up to 3 free months).
export function ReferFacilityButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ referred_name: '', referred_email: '', referred_phone: '', referred_note: '' });

  function reset() {
    setForm({ referred_name: '', referred_email: '', referred_phone: '', referred_note: '' });
    setError(null);
    setDone(false);
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not save the referral.');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';

  return (
    <>
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="rounded-full bg-terracotta px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-terracotta-dark"
      >
        ＋ Refer &amp; earn
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">✓</div>
                <h2 className="text-lg font-semibold text-slate-800">Referral sent</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Thanks! When <strong>{form.referred_name || 'they'}</strong> starts a paid plan, you&apos;ll get 50%
                  off your next month. Track it on your dashboard.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-4 w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Refer a facility</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    For every paid facility you refer, get <strong>50% off your next month</strong> — two paid
                    referrals = a free month, up to <strong>3 free months</strong> (6 paid referrals).
                  </p>
                </div>
                <input
                  required
                  placeholder="Facility name"
                  value={form.referred_name}
                  onChange={(e) => setForm((f) => ({ ...f, referred_name: e.target.value }))}
                  className={field}
                />
                <input
                  required
                  type="email"
                  placeholder="Their contact email"
                  value={form.referred_email}
                  onChange={(e) => setForm((f) => ({ ...f, referred_email: e.target.value }))}
                  className={field}
                />
                <input
                  placeholder="Their phone (optional)"
                  value={form.referred_phone}
                  onChange={(e) => setForm((f) => ({ ...f, referred_phone: e.target.value }))}
                  className={field}
                />
                <textarea
                  rows={2}
                  placeholder="Anything we should know? (optional)"
                  value={form.referred_note}
                  onChange={(e) => setForm((f) => ({ ...f, referred_note: e.target.value }))}
                  className={field}
                />
                {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-md border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:border-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {busy ? 'Sending…' : 'Send referral'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
