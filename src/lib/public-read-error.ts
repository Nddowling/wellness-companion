import 'server-only';

type PublicReadError = { code?: string | null } | null | undefined;

/**
 * Public SEO pages must not turn a transient database failure into an empty page
 * or cacheable 404. Throwing lets the route fail temporarily (and lets ISR retain
 * an existing good response) without publishing false directory facts.
 */
export function throwOnPublicReadError(context: string, error: PublicReadError): void {
  if (!error) return;
  console.error('[public-directory] read failed', {
    context,
    code: error.code ?? 'unknown',
  });
  throw new Error('Public directory data is temporarily unavailable.');
}
