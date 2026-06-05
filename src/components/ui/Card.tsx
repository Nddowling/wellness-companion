import { cn } from './cn';

// The white surface used for cards, panels, and list rows across the app.
// `interactive` adds the gentle lift used on the landing's feature cards.

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
};

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const;

export function Card({ interactive, padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white',
        paddings[padding],
        interactive && 'transition hover:-translate-y-1 hover:shadow-md',
        className,
      )}
      {...props}
    />
  );
}
