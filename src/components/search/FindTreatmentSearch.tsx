'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { US_STATES } from '@/lib/geo';
import { commonPayers } from '@/lib/payers';
import { PayerLogoImage } from '@/components/LogoCarousel';
import { Dialog } from '@/components/ui';
import { trackSearchStarted, trackSearchSubmitted, trackFilterApplied } from '@/lib/analytics';
import {
  insuranceDestination,
  parseDirectoryLanguage,
  parseSearchLocation,
  withApproximateState,
} from '@/lib/search/directory-language';

// Preserve the public helpers used by privacy-contract tests and any existing
// callers while keeping the parser itself in a pure, reusable module.
export { coarseDirectoryHref, insuranceDestination } from '@/lib/search/directory-language';

const OVERLAY_PAGE = 'find_treatment_overlay';
const NEARBY_SEARCH_KEY = 'clearbed:location-search:v1';

// Recovery.com-inspired "command palette" search for treatment seekers. A single bar
// opens a rich overlay with coarse directory filters and links into the guided search.
// Free text is deliberately reduced to known, non-identifying filter values before
// navigation: a seeker's raw phrase never enters a URL or browser history.

type Loc = { code: string; label: string; from: number; to: number; current?: boolean; photo?: string };

// States with directory coverage today, plus a coarse request-region tile.
// `from`/`to` drive a soft brand gradient per tile (styled stand-in until real photos).
const LOCATIONS: Loc[] = [
  { code: '', label: 'Use approximate state', from: 0, to: 0, current: true },
  { code: 'GA', label: 'Georgia', from: 158, to: 174, photo: '/states/ga.jpg' },
  { code: 'FL', label: 'Florida', from: 188, to: 205, photo: '/states/fl.jpg' },
  { code: 'AL', label: 'Alabama', from: 200, to: 30, photo: '/states/al.jpg' },
];

const CONDITIONS: { label: string; href: string }[] = [
  { label: 'Detox services', href: '/programs?level=detox' },
  { label: 'Residential', href: '/programs?level=residential' },
  { label: 'Co-Occurring', href: '/programs?spec=occurring' },
  { label: 'Trauma', href: '/programs?spec=trauma' },
  { label: 'Substance Use', href: '/programs?spec=substance' },
  { label: 'Medication-Assisted (MAT)', href: '/programs?spec=mat' },
  { label: 'Outpatient (IOP)', href: '/programs?level=iop' },
];

const CLIENTELE: { label: string; href: string }[] = [
  { label: 'Men', href: '/programs?pop=men' },
  { label: 'Women', href: '/programs?pop=women' },
  { label: 'Teens', href: '/programs?pop=adolescent' },
  { label: 'Young Adults', href: `/programs?pop=${encodeURIComponent('young adult')}` },
  { label: 'Veterans', href: '/programs?pop=veteran' },
  { label: 'Seniors', href: '/programs?pop=senior' },
  { label: 'Pregnant / Postpartum', href: '/programs?pop=pregnant' },
];

// Insurance options, rendered as a side-scrolling row of carrier brand marks.
// Public/self-pay categories use the corresponding directory filter; named commercial
// carriers link to their exact guide rather than a generic commercial result set.
const INSURANCE = commonPayers().map((p) => ({
  slug: p.slug,
  name: p.name,
  brand: p.brand,
  kind: p.kind,
  payerType: p.payerType,
  href: insuranceDestination(p),
}));

function tileStyle(l: Loc): React.CSSProperties {
  if (l.current) return { background: 'linear-gradient(135deg,#0f3b34,#1f6f60)' };
  // Real state photo, darkened with a teal wash so the white state code stays legible.
  if (l.photo) return { backgroundImage: 'linear-gradient(180deg,rgba(15,59,52,0.22),rgba(15,59,52,0.64)),url(' + l.photo + ')', backgroundSize: 'cover', backgroundPosition: 'center' };
  return { background: `linear-gradient(135deg,hsl(${l.from} 38% 42%),hsl(${l.to} 45% 30%))` };
}

