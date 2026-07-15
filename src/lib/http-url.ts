/** Return a normalized absolute HTTP(S) URL, or null for blank/invalid input. */
export function safeHttpUrl(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Normalize an optional form URL and distinguish blank from malformed input. */
export function optionalHttpUrl(raw: unknown, label = 'Website'): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const normalized = safeHttpUrl(value);
  if (!normalized) throw new Error(`${label} must be a valid http:// or https:// URL.`);
  return normalized;
}
