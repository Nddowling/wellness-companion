'use client';

import { useRouter } from 'next/navigation';
import { useProgramCombobox } from '@/components/search/useProgramCombobox';

/**
 * Partner directory lookup that keeps typed program names/cities out of URLs,
 * browser history, referrers, and analytics. It never accepts client details.
 */
export function ProgramLookup() {
  const router = useRouter();
  const {
    activeHit,
    activeIndex,
    choose,
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
  } = useProgramCombobox((hit) => router.push(`/partners/facility/${hit.id}`));

  return (
    <div className="space-y-1.5">
      <div
        ref={wrapperRef}
        className="relative"
        onBlur={handleBlur}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const hit = activeHit ?? visibleHits[0];
            if (hit) choose(hit);
          }}
          className="flex gap-2"
        >
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
            spellCheck={false}
            maxLength={100}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-teal-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!visibleHits[0]}
            className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? 'Searching…' : 'Open'}
          </button>
        </form>

        <p id={statusId} role="status" aria-live="polite" className="sr-only">
          {status}
        </p>

        {expanded && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Program search results"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
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
      <p className="text-xs text-slate-500">
        Program names and cities only. Do not enter a client name or personal details; lookup text is not placed in the URL.
      </p>
    </div>
  );
}
