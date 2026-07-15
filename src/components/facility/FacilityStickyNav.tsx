'use client';

import { useEffect, useState } from 'react';

// Recovery.com-style in-page section tabs. Sticky under the header; horizontally
// scrollable on mobile. Resilient by design — it renders a tab only if that section
// actually exists in the DOM, so it works across the free and claimed profile layouts
// without the server needing to enumerate which sections are present.

const CANDIDATES: { id: string; label: string }[] = [
  { id: 'levels', label: 'Care levels' },
  { id: 'treatment', label: 'Treatment' },
  { id: 'mat', label: 'Medications' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'who', label: 'Who they serve' },
  { id: 'aftercare', label: 'Aftercare' },
  { id: 'policies', label: 'Policies' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'faqs', label: 'FAQs' },
];

export function FacilityStickyNav() {
  const [tabs, setTabs] = useState<{ id: string; label: string }[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    const frame = requestAnimationFrame(() => {
      const present = CANDIDATES.filter((t) => document.getElementById(t.id));
      setTabs(present);
      if (present.length < 2) return;

      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible[0]) setActive(visible[0].target.id);
        },
        { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
      );
      present.forEach((t) => {
        const el = document.getElementById(t.id);
        if (el) observer?.observe(el);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  if (tabs.length < 2) return null;

  return (
    <nav className="sticky top-0 z-20 -mx-4 mb-1 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
      <div className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            className={
              'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ' +
              (active === t.id
                ? 'bg-teal-700 text-white'
                : 'text-slate-600 hover:bg-teal-50 hover:text-teal-700')
            }
          >
            {t.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
