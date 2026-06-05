import { cn } from './cn';

// Form primitives. Inputs are uncontrolled-friendly (just forward props) so they
// work in both server-rendered forms and the client login/match flows.

const fieldBase =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink ' +
  'placeholder:text-slate-400 transition focus:border-teal-600 focus:outline-none ' +
  'focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export function Input({ className, ...props }: InputProps) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn(fieldBase, 'min-h-24 resize-y', className)} {...props} />;
}

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;
export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn('mb-1.5 block text-sm font-medium text-slate-700', className)}
      {...props}
    />
  );
}
