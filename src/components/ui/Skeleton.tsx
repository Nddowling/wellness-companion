import { cn } from './cn';

// Loading placeholder. Reserve the same box a real result will occupy so pages
// don't shift when data arrives (CLS discipline). Uses Tailwind's animate-pulse;
// respects prefers-reduced-motion via the global rule in globals.css.

export type SkeletonProps = {
  className?: string;
  /** Convenience for a line of text; stacks N shimmer bars. */
  lines?: number;
} & React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, lines, ...rest }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className="space-y-2" {...rest}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn('h-3 animate-pulse rounded bg-slate-200', i === lines - 1 && 'w-2/3', className)}
          />
        ))}
      </div>
    );
  }
  return <div className={cn('animate-pulse rounded-md bg-slate-200', className)} {...rest} />;
}
