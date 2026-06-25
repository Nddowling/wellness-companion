'use client';

import { useEffect, useState } from 'react';

import { US_STATES } from '@/lib/geo';

type Hit = { id: string; name: string; city: string | null; state: string | null };

const field = 'w-full rounded border border-slate-300 px-3 py-2 text-sm';

// Search-as-you-type facility selector for the PUBLIC claim form. Queries
// /api/facilities/search (so it scales past any list size) and sets the hidden
// facility_id — or a freetext fallback — that submitPublicClaim reads. Renders NO
// <form> of its own: it lives inside the claim page's server-action form.
export function ClaimFacilityField({ initial }: { initial?: Hit }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  // Pre-selected when the visitor deep-linked from their own listing (/claim?facility=…),
  // so they never have to search for their own program.
  const [selected, setSelected] = useState<Hit | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [notListed, setNotListed] = useState(false);
  const [freetext, setFreetext] = useState('');
  const [addLoc, setAddLoc] = useState('');
  const [addWeb, setAddWeb] = useState('');

  useEffect(() => {
    if (selected || notListed) return; // locked in — stop searching
    // Nothing to search — the results dropdown is gated on (q || state), so stale
    // hits stay hidden without a sync setState here.
    if (!q.trim() && !state) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (state) params.set('state', state);
        const res = await fetch(`/api/facilities/search?${params.toString()}`, { signal: ctrl.signal });
        const data = await res.json();
        setHits(Array.isArray(data.facilities) ? data.facilities : []);
      } catch {
        /* aborted or failed — leave prior hits */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, state, selected, notListed]);

  return (
    <div>
      <label className="text-sm font-medium text-slate-700">Your facility</label>

      {/* The values submitPublicClaim reads. For a manual add we fold name + location +
          website into the freetext so an admin has enough to create the listing. */}
      <input type="hidden" name="facility_id" value={selected?.id ?? ''} />
      <input
        type="hidden"
        name="facility_name_freetext"
        value={notListed ? [freetext, addLoc, addWeb].filter((v) => v.trim()).join(' — ') : ''}
      />

      {notListed ? (
        <div className="mt-1 space-y-2">
          <input
            value={freetext}
            onChange={(e) => setFreetext(e.target.value)}
            placeholder="Facility / program name"
            className={field}
            autoFocus
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={addLoc} onChange={(e) => setAddLoc(e.target.value)} placeholder="City, State" className={field} />
            <input value={addWeb} onChange={(e) => setAddWeb(e.target.value)} placeholder="Website (optional)" className={field} />
          </div>
          <p className="text-xs text-slate-500">New to us? We&apos;ll review and add your program before granting access.</p>
          <button
            type="button"
            onClick={() => {
              setNotListed(false);
              setFreetext('');
              setAddLoc('');
              setAddWeb('');
            }}
            className="text-xs font-medium text-teal-700 underline"
          >
            ← Search the directory instead
          </button>
        </div>
      ) : selected ? (
        <div className="mt-1 flex items-center justify-between rounded-md border border-teal-300 bg-teal-50 px-3 py-2">
          <div>
            <div className="text-sm font-medium text-slate-800">{selected.name}</div>
            <div className="text-xs text-slate-500">
              {[selected.city, selected.state].filter(Boolean).join(', ') || '—'}
            </div>
          </div>
          <button type="button" onClick={() => setSelected(null)} className="text-xs font-medium text-teal-700 underline">
            Change
          </button>
        </div>
      ) : (
        <div className="mt-1 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by program name or city…"
              className={`${field} sm:flex-1`}
            />
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              <option value="">All states</option>
              {Object.entries(US_STATES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {(q.trim() || state) && (
            <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200">
              {loading && <div className="px-3 py-2 text-sm text-slate-400">Searching…</div>}
              {!loading && hits.length === 0 && (
                <div className="px-3 py-2 text-sm text-slate-400">No matches — try a different spelling or city.</div>
              )}
              {hits.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => setSelected(h)}
                  className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-teal-50"
                >
                  <span className="font-medium text-slate-800">{h.name}</span>
                  <span className="block text-xs text-slate-500">
                    {[h.city, h.state].filter(Boolean).join(', ') || '—'}
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setNotListed(true)}
            className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100"
          >
            ＋ Don&apos;t see your program? Add it for review →
          </button>
        </div>
      )}
    </div>
  );
}
