import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { applicationSecuritySecret } from '@/lib/security/app-secret';

export const HANDOFF_COOKIE = 'cb_handoff';
const TOKEN_TTL_SECONDS = 2 * 60 * 60;
const MAX_RECIPIENTS = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HandoffTokenPayload = {
  v: 1;
  matchId: string;
  recipientFacilityIds: string[];
  expires: number;
  nonce: string;
};

export type HandoffCapability = Readonly<{
  matchId: string;
  recipientFacilityIds: readonly string[];
}>;

function signature(payload: string): string {
  return createHmac('sha256', applicationSecuritySecret())
    .update(`clearbed:handoff-token\0${payload}`)
    .digest('base64url');
}

function validRecipientIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_RECIPIENTS &&
    value.every((id) => typeof id === 'string' && UUID.test(id)) &&
    new Set(value.map((id) => id.toLowerCase())).size === value.length
  );
}

/**
 * Issue a short-lived, HttpOnly capability for the exact program cards returned
 * by /api/match. The manifest is ordered and signed; later routes added to the
 * same match never inherit this browser's sharing permission.
 */
export function issueHandoffToken(matchId: string, recipientFacilityIds: readonly string[]): string {
  if (!UUID.test(matchId) || !validRecipientIds(recipientFacilityIds)) {
    throw new Error('Invalid handoff capability input');
  }
  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const nonce = randomBytes(18).toString('base64url');
  const manifest: HandoffTokenPayload = {
    v: 1,
    matchId,
    recipientFacilityIds: [...recipientFacilityIds],
    expires,
    nonce,
  };
  const payload = Buffer.from(JSON.stringify(manifest), 'utf8').toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function handoffCookie(token: string): string {
  const secure = process.env.VERCEL === '1' ? '; Secure' : '';
  return `${HANDOFF_COOKIE}=${token}; Path=/api/handoff; HttpOnly; SameSite=Strict; Max-Age=${TOKEN_TTL_SECONDS}${secure}`;
}

export function tokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === HANDOFF_COOKIE) return value.join('=') || null;
  }
  return null;
}

export function verifyHandoffToken(
  token: string | null,
  expectedMatchId: string,
): HandoffCapability | null {
  if (!token || token.length > 2048 || !UUID.test(expectedMatchId)) return null;
  const [payload, supplied, ...extra] = token.split('.');
  if (!payload || !supplied || extra.length > 0) return null;
  const expected = signature(payload);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return null;
    const manifest = decoded as Partial<HandoffTokenPayload>;
    if (
      manifest.v !== 1 ||
      manifest.matchId !== expectedMatchId ||
      !validRecipientIds(manifest.recipientFacilityIds) ||
      !Number.isSafeInteger(manifest.expires) ||
      (manifest.expires as number) < Math.floor(Date.now() / 1000) ||
      typeof manifest.nonce !== 'string' ||
      !/^[A-Za-z0-9_-]{24}$/.test(manifest.nonce)
    ) {
      return null;
    }
    return {
      matchId: manifest.matchId,
      recipientFacilityIds: Object.freeze([...manifest.recipientFacilityIds]),
    };
  } catch {
    return null;
  }
}
