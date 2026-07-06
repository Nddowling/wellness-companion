'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Chip, Dialog } from '@/components/ui';
import { LEVELS_OF_CARE, LEVEL_LABELS, PAYER_LABELS, type PayerType } from '@/lib/constants';
import { US_STATES } from '@/lib/geo';
import { payerTypeBrand, commercialCarriers } from '@/lib/payers';
import { PayerMark } from '@/components/PayerLogo';

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
    q: sp.get('q') ?? '',
    open: sp.get('open') ?? '',
    spec: sp.get('spec') ?? '',
    pop: sp.get('pop') ?? '',
  };

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
  if (cur.q) activeChips.push({ key: 'q', label: `“${cur.q}”` });
  if (cur.spec) activeChips.push({ key: 'spec', label: cur.spec });
  if (cur.pop) activeChips.push({ key: 'pop', label: cur.pop });
  if (cur.open) activeChips.push({ key: 'open', label: 'Available now' });

  return (
    <div className="space-y-3">
      {/* Level of care — the primary axis, always visible as segmented chips. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Chip active={!cur.level} interactive onClick={() => push({ level: null })}>
          All care
        </Chip>
        {LEVELS_OF_CARE.map((l) => (
          <Chip
            key={l}
            active={cur.level === l}
            interactive
            count={facets.levels[l]}
            onClick={() => push({ level: cur.level === l ? null : l })}
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
          onSelect={(v) => push({ pay: v })}
        />
        <FacetSelect
          label="Location"
          activeLabel={cur.region ? US_STATES[cur.region] ?? cur.region : undefined}
          options={regionOptions}
          onSelect={(v) => push({ region: v })}
        />
        <Chip tone="sage" active={!!cur.open} interactive onClick={() => push({ open: cur.open ? null : '1' })}>
          <span aria-hidden className="text-emerald-500">●</span> Available now
        </Chip>
        <SearchInline value={cur.q} onSubmit={(q) => push({ q: q || null })} />
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
            onClick={() => router.push(pathname, { scroll: false })}
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

// Insurance picker. The 4 public/military/self buckets filter directly; "Commercial"
// is expanded into named carrier logos (Aetna, BCBS, Cigna, …) that all map to the
// single matchable `commercial` payer_type — so people see recognizable brands while
// the count stays honest (one commercial number, shown once on the group header).
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
            <>
              <OptionRow
                label="Commercial insurance"
                brand={payerTypeBrand('commercial')}
                count={counts.commercial}
                active={active === 'commercial'}
                onClick={() => pick('commercial')}
              />
              {/* Named carriers — a friendlier way to pick "commercial". */}
              <div className="ml-3 flex flex-wrap gap-1.5 border-l border-slate-100 pl-3 pb-1">
                {commercialCarriers().map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => pick('commercial')}
                    className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                  >
                    <PayerMark brand={c.brand} size="sm" />
                    {c.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}

function SearchInline({ value, onSubmit }: { value: string; onSubmit: (q: string) => void }) {
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(val.trim()); }}
      className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 sm:min-w-[13rem] sm:flex-none"
    >
      <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Name, city, condition…"
        aria-label="Search programs"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
      />
      {val && (
        <button type="button" onClick={() => { setVal(''); onSubmit(''); }} aria-label="Clear search" className="shrink-0 text-slate-400 hover:text-slate-600">
          ×
        </button>
      )}
    </form>
  );
}
