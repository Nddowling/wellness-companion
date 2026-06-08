import { PAYER_TYPES, PAYER_LABELS, type PayerType } from '@/lib/constants';

// Payer-type slug helpers for the /insurance/* landing pages.
export function payerSlug(p: PayerType): string {
  return p.replace(/_/g, '-');
}

export function payerFromSlug(slug: string): PayerType | null {
  const norm = slug.toLowerCase().replace(/-/g, '_');
  return (PAYER_TYPES as readonly string[]).includes(norm) ? (norm as PayerType) : null;
}

export { PAYER_TYPES, PAYER_LABELS };
export type { PayerType };
