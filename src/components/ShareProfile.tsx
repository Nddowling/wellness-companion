'use client';

import { useState } from 'react';

// Dashboard "share your profile" tool — turns a facility's neutral ClearBed page
// into something their outreach/BD team uses daily: a copyable link, an
// email-signature line, and a QR code for printed referral packets and cards.
// "Look us up on ClearBed" = third-party credibility in every referral meeting.
export function ShareProfile({ profileUrl, facilityName }: { profileUrl: string; facilityName: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const signature = `Find ${facilityName} on ClearBed — the neutral treatment directory: ${profileUrl}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(profileUrl)}`;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      // clipboard blocked — the readonly field is still selectable as a fallback
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Share your profile</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        A neutral, third-party page that backs up your pitch. Drop it in your email signature, referral packets, and
        every outreach meeting — &ldquo;look us up on ClearBed.&rdquo;
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt={`QR code linking to ${facilityName} on ClearBed`}
          width={112}
          height={112}
          className="h-28 w-28 shrink-0 rounded border border-slate-200"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-2">
            <input
              readOnly
              value={profileUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-600"
            />
            <button
              onClick={() => copy(profileUrl, 'url')}
              className="shrink-0 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-800"
            >
              {copied === 'url' ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <button
            onClick={() => copy(signature, 'sig')}
            className="rounded-md border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-700 hover:text-white"
          >
            {copied === 'sig' ? 'Copied signature line' : 'Copy email-signature line'}
          </button>
        </div>
      </div>
    </section>
  );
}
