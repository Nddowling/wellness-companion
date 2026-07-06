// Computed-differentiation block. Renders the factual positioning lines produced by
// src/lib/facility/context.ts — the per-page unique value that clears Google's
// scaled-content bar and is the shape AI answer engines cite.
export function FacilityContextBlock({ lines, title = 'In context' }: { lines: string[]; title?: string }) {
  if (!lines.length) return null;
  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{title}</h2>
      <ul className="space-y-1.5 text-sm text-slate-700">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-px text-teal-600">›</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
