'use client';

import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';

import { LEVEL_LABELS, LEVELS_OF_CARE, PAYER_LABELS, PAYER_TYPES, type LevelOfCare } from '@/lib/constants';
import { parseSearchLocation, type SearchLocation } from '@/lib/search/directory-language';

const STORAGE_KEY = 'clearbed:location-search:v1';
const SPECIALTIES = new Set(['occurring', 'trauma', 'mat', 'substance']);
const POPULATIONS = new Set(['men', 'women', 'adolescent', 'young adult', 'veteran', 'senior', 'pregnant']);

type Filters = { level?: string; pay?: string; spec?: string; pop?: string; open?: boolean };
type Search = { location: SearchLocation; filters: Filters };
type ResultRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  levels: string[];
  miles: number | null;
  bedLabel: string;
  bedTone: string;
  paymentSummary: string;
};
type SearchResponse =
  | { status: 'ok'; origin: { label: string; kind: string }; rows: ResultRow[]; total: number; page: number; pageSize: number; distanceBasis: string }
  | { status: 'ambiguous'; city: string; states: { code: string; name: string }[] }
  | { status: 'error'; message: string };
type FetchState = { key: string; result: SearchResponse | null; error: string };

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function locationLabel(location: SearchLocation): string {
  return location.kind === 'zip'
    ? location.zip
    : `${location.city}${location.state ? `, ${location.state}` : ''}`;
}

function readStoredSearch(): Search | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const stored = value as { location?: unknown; filters?: unknown };
    if (!stored.location || typeof stored.location !== 'object') return null;
    const candidate = stored.location as { kind?: unknown; zip?: unknown; city?: unknown; state?: unknown };
    const location = candidate.kind === 'zip' && typeof candidate.zip === 'string'
      ? parseSearchLocation(candidate.zip)
      : candidate.kind === 'city' && typeof candidate.city === 'string' &&
          (candidate.state === undefined || typeof candidate.state === 'string')
        ? parseSearchLocation(`${candidate.city}${candidate.state ? `, ${candidate.state}` : ''}`)
        : undefined;
    if (!location || location.kind !== candidate.kind) return null;

    const input = stored.filters && typeof stored.filters === 'object'
      ? stored.filters as Record<string, unknown>
      : {};
    const filters: Filters = {};
    if (typeof input.level === 'string' && (LEVELS_OF_CARE as readonly string[]).includes(input.level)) filters.level = input.level;
    if (typeof input.pay === 'string' && (PAYER_TYPES as readonly string[]).includes(input.pay)) filters.pay = input.pay;
    if (typeof input.spec === 'string' && SPECIALTIES.has(input.spec)) filters.spec = input.spec;
    if (typeof input.pop === 'string' && POPULATIONS.has(input.pop)) filters.pop = input.pop;
    if (input.open === true && (!filters.level || filters.level === 'residential')) filters.open = true;
    return { location, filters };
  } catch {
    return null;
  }
}

function bedClass(tone: string): string {
  if (tone === 'green') return 'bg-emerald-50 text-emerald-800';
  if (tone === 'amber') return 'bg-amber-50 text-amber-900';
  return 'bg-slate-100 text-slate-600';
}

