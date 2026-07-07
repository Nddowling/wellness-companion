import 'server-only';

/**
 * Handoff compliance gate.
 *
 * 'direct'  — BETA DEFAULT. The seeker's identity/insurance never reach our
 *             servers; they email the facility from their own device. /api/handoff
 *             records only the de-identified connection. No PHI, no BAA needed.
 *
 * 'forward' — DARK. The full "forward the seeker's details to the facility and
 *             persist nothing" path. It stays disabled until a BAA + HIPAA add-on +
 *             42 CFR Part 2 / EKRA attorney review of the exact transport channel
 *             are in place. Enabling it requires HANDOFF_BAA_SIGNED=true.
 */
export type HandoffMode = 'direct' | 'forward';

// EMERGENCY KILL SWITCH — see api/handoff/route.ts. PHI forwarding is hard-disabled
// everywhere until the isolated vault project + BAA + secure (non-email) delivery exist.
export const FORWARDING_HARD_DISABLED = true;

export function handoffMode(): HandoffMode {
  if (FORWARDING_HARD_DISABLED) return 'direct';
  const requested = process.env.HANDOFF_MODE === 'forward' ? 'forward' : 'direct';
  // Never silently enable PHI forwarding — fall back to direct without the gate.
  if (requested === 'forward' && process.env.HANDOFF_BAA_SIGNED !== 'true') {
    return 'direct';
  }
  return requested;
}

/** Hard stop: throws unless the BAA + legal review gate has been explicitly cleared. */
export function assertForwardAllowed(): void {
  if (FORWARDING_HARD_DISABLED || process.env.HANDOFF_BAA_SIGNED !== 'true') {
    throw new Error(
      'PHI forwarding is disabled. It requires a signed BAA + HIPAA add-on + 42 CFR Part 2 / EKRA legal review of the transport channel before any real seeker data is forwarded. Set HANDOFF_BAA_SIGNED=true only after that review.'
    );
  }
}
