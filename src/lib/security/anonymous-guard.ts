import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { applicationSecuritySecret } from '@/lib/security/app-secret';
import { createAdminClient } from '@/lib/supabase/admin';

const GUARD_COOKIE = 'cb_guard';
const GUARD_TTL_SECONDS = 24 * 60 * 60;

type AnonymousEndpoint = 'intake' | 'match' | 'handoff' | 'track';

type BudgetRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

type BudgetClient = {
  rpc: (
    functionName: 'consume_anonymous_budget',
    args: {
      p_endpoint: AnonymousEndpoint;
      p_ip_key: string;
      p_session_key: string;
    },
  ) => Promise<{
    data: BudgetRow[] | BudgetRow | null;
    error: { code?: string } | null;
  }>;
};

export type AnonymousBudgetResult =
  | {
      ok: true;
      remaining: number;
      sessionToken: string;
      setCookie?: string;
    }
  | {
      ok: false;
      status: 429 | 503;
      retryAfterSeconds?: number;
      setCookie?: string;
    };

export function keyedSecurityDigest(domain: string, value: string): string {
  return createHmac('sha256', applicationSecuritySecret())
    .update(`clearbed:${domain}\0${value}`)
    .digest('hex');
}

function cookieSignature(payload: string): string {
  return createHmac('sha256', applicationSecuritySecret())
    .update(`clearbed:anonymous-session\0${payload}`)
    .digest('base64url');
}

function cookieValue(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === GUARD_COOKIE) return value.join('=') || null;
  }
  return null;
}

function validSessionToken(token: string | null): token is string {
  if (!token || token.length > 256) return false;
  const [nonce, expiresRaw, supplied, ...extra] = token.split('.');
  if (!nonce || !expiresRaw || !supplied || extra.length > 0) return false;

  const expires = Number(expiresRaw);
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;

  const expected = cookieSignature(`${nonce}.${expiresRaw}`);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function issueSessionToken(): string {
  const nonce = randomBytes(24).toString('base64url');
  const expires = Math.floor(Date.now() / 1000) + GUARD_TTL_SECONDS;
  const payload = `${nonce}.${expires}`;
  return `${payload}.${cookieSignature(payload)}`;
}

function serializeGuardCookie(token: string): string {
  const secure = process.env.VERCEL === '1' ? '; Secure' : '';
  return `${GUARD_COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${GUARD_TTL_SECONDS}; Priority=High${secure}`;
}

function trustedClientAddress(request: Request): string {
  // Vercel overwrites x-vercel-forwarded-for, preventing client spoofing. Local
  // development falls back to the conventional proxy headers; the raw address
  // is immediately HMACed and is never logged or stored.
  const raw =
    (process.env.VERCEL === '1'
      ? request.headers.get('x-vercel-forwarded-for')
      : request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')) ||
    'unknown';
  return raw.split(',')[0].trim().slice(0, 128) || 'unknown';
}

/**
 * Atomically consumes the endpoint's IP + signed-session budget in Postgres so
 * limits are shared by every serverless instance. Failure is closed; callers may
 * deliberately run safety/crisis handling before invoking this function.
 */
export async function consumeAnonymousBudget(
  request: Request,
  endpoint: AnonymousEndpoint,
): Promise<AnonymousBudgetResult> {
  let sessionToken: string;
  let setCookie: string | undefined;

  try {
    const supplied = cookieValue(request.headers.get('cookie'));
    if (validSessionToken(supplied)) {
      sessionToken = supplied;
    } else {
      sessionToken = issueSessionToken();
      setCookie = serializeGuardCookie(sessionToken);
    }

    const client = createAdminClient() as unknown as BudgetClient;
    const { data, error } = await client.rpc('consume_anonymous_budget', {
      p_endpoint: endpoint,
      p_ip_key: keyedSecurityDigest('anonymous-ip', trustedClientAddress(request)),
      p_session_key: keyedSecurityDigest('anonymous-session-key', sessionToken),
    });

    if (error) {
      console.error('[anonymous-budget] database check failed', {
        endpoint,
        code: error.code ?? 'unknown',
      });
      return { ok: false, status: 503, setCookie };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== 'boolean') {
      console.error('[anonymous-budget] database returned no decision', { endpoint });
      return { ok: false, status: 503, setCookie };
    }
    if (!row.allowed) {
      return {
        ok: false,
        status: 429,
        retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds) || 1),
        setCookie,
      };
    }

    return {
      ok: true,
      remaining: Math.max(0, Number(row.remaining) || 0),
      sessionToken,
      setCookie,
    };
  } catch (error) {
    console.error('[anonymous-budget] configuration check failed', {
      endpoint,
      kind: error instanceof Error ? error.name : 'unknown',
    });
    return { ok: false, status: 503, setCookie };
  }
}

export function anonymousBudgetHeaders(
  result: AnonymousBudgetResult,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
  };
  if (result.setCookie) headers['Set-Cookie'] = result.setCookie;
  if (!result.ok && result.retryAfterSeconds) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return headers;
}
