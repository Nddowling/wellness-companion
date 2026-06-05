import { cn } from './cn';

// Shared button styling. Exported as a function so it can dress either a real
// <button> (use <Button>) or a Next <Link>/<a> CTA (use buttonVariants() on the
// link's className) — most CTAs in this app are links, so both paths matter.

export type ButtonVariant = 'primary' | 'cta' | 'outline' | 'ghost' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold ' +
  'transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ' +
  'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  // Quiet primary — the workhorse action (sign in, send, save).
  primary: 'bg-teal-700 text-white hover:bg-teal-800',
  // Warm conversion CTA — "Find care". Used sparingly, it should feel inviting.
  cta: 'bg-terracotta text-white shadow-lg hover:-translate-y-0.5 hover:bg-terracotta-dark',
  // On photography / dark grounds, or as a secondary next to a filled button.
  outline: 'border border-slate-300 bg-white text-slate-700 hover:border-teal-600 hover:text-teal-700',
  // Text-only action.
  ghost: 'text-teal-700 hover:bg-teal-50',
  // Tinted, low-emphasis (chips, pill toggles).
  subtle: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-sm',
};

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(base, variants[variant], sizes[size], className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}
