import { Chip, Tooltip } from '@/components/ui';
import { glossaryLookup } from '@/lib/glossary';
import { LEVEL_LABELS, type LevelOfCare } from '@/lib/constants';

// The row of "snapshot" chips right under a facility's name — focus, levels of
// care, rating, payment. Clinical terms are defined-chips: tap/hover reveals a
// plain-English explainer (from the shared glossary) exactly at the moment
// someone is sizing the program up. Server component; Tooltip handles the
// client-side reveal.

export type SnapshotBarProps = {
  /** e.g. operator type / "Substance use". */
  focus?: string | null;
  /** Canonical level codes (detox/residential/php/iop/op). */
  levels: string[];
  rating?: { avg: number; count: number } | null;
  /** Short payment summary, e.g. "Medicaid · Commercial". */
  paymentLabel?: string | null;
};

function DefinedChip({ term, label }: { term: string; label: string }) {
  const g = glossaryLookup(term);
  if (!g) return <Chip>{label}</Chip>;
  return (
    <Tooltip content={g.definition}>
      <Chip>{label}</Chip>
    </Tooltip>
  );
}

export function SnapshotBar({ focus, levels, rating, paymentLabel }: SnapshotBarProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {focus && <DefinedChip term={focus} label={focus} />}
      {levels.map((l) => (
        <DefinedChip key={l} term={l} label={LEVEL_LABELS[l as LevelOfCare] ?? l} />
      ))}
      {rating && (
        <a href="#reviews">
          <Chip tone="sand">
            <span aria-hidden className="text-amber-500">★</span> {rating.avg.toFixed(1)}
            <span className="text-slate-500"> ({rating.count})</span>
          </Chip>
        </a>
      )}
      {paymentLabel && <Chip tone="brand">{paymentLabel}</Chip>}
    </div>
  );
}
