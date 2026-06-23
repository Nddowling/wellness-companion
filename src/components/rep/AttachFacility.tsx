'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { addAffiliationAction } from '@/app/(app)/rep/actions';

type Hit = { id: string; name: string; city: string | null; state: string | null };

/** Search the published directory and attach yourself (pending) to your facility. */
export function AttachFacility() {
  const supabase = createClient();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const needle = q.replace(/[,()%]/g, ' ').trim();
    if (!needle) return;
    setBusy(true);
    const { data } = await supabase
      .from('facilities')
      .select('id, name, city, state')
      .eq('is_published', true)
      .or(`name.ilike.%${needle}%,city.ilike.%${needle}%`)
      .order('name')
      .limit(10);
    setHits((data ?? []) as Hit[]);
    setBusy(false);
    setSearched(true);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your facility by name or city…"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button disabled={busy} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
          {busy ? '…' : 'Search'}
        </button>
      </form>

      {searched && hits.length === 0 && (
        <p className="text-xs text-slate-500">No match. Try the facility&apos;s name or city.</p>
      )}

      <div className="space-y-2">
        {hits.map((h) => (
          <form
            key={h.id}
            action={addAffiliationAction}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
          >
            <input type="hidden" name="facility_id" value={h.id} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-800">{h.name}</div>
              <div className="text-xs text-slate-500">{[h.city, h.state].filter(Boolean).join(', ') || '—'}</div>
            </div>
            <input
              name="title"
              placeholder="Your title here"
              className="w-36 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
            />
            <button className="rounded-full bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800">
              + Attach
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