export default function NearbyResultsClient() {
  const loaded = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const initialSearch = useMemo(() => loaded ? readStoredSearch() : null, [loaded]);
  const [updatedSearch, setUpdatedSearch] = useState<Search | null>(null);
  const search = updatedSearch ?? initialSearch;
  const [locationInput, setLocationInput] = useState<string | null>(null);
  const displayedLocation = locationInput ?? (search ? locationLabel(search.location) : '');
  const [page, setPage] = useState(1);
  const [fetchState, setFetchState] = useState<FetchState | null>(null);
  const [formError, setFormError] = useState('');
  const [storageWarning, setStorageWarning] = useState('');
  const requestKey = search ? JSON.stringify({ search, page }) : '';
  const currentFetch = fetchState?.key === requestKey ? fetchState : null;
  const result = currentFetch?.result ?? null;
  const requestError = currentFetch?.error ?? '';
  const loading = loaded && Boolean(search) && !currentFetch;

  useEffect(() => {
    if (!loaded || !search) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/programs/nearby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...search, page }),
          cache: 'no-store',
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('status' in data)) {
          throw new Error('Unexpected search response');
        }
        if (!controller.signal.aborted) setFetchState({ key: requestKey, result: data as SearchResponse, error: '' });
      } catch {
        if (!controller.signal.aborted) setFetchState({ key: requestKey, result: null, error: 'Nearby search is temporarily unavailable. Please try again.' });
      }
    })();
    return () => controller.abort();
  }, [loaded, search, page, requestKey]);

  function applySearch(next: Search) {
    setUpdatedSearch(next);
    setPage(1);
    setFormError('');
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageWarning('');
    } catch {
      // The current search still works in memory; it just will not survive a reload.
      setStorageWarning('This browser cannot retain this search after a refresh.');
    }
  }

  function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const location = parseSearchLocation(displayedLocation);
    if (!location) {
      setFormError('Enter a five-digit ZIP or a city, optionally followed by a state.');
      return;
    }
    applySearch({ location, filters: search?.filters ?? {} });
  }

  function updateFilters(next: Filters) {
    if (search) applySearch({ ...search, filters: next });
  }

  const ok = result?.status === 'ok' ? result : null;
  const totalPages = ok ? Math.max(1, Math.ceil(ok.total / Math.max(1, ok.pageSize))) : 1;
  const start = ok && ok.total > 0 ? (ok.page - 1) * ok.pageSize + 1 : 0;
  const end = ok ? Math.min(ok.total, ok.page * ok.pageSize) : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-ink">
      <Link href="/programs" className="text-sm font-medium text-teal-700 hover:underline">← Browse all programs</Link>
      <div className="mt-4">
        <h1 className="h1">Find programs near you</h1>
        <p className="lead mt-2 max-w-2xl">Search by city or ZIP, then explore the closest matching directory listings. Distance is approximate, not a measure of clinical fit.</p>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <form onSubmit={submitLocation} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="nearby-location" className="block text-sm font-semibold">City or five-digit ZIP</label>
            <input
              id="nearby-location"
              value={displayedLocation}
              onChange={(event) => { setLocationInput(event.target.value); setFormError(''); }}
              placeholder="Savannah, GA or 31401"
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-ink focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <button type="submit" className="min-h-12 rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-800">Search nearby</button>
        </form>
        {formError && <p role="alert" className="mt-2 text-sm text-red-700">{formError}</p>}
        {storageWarning && <p role="status" className="mt-2 text-sm text-amber-800">{storageWarning}</p>}

        {search && (
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nearby-level" className="block text-sm font-semibold">Level of care</label>
              <select
                id="nearby-level"
                value={search.filters.level ?? ''}
                onChange={(event) => {
                  const level = event.target.value || undefined;
                  updateFilters({ ...search.filters, level, open: level && level !== 'residential' ? undefined : search.filters.open });
                }}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Any care level</option>
                {LEVELS_OF_CARE.map((value) => <option key={value} value={value}>{LEVEL_LABELS[value]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="nearby-pay" className="block text-sm font-semibold">Payment type</label>
              <select
                id="nearby-pay"
                value={search.filters.pay ?? ''}
                onChange={(event) => updateFilters({ ...search.filters, pay: event.target.value || undefined })}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Any listed payment type</option>
                {PAYER_TYPES.map((value) => <option key={value} value={value}>{PAYER_LABELS[value]}</option>)}
              </select>
            </div>
            {(!search.filters.level || search.filters.level === 'residential') && (
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={search.filters.open === true}
                  onChange={(event) => updateFilters({ ...search.filters, open: event.target.checked || undefined })}
                  className="h-4 w-4 accent-teal-700"
                />
                Fresh positive residential bed report (last 7 days)
              </label>
            )}
            {(search.filters.spec || search.filters.pop) && (
              <div className="flex flex-wrap gap-2 text-xs sm:col-span-2">
                {search.filters.spec && <button type="button" onClick={() => updateFilters({ ...search.filters, spec: undefined })} className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">Specialty: {search.filters.spec} ×</button>}
                {search.filters.pop && <button type="button" onClick={() => updateFilters({ ...search.filters, pop: undefined })} className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">Population: {search.filters.pop} ×</button>}
              </div>
            )}
          </div>
        )}
      </div>

      <div role="status" aria-live="polite" className="mt-5">
        {!loaded || loading ? <p className="text-sm text-slate-600">Finding nearby programs…</p> : null}
        {loaded && !search ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700">Enter a city or ZIP above to search. Your location will not appear in the page URL.</p> : null}
        {requestError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{requestError}</p> : null}
      </div>

      {!loading && result?.status === 'error' && (
        <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{result.message}</p>
      )}

      {!loading && result?.status === 'ambiguous' && (
        <section className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-5" aria-label="Choose a state">
          <h2 className="font-fraunces text-xl font-semibold">Which {result.city}?</h2>
          <p className="mt-1 text-sm text-slate-700">Choose a state to make sure we measure from the right place.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.states.map((state) => (
              <button
                type="button"
                key={state.code}
                onClick={() => {
                  setLocationInput(`${result.city}, ${state.code}`);
                  applySearch({ location: { kind: 'city', city: result.city, state: state.code }, filters: search?.filters ?? {} });
                }}
                className="rounded-lg border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-teal-800 hover:border-teal-500"
              >
                {state.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {!loading && ok && (
        <section className="mt-5" aria-label="Nearby program results">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-fraunces text-2xl font-semibold">Closest matching listings</h2>
              <p className="mt-1 text-sm text-slate-600">{ok.total.toLocaleString()} matching program{ok.total === 1 ? '' : 's'} · ordered by approximate distance from {ok.origin.label}{ok.total > ok.pageSize ? ` · showing ${start.toLocaleString()}–${end.toLocaleString()}` : ''}</p>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">Sorted by approximate distance</span>
          </div>
          <p className="mt-3 text-xs text-slate-600">{ok.distanceBasis || 'Distances are estimated from location centers, not driving routes or verified street addresses.'} Listings without a usable location appear after distance-ranked listings.</p>

          {ok.rows.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">No programs match these filters. Try clearing a care or payment filter, or browse all programs.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ok.rows.map((row) => (
                <Link key={row.id} href={`/programs/${encodeURIComponent(row.id)}`} className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-sage/10 px-4 py-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 group-hover:text-teal-800">{row.name}</div>
                      <div className="mt-0.5 text-xs text-slate-600">{[row.city, row.state].filter(Boolean).join(', ') || 'Location on file'}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-100">
                      {row.miles === null ? 'Distance unavailable' : `Approx. ${row.miles.toFixed(1)} mi`}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(row.levels ?? []).slice(0, 4).map((level) => (
                        <span key={level} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{LEVEL_LABELS[level as LevelOfCare] ?? level}</span>
                      ))}
                    </div>
                    <div className="mt-auto space-y-1.5 text-xs text-slate-600">
                      <p><span className="font-semibold text-slate-700">Listed payment options:</span> {row.paymentSummary || 'Call to verify'}</p>
                      <p><span className={`inline-flex rounded-full px-2.5 py-1 font-medium ${bedClass(row.bedTone)}`}>{row.bedLabel || 'Availability not verified'}</span></p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Result pages" className="mt-6 flex items-center justify-between gap-3 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => { setPage((current) => Math.max(1, current - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:border-teal-400 disabled:cursor-not-allowed disabled:opacity-40">← Previous</button>
              <span className="text-slate-600">Page {ok.page} of {totalPages.toLocaleString()}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => { setPage((current) => current + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:border-teal-400 disabled:cursor-not-allowed disabled:opacity-40">Next →</button>
            </nav>
          )}
          <p className="mt-6 text-xs leading-relaxed text-slate-600">A nearby listing may not be suitable or have an available place. Confirm services, admission status, and coverage directly with each provider. Distance is approximate and does not represent travel time.</p>
        </section>
      )}
    </main>
  );
}
