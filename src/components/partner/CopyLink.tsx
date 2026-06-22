'use client';

import { useState } from 'react';

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the input is selectable as a fallback */
    }
  }
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600"
      />
      <button
        type="button"
        onClick={copy}
        className="whitespace-nowrap rounded-md bg-teal-700 px-3 py-2 text-xs font-medium text-white hover:bg-teal-800"
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  );
}
