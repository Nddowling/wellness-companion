import 'server-only';

/**
 * One rotatable application-security secret, domain-separated at every HMAC
 * callsite. It never reaches a browser bundle and never falls back to a database
 * credential in hosted production.
 */
export function applicationSecuritySecret(): string {
  const value =
    process.env.HANDOFF_TOKEN_SECRET ||
    (process.env.NODE_ENV !== 'production'
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : undefined);

  if (!value) throw new Error('Application security signing secret is not configured');
  if (value.length < 32) throw new Error('Application security signing secret is too short');
  return value;
}
