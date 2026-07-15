'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Chip, Dialog } from '@/components/ui';
import { useProgramCombobox } from '@/components/search/useProgramCombobox';
import { LEVELS_OF_CARE, LEVEL_LABELS, PAYER_LABELS, isBedBased, type PayerType } from '@/lib/constants';
import { US_STATES } from '@/lib/geo';
import { payerTypeBrand } from '@/lib/payers';
import { PayerMark } from '@/components/PayerLogo';
import { trackFilterApplied, trackSearchSubmitted } from '@/lib/analytics';

const PROGRAMS_PAGE = 'programs_directory';

// URL-first faceted filter bar for the directory. Every change writes the
// querystring (Back undoes one filter; a filtered URL is shareable). Group
// pickers open as a centered modal on desktop and a bottom sheet on phones
// (Dialog placement="responsive"). Option counts come from facilities_facet_counts
// and reflect the OTHER active filters, so a number tells you what you'd get.

export type Facets = {
  levels: Record<string, number>;
  payers: Record<string, number>;
  regions: Record<string, number>;
};

type Option = { value: string; label: string; count: number };

export function FilterBar({ facets }: { facets: Facets }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const cur = {
    level: sp.get('level') ?? '',
    region: sp.get('region') ?? '',
    pay: sp.get('pay') ?? '',
    open: sp.get('open') ?? '',
    spec: sp.get('spec') ?? '',
    pop: sp.get('pop') ?? '',
  };
  const bedReportEligible = !cur.level || isBedBased(cur.level);

  const push = (overrides: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page'); // any filter change resets to page 1
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const regionOptions: Option[] = Object.entries(facets.regions)
    .map(([value, count]) => ({ value, label: US_STATES[value] ?? value, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const activeChips: { key: string; label: string }[] = [];
  if (cur.level) activeChips.push({ key: 'level', label: LEVEL_LABELS[cur.level as keyof typeof LEVEL_LABELS] ?? cur.level });
  if (cur.region) activeChips.push({ key: 'region', label: US_STATES[cur.region] ?? cur.region });
  if (cur.pay) activeChips.push({ key: 'pay', label: PAYER_LABELS[cur.pay as keyof typeof PAYER_LABELS] ?? cur.pay });
  if (cur.spec) activeChips.push({ key: 'spec', label: cur.spec });
  if (cur.pop) activeChips.push({ key: 'pop', label: cur.pop });
  if (cur.open && bedReportEligible) activeChips.push({ key: 'open', label: 'Fresh bed report (7 days)' });

  return (
    <div className="space-y-3">
      {/* Level of care — the primary axis, always visible as segmented chips. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Chip
          active={!cur.level}
          interactive
          onClick={() => {
            trackFilterApplied('level_of_care', 'cleared', PROGRAMS_PAGE);
            push({ level: null });
          }}
        >
          All care
        </Chip>
        {LEVELS_OF_CARE.map((l) => (
          <Chip
            key={l}
            active={cur.level === l}
            interactive
            count={facets.levels[l]}
            onClick={() => {
              const next = cur.level === l ? null : l;
              trackFilterApplied('level_of_care', next || 'cleared', PROGRAMS_PAGE);
              const updates: Record<string, string | null> = { level: next };
              if (next && !isBedBased(next)) updates.open = null;
              push(updates);
            }}
            className="shrink-0"
          >
            {LEVEL_LABELS[l]}
          </Chip>
        ))}
      </div>

      {/* Secondary facets + free-text search. */}
      <div className="flex flex-wrap items-center gap-2">
        <InsuranceSelect
          active={cur.pay as PayerType | ''}
          counts={facets.payers}
          onSelect={(v) => {
            trackFilterApplied('insurance', v || 'cleared', PROGRAMS_PAGE);
            push({ pay: v });
          }}
        />
        <FacetSelect
          label="Location"
          activeLabel={cur.region ? US_STATES[cur.region] ?? cur.region : undefined}
          options={regionOptions}
          onSelect={(v) => {
            trackFilterApplied('location', v || 'cleared', PROGRAMS_PAGE);
            push({ region: v });
          }}
        />
        {bedReportEligible && (
          <Chip
            tone="sage"
            active={!!cur.open}
            interactive
            onClick={() => {
              const next = cur.open ? null : '1';
              trackFilterApplied('availability', next ? 'fresh_bed_report' : 'cleared', PROGRAMS_PAGE);
              push({ open: next });
            }}
          >
            <span aria-hidden className="text-emerald-500">●</span> Fresh bed report (7 days)
          </Chip>
        )}
        <ProgramSearchInline
          onPick={(id) => {
            trackSearchSubmitted({ sourcePage: PROGRAMS_PAGE, searchType: 'program_autocomplete', hasQuery: true });
            router.push(`/programs/${id}`);
          }}
        />
      </div>

      {/* Active filters — removable, so Back-button and the × both undo one thing. */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((c) => (
            <Chip key={c.key} tone="brand" active onRemove={() => push({ [c.key]: null })}>
              {c.label}
            </Chip>
          ))}
          <button
            type="button"
            onClick={() => {
              trackFilterApplied('all_filters', 'cleared', PROGRAMS_PAGE);
              router.push(pathname, { scroll: false });
            }}
            className="text-xs text-slate-500 underline hover:text-teal-700"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function FacetSelect({
  label,
  activeLabel,
  options,
  onSelect,
}: {
  label: string;
  activeLabel?: string;
  options: Option[];
  onSelect: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Chip tone={activeLabel ? 'brand' : 'neutral'} active={!!activeLabel} interactive onClick={() => setOpen(true)}>
        {activeLabel ?? label} <span aria-hidden className="opacity-60">⌄</span>
      </Chip>
      <Dialog open={open} onClose={() => setOpen(false)} title={label}>
        <div className="p-2">
          <OptionRow label={`Any ${label.toLowerCase()}`} onClick={() => { onSelect(null); setOpen(false); }} muted />
          {options.map((o) => (
            <OptionRow
              key={o.value}
              label={o.label}
              count={o.count}
              active={activeLabel === o.label}
              onClick={() => { onSelect(o.value); setOpen(false); }}
            />
          ))}
        </div>
      </Dialog>
    </>
  );
}

function OptionRow({
  label,
  count,
  active,
  muted,
  brand,
  onClick,
}: {
  label: string;
  count?: number;
  active?: boolean;
  muted?: boolean;
  brand?: React.ComponentProps<typeof PayerMark>['brand'];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50 ' +
        (active ? 'font-semibold text-teal-700' : muted ? 'text-slate-500' : 'text-ink')
      }
    >
      <span className="flex items-center gap-2">
        {brand && <PayerMark brand={brand} size="md" />}
        {label}
      </span>
      {typeof count === 'number' && <span className="tabular-nums text-xs text-slate-400">{count.toLocaleString()}</span>}
    </button>
  );
}

// Insurance picker. These are broad payment categories only. Named-carrier guides
// live under /insurance; we do not label a generic commercial filter as Aetna, BCBS,
// or another carrier without exact source evidence.
const PUBLIC_PAYER_TYPES: PayerType[] = ['medicaid', 'medicare', 'tricare', 'self_pay'];

function InsuranceSelect({
  active,
  counts,
  onSelect,
}: {
  active: PayerType | '';
  counts: Record<string, number>;
  onSelect: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const pick = (v: string | null) => { onSelect(v); setOpen(false); };
  const activeLabel = active ? PAYER_LABELS[active] : undefined;
  return (
    <>
      <Chip tone={active ? 'brand' : 'neutral'} active={!!active} interactive onClick={() => setOpen(true)}>
        {active && <PayerMark brand={payerTypeBrand(active)} size="sm" className="mr-1.5 align-[-2px]" />}
        {activeLabel ?? 'Insurance'} <span aria-hidden className="opacity-60">⌄</span>
      </Chip>
      <Dialog open={open} onClose={() => setOpen(false)} title="Insurance">
        <div className="p-2">
          <OptionRow label="Any insurance" onClick={() => pick(null)} muted />
          {PUBLIC_PAYER_TYPES.filter((t) => counts[t] != null).map((t) => (
            <OptionRow
              key={t}
              label={PAYER_LABELS[t]}
              brand={payerTypeBrand(t)}
              count={counts[t]}
              active={active === t}
              onClick={() => pick(t)}
            />
          ))}
          {counts.commercial != null && (
            <OptionRow
              label="Commercial insurance"
              brand={payerTypeBrand('commercial')}
              count={counts.commercial}
              active={active === 'commercial'}
              onClick={() => pick('commercial')}
            />
          )}
        </div>
      </Dialog>
    </>
  );
}

function ProgramSearchInline({ onPick }: { onPick: (id: string) => void }) {
  const {
    activeHit,
    activeIndex,
    choose,
    clear,
    expanded,
    handleBlur,
    handleKeyDown,
    listboxId,
    loading,
    setActiveIndex,
    setResultsOpen,
    status,
    statusId,
    updateValue,
    value,
    visibleHits,
    wrapperRef,
  } = useProgramCombobox((hit) => onPick(hit.id));

  return (
    <div
      ref={wrapperRef}
      className="relative min-w-0 flex-1 sm:min-w-[15rem] sm:flex-none"
      onBlur={handleBlur}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const hit = activeHit ?? visibleHits[0];
          if (hit) choose(hit);
        }}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5"
      >
        <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={value}
          onChange={(event) => updateValue(event.target.value)}
          onFocus={() => {
            if (visibleHits.length > 0) setResultsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Program name or city"
          aria-label="Find a program by name or city"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-activedescendant={activeHit ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-describedby={statusId}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {loading && <span className="text-xs text-slate-400" aria-hidden>…</span>}
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear program search"
            className="shrink-0 text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        )}
      </form>
      <p id={statusId} role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {expanded && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Program search results"
          className="absolute right-0 z-20 mt-1 max-h-72 w-full min-w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {visibleHits.map((hit, index) => (
            <li key={hit.id} role="presentation">
              <button
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(hit)}
                className={
                  'w-full rounded-lg px-3 py-2 text-left ' +
                  (activeIndex === index ? 'bg-teal-50' : 'hover:bg-teal-50')
                }
              >
                <span className="block truncate text-sm font-medium text-slate-700">{hit.name}</span>
                <span className="block truncate text-xs text-slate-400">
                  {[hit.city, hit.state].filter(Boolean).join(', ') || 'Location on file'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
