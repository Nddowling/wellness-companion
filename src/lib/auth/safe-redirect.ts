const INTERNAL_ORIGIN = 'https://clearbed.invalid';
const UNSAFE_PATH_CHARACTERS = /[\\\u0000-\u001f\u007f]/;
const ENCODED_PATH_SEPARATOR_OR_CONTROL = /%(?:2f|5c|00|0[ad]|1[0-9a-f]|7f)/i;

/**
 * Return a same-origin path suitable for post-auth navigation.
 *
 * URL parsers normalize backslashes as slashes, so a check that only rejects
 * `//host` still permits `/\\host`. Validate both literal and encoded forms and
 * confirm the parsed origin before returning a path. Fragments are dropped so an
 * auth hash can never be inherited by a destination page.
 */
export function safeInternalPath(value: string | null | undefined, fallback: string | null = '/home'): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;

  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    if (UNSAFE_PATH_CHARACTERS.test(decoded) || ENCODED_PATH_SEPARATOR_OR_CONTROL.test(decoded)) return fallback;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return fallback;
    }
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || UNSAFE_PATH_CHARACTERS.test(decoded)) return fallback;

  try {
    const parsed = new URL(value, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN || parsed.username || parsed.password) return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}
