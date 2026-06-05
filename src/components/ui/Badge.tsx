import { cn } from './cn';

// Small status pill. `green/amber/red` carry the availability + safety semantics
// already used on the match results and program cards; `neutral/brand` are for
// non-status labels (level of care, tags).

export type BadgeTone = 'green' | 'amber' | 'red' | 'neutral' | 'brand';

const tones: Record<BadgeTone, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
  brand: 'bg-teal-50 text-teal-700',
};

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
