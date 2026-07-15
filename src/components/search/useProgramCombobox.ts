'use client';

import { useEffect, useId, useRef, useState } from 'react';

export type ProgramHit = { id: string; name: string; city: string | null; state: string | null };

/** Shared state and keyboard behavior for the public and partner program lookups. */
export function useProgramCombobox(onChoose: (hit: ProgramHit) => void) {
  const [value, setValue] = useState('');
  const [hits, setHits] = useState<ProgramHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const statusId = useId();
  const visibleHits = value.trim().length >= 2 ? hits : [];
  const expanded = resultsOpen && visibleHits.length > 0;
  const activeHit = expanded && activeIndex >= 0 ? visibleHits[activeIndex] : undefined;

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/facilities/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q }),
          signal: controller.signal,
        });
        const body = (await response.json()) as { facilities?: ProgramHit[] };
        const nextHits = response.ok ? (body.facilities ?? []).slice(0, 8) : [];
        setHits(nextHits);
        setActiveIndex(-1);
        setResultsOpen(nextHits.length > 0);
      } catch {
        if (!controller.signal.aborted) {
          setHits([]);
          setActiveIndex(-1);
          setResultsOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const choose = (hit: ProgramHit) => {
    setValue(hit.name);
    setHits([]);
    setActiveIndex(-1);
    setResultsOpen(false);
    onChoose(hit);
  };

  const clear = () => {
    setValue('');
    setHits([]);
    setLoading(false);
    setResultsOpen(false);
    setActiveIndex(-1);
  };

  const updateValue = (next: string) => {
    const hasQuery = next.trim().length >= 2;
    setValue(next);
    setHits([]);
    setActiveIndex(-1);
    setResultsOpen(hasQuery);
    setLoading(hasQuery);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (visibleHits.length === 0) return;
      event.preventDefault();
      setResultsOpen(true);
      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') return current < visibleHits.length - 1 ? current + 1 : 0;
        return current > 0 ? current - 1 : visibleHits.length - 1;
      });
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation();
      setResultsOpen(false);
      setActiveIndex(-1);
    } else if (event.key === 'Home' && expanded) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End' && expanded) {
      event.preventDefault();
      setActiveIndex(visibleHits.length - 1);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextFocus = event.relatedTarget;
    if (!(nextFocus instanceof Node) || !wrapperRef.current?.contains(nextFocus)) {
      setResultsOpen(false);
      setActiveIndex(-1);
    }
  };

  const status = loading
    ? 'Searching for programs.'
    : value.trim().length >= 2
      ? `${visibleHits.length} program${visibleHits.length === 1 ? '' : 's'} found.`
      : '';

  return {
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
  };
}