export function FindTreatmentSearch({
  className = '',
  trigger = 'hero',
  open: controlledOpen,
  onOpenChange,
}: {
  className?: string;
  /** 'hero' renders the big search bar; 'none' lets a parent (e.g. SiteHeader) supply its own trigger and control open state. */
  trigger?: 'hero' | 'none';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => (onOpenChange ? onOpenChange(value) : setInternalOpen(value));
  const [text, setText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [locating, setLocating] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const interpretation = useMemo(() => parseDirectoryLanguage(text), [text]);
  const preciseLocation = useMemo(
    () => {
      if (locationText.trim()) return parseSearchLocation(locationText);
      const embedded = parseSearchLocation(text, 'request');
      if (embedded) return embedded;
      const standaloneCity = text.trim();
      if (
        !interpretation.recognized &&
        standaloneCity.split(/\s+/).length <= 3 &&
        !/\b(?:find|show|need|want|looking|best|me|my|i|for|care|center|addiction|recovery)\b/i.test(standaloneCity)
      ) {
        return parseSearchLocation(standaloneCity);
      }
      return undefined;
    },
    [locationText, text, interpretation.recognized],
  );

  const go = (href: string) => {
    setSearchFeedback('');
    setOpen(false);
    router.push(href);
  };

  // Both Enter and the visible conversational CTA use this exact path. Only
  // allow-listed facets survive; raw narrative text stays in component memory.
  const runInterpretedSearch = async (searchType: string) => {
    const q = text.trim();
    trackSearchSubmitted({ sourcePage: OVERLAY_PAGE, searchType, hasQuery: Boolean(q || locationText.trim()) });

    if (locationText.trim() && !preciseLocation) {
      setSearchFeedback('Enter a five-digit ZIP or city, optionally followed by a state (for example, Savannah, GA).');
      locationRef.current?.focus();
      return;
    }
    if (!q && !preciseLocation) {
      setSearchFeedback('Enter a city or ZIP, or describe the type of care you need.');
      locationRef.current?.focus();
      return;
    }

    // Keep named-carrier requests on their source-grounded coverage guide; a
    // generic commercial directory row does not establish carrier acceptance.
    if (interpretation.destination === 'insurance-guide') {
      go(interpretation.href);
      return;
    }

    if (preciseLocation) {
      // Only a structured location and allow-listed facets cross the route
      // boundary. The full request and precise location never enter the URL.
      const filters: {
        level?: string; pay?: string; spec?: string; pop?: string; open?: boolean;
      } = {};
      for (const filter of interpretation.filters) {
        if (filter.key === 'level') filters.level = filter.value;
        if (filter.key === 'payment') filters.pay = filter.value;
        if (filter.key === 'specialty') filters.spec = filter.value;
        if (filter.key === 'population') filters.pop = filter.value;
        if (filter.key === 'availability') filters.open = true;
      }
      try {
        sessionStorage.setItem(NEARBY_SEARCH_KEY, JSON.stringify({ location: preciseLocation, filters }));
        go('/programs/nearby');
      } catch {
        setSearchFeedback('This browser could not start a private nearby search. Enable session storage and try again.');
      }
      return;
    }

    if (!interpretation.recognized) {
      setSearchFeedback('I could not match that yet. Try a city or ZIP, state, care level, payment type, specialty, or who care is for.');
      inputRef.current?.focus();
      return;
    }

    if (!interpretation.needsApproximateState) {
      go(interpretation.href);
      return;
    }

    setLocating(true);
    setSearchFeedback('Using your approximate state…');
    try {
      const res = await fetch('/api/geo', { cache: 'no-store' });
      const geo = (await res.json()) as { state?: string };
      if (geo.state && US_STATES[geo.state]) {
        go(withApproximateState(interpretation, geo.state));
        return;
      }
      // Preserve every other recognized facet if coarse request-region data is
      // unavailable. If location was the only intent, offer the state hub.
      go(interpretation.href === '/programs' ? '/treatment' : interpretation.href);
    } catch {
      go(interpretation.href === '/programs' ? '/treatment' : interpretation.href);
    } finally {
      setLocating(false);
    }
  };

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    void runInterpretedSearch('directory_search');
  };

  const naturalSearch = () => {
    void runInterpretedSearch('natural_language_directory_search');
  };

  const openStructuredGuide = () => {
    trackSearchSubmitted({
      sourcePage: OVERLAY_PAGE,
      searchType: 'structured_guide_fallback',
      hasQuery: Boolean(text.trim()),
    });
    go('/match');
  };

  // Use only Vercel's coarse request-region header. Never request device coordinates,
  // place latitude/longitude in a URL, or send the seeker's origin to a map provider.
  const startLocationSearch = () => {
    trackFilterApplied('location', 'current_location', OVERLAY_PAGE);
    setLocating(true);
    void (async () => {
      try {
        const res = await fetch('/api/geo', { cache: 'no-store' });
        const geo = (await res.json()) as { state?: string };
        go(geo.state && US_STATES[geo.state] ? `/programs?region=${geo.state}` : '/treatment');
      } catch {
        go('/treatment');
      }
    })();
  };

  return (
    <div className={className}>
      {/* Trigger — a large, prominent search bar that opens the overlay.
          Omitted when trigger="none" (SiteHeader supplies its own compact trigger). */}
      {trigger !== 'none' && (
        <button
          type="button"
          onClick={() => {
            trackSearchStarted('hero_search');
            setOpen(true);
          }}
          className="flex w-full items-center gap-4 rounded-2xl bg-white px-5 py-4 text-left shadow-2xl shadow-ink/30 ring-1 ring-black/5 transition hover:-translate-y-0.5 sm:px-6 sm:py-5"
        >
          <SearchIcon className="h-6 w-6 shrink-0 text-teal-700" />
          <span className="min-w-0 flex-1 truncate text-base text-slate-500 sm:text-lg">
            Search treatment — city, ZIP, or care need
          </span>
          <span className="ml-auto hidden shrink-0 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white sm:inline">
            Search
          </span>
        </button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Find treatment"
        placement="center"
        className="!max-w-2xl !rounded-3xl"
        initialFocusRef={locationRef}
      >
        <form onSubmit={submitSearch} className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <label htmlFor="search-location" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            City or ZIP code
          </label>
          <div className="mt-1 flex items-center gap-3">
            <PinIcon className="h-5 w-5 shrink-0 text-slate-400" />
            <input
              id="search-location"
              ref={locationRef}
              value={locationText}
              onChange={(e) => {
                setLocationText(e.target.value);
                setSearchFeedback('');
              }}
              placeholder="Savannah, GA or 31401"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <label htmlFor="search-care" className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Treatment need <span className="font-normal normal-case">(optional)</span>
          </label>
          <div className="mt-1 flex items-center gap-3">
              <SearchIcon className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                id="search-care"
                ref={inputRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setSearchFeedback('');
                }}
                placeholder="For example, residential with Medicaid"
                aria-label="Describe the treatment you are looking for"
                className="min-w-0 flex-1 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={locating}
                aria-label="Search this request"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal-700 text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-70"
              >
                {locating ? <SpinnerIcon className="h-5 w-5" /> : <span aria-hidden>→</span>}
              </button>
          </div>
        </form>

        <div className="px-4 pb-6 pt-4 sm:px-5">
              {/* Conversational request → privacy-safe, allow-listed directory filters. */}
              <button
                type="button"
                onClick={naturalSearch}
                disabled={locating}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-teal-50 to-sage/20 p-4 text-left ring-1 ring-teal-100 transition hover:ring-teal-300"
              >
                <span className="min-w-0">
                  <span className="block font-fraunces text-lg font-semibold text-ink">Search the way you speak</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {preciseLocation
                      ? 'Find programs nearest to your city or ZIP. The location stays out of the URL.'
                      : text.trim() && interpretation.recognized
                        ? 'Search with the filters recognized below. Your full sentence stays on this device.'
                        : text.trim()
                          ? 'Add a city or ZIP, care level, payment type, specialty, or who care is for.'
                          : 'Try a city or ZIP above, or a sentence like “teen IOP near me with private insurance.”'}
                  </span>
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-700 text-white transition group-hover:scale-105">
                  {locating ? <SpinnerIcon className="h-5 w-5" /> : <SparkIcon className="h-5 w-5" />}
                </span>
              </button>

              {(preciseLocation || (text.trim() && interpretation.filters.length > 0)) && (
                <div className="mt-3" aria-live="polite">
                  <p className="text-xs font-medium text-slate-500">Understood as</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {preciseLocation && (
                      <span className="rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                        Near {preciseLocation.kind === 'zip'
                          ? preciseLocation.zip
                          : `${preciseLocation.city}${preciseLocation.state ? `, ${preciseLocation.state}` : ''}`}
                      </span>
                    )}
                    {interpretation.filters.filter((filter) => !(preciseLocation && filter.key === 'region')).map((filter) => (
                      <span
                        key={`${filter.key}:${filter.value}`}
                        data-search-filter={filter.key}
                        className="rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800"
                      >
                        {filter.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {searchFeedback ? (
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <p role="status" aria-live="polite">{searchFeedback}</p>
                  {!interpretation.recognized && !preciseLocation && (
                    <button
                      type="button"
                      onClick={openStructuredGuide}
                      className="mt-1.5 min-h-11 font-semibold text-teal-800 underline underline-offset-2"
                    >
                      Use the 3-question guide →
                    </button>
                  )}
                </div>
              ) : (
                <p role="status" aria-live="polite" className="sr-only" />
              )}

              {/* Top locations */}
              <Section title="Top locations" />
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {LOCATIONS.map((l) => (
                  <button
                    type="button"
                    key={l.label}
                    disabled={l.current && locating}
                    onClick={() => {
                      if (l.current) return startLocationSearch();
                      trackFilterApplied('location', l.code, OVERLAY_PAGE);
                      go(`/programs?region=${l.code}`);
                    }}
                    className="group w-32 shrink-0 text-left disabled:cursor-wait disabled:opacity-80"
                  >
                    <span className="relative grid h-20 w-32 place-items-center overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5" style={tileStyle(l)}>
                      {l.current ? (
                        locating ? <SpinnerIcon className="h-6 w-6 text-white" /> : <PinIcon className="h-6 w-6 text-white" />
                      ) : (
                        <span className="font-fraunces text-2xl font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">{l.code}</span>
                      )}
                      <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                    </span>
                    <span className="mt-1.5 block truncate text-sm font-medium text-slate-700">{l.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    trackFilterApplied('location', 'all_states', OVERLAY_PAGE);
                    // The state hub — a list of every state to choose from. NOT /programs,
                    // which dumps you into the flat all-programs list with no state choice.
                    go('/treatment');
                  }}
                  className="group w-32 shrink-0 text-left"
                >
                  <span className="grid h-20 w-32 place-items-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-black/5 transition group-hover:bg-slate-200">
                    <span className="text-sm font-medium">All states →</span>
                  </span>
                  <span className="mt-1.5 block text-sm font-medium text-slate-700">Browse all</span>
                </button>
              </div>

              {/* Conditions */}
              <Section title="Common needs" />
              <ChipRow
                items={CONDITIONS}
                onPick={(href) => {
                  trackFilterApplied('condition', 'preset_condition', OVERLAY_PAGE);
                  go(href);
                }}
              />

              {/* Insurance — micro brand logos + name */}
              <Section title="Insurance and payment guides" />
              <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {INSURANCE.map((c) => (
                  <button
                    type="button"
                    key={c.slug}
                    onClick={() => {
                      trackFilterApplied('insurance', c.kind === 'commercial' ? 'named_guide' : 'payment_category', OVERLAY_PAGE);
                      go(c.href);
                    }}
                    title={c.name}
                    aria-label={
                      c.kind === 'commercial'
                        ? `Read the ${c.name} coverage guide`
                        : `Browse programs listing ${c.name} as a payment option`
                    }
                    className="flex h-16 w-32 shrink-0 snap-start items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200/70 transition hover:bg-white hover:shadow-md hover:ring-teal-300"
                  >
                    <PayerLogoImage slug={c.slug} name={c.name} brand={c.brand} compact />
                  </button>
                ))}
              </div>

              {/* Clientele */}
              <Section title="Who it's for" />
              <ChipRow
                items={CLIENTELE}
                onPick={(href) => {
                  trackFilterApplied('population', 'preset_population', OVERLAY_PAGE);
                  go(href);
                }}
              />
        </div>
      </Dialog>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <h3 className="mb-2 mt-5 text-sm font-semibold text-ink">{title}</h3>;
}

function ChipRow({ items, onPick }: { items: { label: string; href: string }[]; onPick: (href: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((c) => (
        <button
          type="button"
          key={c.label}
          onClick={() => onPick(c.href)}
          className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/* icons */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function SparkIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8z" /></svg>;
}
function PinIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 21s-7-4.5-7-10a7 7 0 0114 0c0 5.5-7 10-7 10z" /><circle cx="12" cy="11" r="2.5" /></svg>;
}
function SpinnerIcon({ className }: { className?: string }) {
  return <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.6" /></svg>;
}
