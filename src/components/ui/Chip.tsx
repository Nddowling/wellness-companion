import { cn } from './cn';

// The atomic pill of the whole design system — filter chips, tag chips, defined
// taxonomy terms, "+N more" overflow, and snapshot chips all render as a Chip so
// they stay visually identical everywhere the same term appears. Presentational:
// interactivity (toggling a filter, expanding a definition) is composed around it.

export type ChipTone = 'neutral' | 'brand' | 'sage' | 'sand';
export type ChipSize = 'sm' | 'md';

const toneClasses: Record<ChipTone, { off: string; on: string }> = {
  neutral: { off: 'bg-slate-100 text-slate-700 border-transparent', on: 'bg-teal-700 text-white border-teal-700' },
  brand: { off: 'bg-teal-50 text-teal-700 border-teal-100', on: 'bg-teal-700 text-white border-teal-700' },
  sage: { off: 'bg-emerald-50 text-emerald-700 border-emerald-100', on: 'bg-emerald-600 text-white border-emerald-600' },
  sand: { off: 'bg-sand/60 text-ink border-transparent', on: 'bg-ink text-white border-ink' },
};

const sizeClasses: Record<ChipSize, string> = {
  sm: 'text-[11px] px-2 py-0.5 gap-1',
  md: 'text-xs px-3 py-1 gap-1.5',
};

export type ChipProps = {
  children: React.ReactNode;
  tone?: ChipTone;
  size?: ChipSize;
  /** Filled/selected state — for filter and toggle chips. */
  active?: boolean;
  /** Count badge, e.g. Insurance (3) or a facet option's "· 74". */
  count?: number;
  /** Renders a hover/focus affordance + pointer when the chip does something. */
  interactive?: boolean;
  /** Small × to clear, e.g. an active filter chip. */
  onRemove?: () => void;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'onClick'> & { onClick?: React.MouseEventHandler<HTMLSpanElement> };

export function Chip({
  children,
  tone = 'neutral',
  size = 'md',
  active = false,
  count,
  interactive,
  onRemove,
  className,
  onClick,
  ...rest
}: ChipProps) {
  const t = toneClasses[tone];
  const clickable = interactive || !!onClick;
  return (
    <span
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.(e as unknown as React.MouseEvent<HTMLSpanElement>);
              }
            }
          : undefined
      }
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition select-none',
        sizeClasses[size],
        active ? t.on : t.off,
        clickable && 'min-h-11 cursor-pointer hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:min-h-0',
        className,
      )}
      {...rest}
    >
      {children}
      {typeof count === 'number' && (
        <span className={cn('tabular-nums', active ? 'opacity-90' : 'text-slate-500')}>
          {count.toLocaleString()}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove filter"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="-mr-1 ml-0.5 grid h-4 w-4 place-items-center rounded-full hover:bg-black/10"
        >
          <span aria-hidden className="text-[13px] leading-none">×</span>
        </button>
      )}
    </span>
  );
}
