'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { US_STATES } from '@/lib/geo';
import { commonPayers } from '@/lib/payers';
import { PayerLogoImage } from '@/components/LogoCarousel';
import { Dialog } from '@/components/ui';
import { trackSearchStarted, trackSearchSubmitted, trackFilterApplied } from '@/lib/analytics';

const OVERLAY_PAGE = 'find_treatment_overlay';

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

export function insuranceDestination(payer: {
  slug: string;
  kind: string;
  payerType: string;
}): string {
  // A generic `commercial` facility row does not establish acceptance of a named
  // carrier. Named carriers therefore go to their source-grounded guide instead of
  // silently widening to every commercial-insurance listing.
  return payer.kind === 'commercial' ? `/insurance/${payer.slug}` : `/programs?pay=${payer.payerType}`;
}

const CARRIER_SEARCH_ALIASES: Record<string, string[]> = {
  aetna: ['aetna'],
  'blue-cross-blue-shield': ['blue cross blue shield', 'blue cross', 'bcbs'],
  cigna: ['cigna'],
  unitedhealthcare: ['unitedhealthcare', 'united healthcare', 'uhc'],
  humana: ['humana'],
  'kaiser-permanente': ['kaiser permanente', 'kaiser'],
};

function includesPhrase(input: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'i').test(input);
}

/**
 * Reduce free text to an allow-list of coarse directory filters. Unknown words,
 * facility names, narratives, and exact places are intentionally discarded.
 */
export function coarseDirectoryHref(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return '/programs';

  const namedCarrier = commonPayers().find(
    (payer) =>
      payer.kind === 'commercial' &&
      (CARRIER_SEARCH_ALIASES[payer.slug] ?? [payer.name.toLowerCase()]).some((alias) => includesPhrase(normalized, alias)),
  );
  if (namedCarrier) return insuranceDestination(namedCarrier);

  const params = new URLSearchParams();
  const levelTerms: [string, string[]][] = [
    ['detox', ['detox', 'withdrawal management']],
    ['residential', ['residential', 'inpatient rehab']],
    ['php', ['php', 'partial hospitalization']],
    ['iop', ['iop', 'intensive outpatient']],
    ['op', ['outpatient']],
  ];
  const level = levelTerms.find(([, aliases]) => aliases.some((alias) => includesPhrase(normalized, alias)))?.[0];
  if (level) params.set('level', level);

  const paymentTerms: [string, string[]][] = [
    ['medicaid', ['medicaid']],
    ['medicare', ['medicare']],
    ['tricare', ['tricare']],
    ['self_pay', ['self pay', 'cash pay']],
  ];
  const payment = paymentTerms.find(([, aliases]) => aliases.some((alias) => includesPhrase(normalized, alias)))?.[0];
  if (payment) params.set('pay', payment);

  const specialtyTerms: [string, string[]][] = [
    ['occurring', ['co occurring', 'co-occurring', 'dual diagnosis']],
    ['trauma', ['trauma']],
    ['mat', ['mat', 'medication assisted']],
    ['substance', ['substance use']],
  ];
  const specialty = specialtyTerms.find(([, aliases]) => aliases.some((alias) => includesPhrase(normalized, alias)))?.[0];
  if (specialty) params.set('spec', specialty);

  const stateEntry = Object.entries(US_STATES).find(
    ([code, name]) => normalized === code.toLowerCase() || includesPhrase(normalized, name.toLowerCase()),
  );
  if (stateEntry) params.set('region', stateEntry[0]);

  const query = params.toString();
  return query ? `/programs?${query}` : '/programs';
}

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
  const [locating, setLocating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // Free text is reduced to allow-listed coarse filters. The raw phrase stays only
  // in component memory and is discarded on navigation.
  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = text.trim();
    // Only a boolean about whether text was typed — never the raw query.
    trackSearchSubmitted({ sourcePage: OVERLAY_PAGE, searchType: 'directory_search', hasQuery: Boolean(q) });
    go(coarseDirectoryHref(q));
  };

  // Open the guide without copying a potentially sensitive phrase into a URL. The
  // guide gathers only its own limited, consent-aware intake fields.
  const naturalSearch = () => {
    const q = text.trim();
    trackSearchSubmitted({
      sourcePage: OVERLAY_PAGE,
      searchType: q ? 'natural_language_directory_search' : 'ai_match_start',
      hasQuery: Boolean(q),
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
            Search treatment — state, level of care, or payment type
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
        initialFocusRef={inputRef}
      >
        {/* search field */}
        <form onSubmit={submitSearch} className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <SearchIcon className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="State, level of care, or payment type…"
                aria-label="Search by state, level of care, or payment type"
                className="min-w-0 flex-1 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
        </form>

        <div className="px-5 pb-6 pt-4">
              {/* Search the way you speak → AI guide */}
              <button
                type="button"
                onClick={naturalSearch}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-teal-50 to-sage/20 p-4 text-left ring-1 ring-teal-100 transition hover:ring-teal-300"
              >
                <span>
                  <span className="block font-fraunces text-lg font-semibold text-ink">Search the way you speak</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {text.trim()
                      ? 'Open the guide. Your phrase will not be added to the URL or browser history.'
                      : 'Answer limited questions without putting a personal story in the URL.'}
                  </span>
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-700 text-white transition group-hover:scale-105">
                  <SparkIcon className="h-5 w-5" />
                </span>
              </button>

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
