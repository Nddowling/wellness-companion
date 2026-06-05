import { cn } from './ui/cn';

// The ClearBed wordmark lockup: a small dot-cluster mark + the two-tone
// "ClearBed" wordmark ("Clear" sage-teal, "Bed" deep teal). Set the overall
// size with a text-size class (e.g. text-xl); the mark scales with the text.
//
// `tone="light"` is for dark/photographic backgrounds (login panel, footer,
// hero) — it brightens the wordmark and mark so they stay legible.

// Lockup tones — specific to the logo, kept here rather than as global tokens so
// the wordmark reads the same everywhere it appears.
const TONES = {
  color: { clear: '#46a18d', bed: '#2a544f', dotA: '#46a18d', dotB: '#2a544f' },
  light: { clear: '#7ad9bb', bed: '#ffffff', dotA: '#7ad9bb', dotB: '#d7f0e7' },
} as const;

export type LogoProps = {
  className?: string;
  tone?: keyof typeof TONES;
  /** Hide the dot mark and show the wordmark alone. */
  markless?: boolean;
};

export function Logo({ className, tone = 'color', markless = false }: LogoProps) {
  const c = TONES[tone];
  return (
    <span
      role="img"
      aria-label="Clear Bed Recovery"
      className={cn(
        'inline-flex select-none items-center gap-2 font-logo font-extrabold leading-none tracking-tight',
        className,
      )}
    >
      {!markless && (
        <svg viewBox="0 0 40 40" className="h-[1.05em] w-[1.05em] shrink-0" aria-hidden>
          <circle cx="25" cy="15" r="9" fill={c.dotA} />
          <circle cx="13" cy="26" r="6" fill={c.dotB} />
          <circle cx="12.5" cy="12.5" r="3" fill={c.dotA} />
        </svg>
      )}
      <span aria-hidden>
        <span style={{ color: c.clear }}>Clear</span>
        <span style={{ color: c.bed }}>Bed</span>
      </span>
    </span>
  );
}
