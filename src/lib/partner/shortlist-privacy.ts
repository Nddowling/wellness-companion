import { randomBytes, randomUUID } from 'node:crypto';

const SHARE_TOKEN_BYTES = 32;
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

function numericReference(id: string): string {
  const prefix = id.replace(/[^0-9a-f]/gi, '').slice(0, 8).padEnd(8, '0');
  const value = Number.parseInt(prefix, 16);
  return (Number.isFinite(value) ? value % 100_000_000 : 0).toString().padStart(8, '0');
}

/** A deterministic label containing no partner- or client-supplied text. */
export function shortlistDisplayTitle(id: string, createdAt: string): string {
  const parsed = new Date(createdAt);
  const date = Number.isNaN(parsed.getTime()) ? 'date-unavailable' : parsed.toISOString().slice(0, 10);
  return `Treatment program shortlist #${numericReference(id)} - ${date}`;
}

/** Safe insert values for deployments where the database privacy trigger is not live yet. */
export function newShortlistIdentity(now = new Date()) {
  const id = randomUUID();
  const created_at = now.toISOString();
  return { id, created_at, title: shortlistDisplayTitle(id, created_at) };
}

/** 256 bits of CSPRNG output, encoded without URL-reserved characters. */
export function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
}

export function isValidShareToken(token: string): boolean {
  return SHARE_TOKEN_PATTERN.test(token);
}
