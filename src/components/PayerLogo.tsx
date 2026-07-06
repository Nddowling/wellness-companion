import { cn } from '@/components/ui';
import type { PayerBrand } from '@/lib/payers';

// A "browser-tab favicon" for an insurance payer: a small rounded brand-color tile
// with a 1–2 char monogram, optionally followed by the payer's name. Rendered
// everywhere insurance appears as an option (search overlay, filter sheet, /match
// coverage step, facility profiles) so the choices read as recognizable brands, not
// bare text. We draw a monogram tile rather than the carriers' trademarked logo files
// — on-brand, always renders, and carries no copyright/hotlink risk.

const SIZES = {
  sm: { tile: 'h-4 w-4 rounded-[3px]', one: 'text-[9px]', two: 'text-[7px]', text: 'text-sm' },
  md: { tile: 'h-5 w-5 rounded', one: 'text-[11px]', two: 'text-[8px]', text: 'text-sm' },
  lg: { tile: 'h-6 w-6 rounded-md', one: 'text-[13px]', two: 'text-[10px]', text: 'text-base' },
} as const;

export type PayerLogoSize = keyof typeof SIZES;

export function PayerMark({ brand, size = 'md', className }: { brand: PayerBrand; size?: PayerLogoSize; className?: string }) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center font-bold leading-none tracking-tight',
        s.tile,
        brand.mark.length > 1 ? s.two : s.one,
        className,
      )}
      style={{ background: brand.bg, color: brand.fg ?? '#fff' }}
    >
      {brand.mark}
    </span>
  );
}

export function PayerLogo({
  brand,
  name,
  size = 'md',
  className,
}: {
  brand: PayerBrand;
  /** When provided, the name is shown next to the mark (favicon + label). */
  name?: string;
  size?: PayerLogoSize;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <PayerMark brand={brand} size={size} />
      {name && <span className={SIZES[size].text}>{name}</span>}
    </span>
  );
}
