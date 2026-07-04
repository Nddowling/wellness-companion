'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import { PAYER_TYPES, PAYER_LABELS } from '@/lib/constants';
import { US_STATES } from '@/lib/geo';

// Recovery.com-inspired "command palette" search for treatment seekers. A single bar
// opens a rich overlay: natural-language search (→ the AI guide at /match), location
// tiles (incl. IP-derived "Current Location"), and condition / insurance / clientele
// chips — every one wired to a real /programs filter. Branded in Clear Bed's palette,
// not copied. Need-based: nothing here ranks paid facilities above others.

type Loc = { code: string; label: string; from: number; to: number; current?: boolean };

// States with directory coverage today, plus the IP-aware "Current Location" tile.
// `from`/`to` drive a soft brand gradient per tile (styled stand-in until real photos).
const LOCATIONS: Loc[] = [
  { code: '', label: 'Current Location', from: 0, to: 0, current: true },
  { code: 'GA', label: 'Georgia', from: 158, to: 174 },
  { code: 'FL', label: 'Florida', from: 188, to: 205 },
  { code: 'AL', label: 'Alabama', from: 200, to: 30 },
];

const CONDITIONS: { label: string; href: string }[] = [
  { label: 'Detox', href: '/programs?level=detox' },
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

function tileStyle(l: Loc): React.CSSProperties {
  if (l.current) return { background: 'linear-gradient(135deg,#0f3b34,#1f6f60)' };
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
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInternalOpen(v));
  const [text, setText] = useState('');
  const [locating, setLocating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the field and lock body scroll while the overlay is open; Esc closes.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // Free text → smart directory search (name, city, condition, population, level, state).
  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = text.trim();
    go(q ? `/programs?q=${encodeURIComponent(q)}` : '/programs');
  };

  // "Search the way you speak": apply whatever they typed; empty → open the guide.
  const naturalSearch = () => {
    const q = text.trim();
    go(q ? `/programs?q=${encodeURIComponent(q)}` : '/match');
  };

  // Current Location → browser Geolocation API (accurate, permission-based, VPN-proof),
  // falling back to coarse IP geo only if the user denies or it's unavailable.
  const useMyLocation = () => {
    setLocating(true);
    const ipFallback = async () => {
      try {
        const res = await fetch('/api/geo', { cache: 'no-store' });
        const geo = (await res.json()) as { state?: string };
        go(geo.state && US_STATES[geo.state] ? `/programs?region=${geo.state}` : '/programs');
      } catch {
        go('/programs');
      }
    };
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      ipFallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => go(`/match/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
      () => ipFallback(),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 }
    );
  };

  return (
    <div className={className}>
      {/* Trigger — a large, prominent search bar that opens the overlay.
          Omitted when trigger="none" (SiteHeader supplies its own compact trigger). */}
      {trigger !== 'none' && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-4 rounded-2xl bg-white px-5 py-4 text-left shadow-2xl shadow-ink/30 ring-1 ring-black/5 transition hover:-translate-y-0.5 sm:px-6 sm:py-5"
        >
          <SearchIcon className="h-6 w-6 shrink-0 text-teal-700" />
          <span className="min-w-0 flex-1 truncate text-base text-slate-500 sm:text-lg">
            Search treatment — place, condition, insurance, or just describe it
          </span>
          <span className="ml-auto hidden shrink-0 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white sm:inline">
            Search
          </span>
        </button>
      )}

      {open && typeof document !== 'undefined' && createPortal(
        // Portal to <body>: the hero ancestor has a CSS transform (animate-fade-up),
        // which would otherwise make this `fixed` overlay anchor to that element
        // instead of the viewport — shoving it off-screen on mobile.
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/55 px-3 py-6 backdrop-blur-sm sm:py-12" role="dialog" aria-modal="true" aria-label="Find treatment">
          {/* click-away */}
          <button className="absolute inset-0 cursor-default" aria-label="Close search" onClick={() => setOpen(false)} />

          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* search field */}
            <form onSubmit={submitSearch} className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <SearchIcon className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Locations, conditions, insurance, programs…"
                className="min-w-0 flex-1 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
                <CloseIcon className="h-5 w-5" />
              </button>
            </form>

            <div className="max-h-[70vh] overflow-y-auto px-5 pb-6 pt-4">
              {/* Search the way you speak → AI guide */}
              <button
                onClick={naturalSearch}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-teal-50 to-sage/20 p-4 text-left ring-1 ring-teal-100 transition hover:ring-teal-300"
              >
                <span>
                  <span className="block font-fraunces text-lg font-semibold text-ink">Search the way you speak</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {text.trim() ? `“${text.trim()}”` : '“Teen-friendly detox near me that takes Medicaid”'}
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
                    key={l.label}
                    onClick={() => (l.current ? useMyLocation() : go(`/programs?region=${l.code}`))}
                    className="group w-32 shrink-0 text-left"
                  >
                    <span className="relative grid h-20 w-32 place-items-center overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5" style={tileStyle(l)}>
                      {l.current ? (
                        locating ? <SpinnerIcon className="h-6 w-6 text-white" /> : <PinIcon className="h-6 w-6 text-white" />
                      ) : (
                        <span className="font-fraunces text-2xl font-semibold text-white/90">{l.code}</span>
                      )}
                      <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                    </span>
                    <span className="mt-1.5 block truncate text-sm font-medium text-slate-700">{l.label}</span>
                  </button>
                ))}
                <button onClick={() => go('/programs')} className="group w-32 shrink-0 text-left">
                  <span className="grid h-20 w-32 place-items-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-black/5 transition group-hover:bg-slate-200">
                    <span className="text-sm font-medium">All states →</span>
                  </span>
                  <span className="mt-1.5 block text-sm font-medium text-slate-700">Browse all</span>
                </button>
              </div>

              {/* Conditions */}
              <Section title="Common needs" />
              <ChipRow items={CONDITIONS} onPick={go} />

              {/* Insurance */}
              <Section title="By accepted insurance" />
              <ChipRow items={PAYER_TYPES.map((p) => ({ label: PAYER_LABELS[p], href: `/programs?pay=${p}` }))} onPick={go} />

              {/* Clientele */}
              <Section title="Who it's for" />
              <ChipRow items={CLIENTELE} onPick={go} />
            </div>
          </div>
        </div>,
        document.body,
      )}
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
function CloseIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>;
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
