export type ValidatedMedia = Readonly<{
  extension: string;
  mimeType: string;
}>;

type HeaderReadable = Pick<Blob, 'size' | 'slice'>;

const JPEG: ValidatedMedia = { extension: 'jpg', mimeType: 'image/jpeg' };
const PNG: ValidatedMedia = { extension: 'png', mimeType: 'image/png' };
const WEBP: ValidatedMedia = { extension: 'webp', mimeType: 'image/webp' };
const AVIF: ValidatedMedia = { extension: 'avif', mimeType: 'image/avif' };
const MP4: ValidatedMedia = { extension: 'mp4', mimeType: 'video/mp4' };
const QUICKTIME: ValidatedMedia = { extension: 'mov', mimeType: 'video/quicktime' };
const WEBM: ValidatedMedia = { extension: 'webm', mimeType: 'video/webm' };
const OGG_VIDEO: ValidatedMedia = { extension: 'ogv', mimeType: 'video/ogg' };

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

async function readHeader(file: HeaderReadable): Promise<Uint8Array | null> {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return null;
  try {
    return new Uint8Array(await file.slice(0, 512).arrayBuffer());
  } catch {
    return null;
  }
}

function isoBaseMediaBrands(bytes: Uint8Array): Set<string> | null {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== 'ftyp') return null;

  const declaredBoxSize =
    bytes[0] * 0x1000000 + bytes[1] * 0x10000 + bytes[2] * 0x100 + bytes[3];
  if (declaredBoxSize < 16) return null;

  const brands = new Set<string>([ascii(bytes, 8, 4)]);
  const availableEnd = Math.min(declaredBoxSize, bytes.length);
  // Bytes 12..15 are the minor version. Compatible brands begin at byte 16.
  for (let offset = 16; offset + 4 <= availableEnd; offset += 4) {
    brands.add(ascii(bytes, offset, 4));
  }
  return brands;
}

/**
 * Identify a browser-safe image from its bytes. The browser-provided filename and
 * MIME type are deliberately ignored because both are attacker-controlled.
 */
export async function detectImageMedia(file: HeaderReadable): Promise<ValidatedMedia | null> {
  const bytes = await readHeader(file);
  if (!bytes) return null;

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return JPEG;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return PNG;
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return WEBP;

  const brands = isoBaseMediaBrands(bytes);
  if (brands?.has('avif') || brands?.has('avis')) return AVIF;

  return null;
}

/** Identify one of the public video bucket's supported containers from bytes. */
export async function detectVideoMedia(file: HeaderReadable): Promise<ValidatedMedia | null> {
  const bytes = await readHeader(file);
  if (!bytes) return null;

  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return WEBM;
  if (ascii(bytes, 0, 4) === 'OggS' && ascii(bytes, 0, bytes.length).includes('theora')) {
    return OGG_VIDEO;
  }

  const brands = isoBaseMediaBrands(bytes);
  if (!brands || brands.has('avif') || brands.has('avis')) return null;
  if (brands.has('qt  ')) return QUICKTIME;

  const mp4Brands = [
    'isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6',
    'mp41', 'mp42', 'avc1', 'dash', 'M4V ', 'M4VH', 'F4V ',
  ];
  return mp4Brands.some((brand) => brands.has(brand)) ? MP4 : null;
}

/**
 * Convert one of our public Storage URLs back to an owned object path. This is
 * intentionally strict so a forged hidden form value cannot delete another
 * tenant's object, a different bucket, or a different Supabase project.
 */
export function storageObjectPathFromPublicUrl(
  rawUrl: string,
  bucket: string,
  ownerId: string,
  supabaseUrl: string,
): string | null {
  try {
    const url = new URL(rawUrl);
    const base = new URL(supabaseUrl);
    if (url.origin !== base.origin || url.username || url.password) return null;

    const prefix = `/storage/v1/object/public/${encodeURIComponent(bucket)}/`;
    if (!url.pathname.startsWith(prefix)) return null;

    const objectPath = decodeURIComponent(url.pathname.slice(prefix.length));
    if (
      !objectPath.startsWith(`${ownerId}/`) ||
      objectPath.length > 500 ||
      objectPath.includes('\\') ||
      objectPath.includes('\0') ||
      objectPath.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      return null;
    }

    return objectPath;
  } catch {
    return null;
  }
}
