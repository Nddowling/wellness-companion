'use client';

import { useEffect, useState } from 'react';

import { requestClaim } from '@/app/(app)/facility/actions';
import { US_STATES } from '@/lib/geo';

type Hit = { id: string; name: string; city: string | null; state: string | null };

// Search-as-you-type facility picker for the claim flow. Scales to any number of
// facilities — it queries /api/facilities/search instead of loading the full list.
export function FacilityPicker() {
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selected) return; // a selection is locked in — stop searching
    if (!q.trim() && !state) {
      setHits([]);
      return;
    }
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
  }, [q, state, selected]);

  return (
    <form action={requestClaim} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <div className="text-lg font-semibold text-slate-800">I represent a facility</div>
      <p className="text-sm text-slate-500">Search for your program, then request to manage its profile and beds.</p>

      {selected ? (
        <div className="flex items-center justify-between rounded-md border border-teal-300 bg-teal-50 px-3 py-2">
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
        <>
          <div className="flex flex-wrap gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by program name or city…"
              autoFocus
              className="min-w-[12rem] flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
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
            <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
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
        </>
      )}

      <input type="hidden" name="facility_id" value={selected?.id ?? ''} />
      <input
        name="note"
        placeholder="Your role (optional)"
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        disabled={!selected}
        className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Request access
      </button>
    </form>
  );
}
