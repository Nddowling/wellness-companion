import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { getRoles, profileType } from '@/lib/auth';
import { toFacilitySummary, type FacilityRowForSummary } from '@/lib/facility/summary';
import { sendSensitiveEmail, sensitiveEmailConfigured } from '@/lib/email/send';
import { treatmentInfoEmail } from '@/lib/email/templates';
import { tokenFromCookie, verifyHandoffToken } from '@/lib/matching/handoff-token';
import { readBoundedJson, RequestBodyError } from '@/lib/request-body';
import {
  anonymousBudgetHeaders,
  consumeAnonymousBudget,
} from '@/lib/security/anonymous-guard';
import {
  completeConnectorHandoff,
  finishTreatmentEmail,
  reserveTreatmentEmail,
  setSeekerAuthUser,
} from '@/lib/vault/seekers';

// Seeker "complete & connect" endpoint.
//
// PATH A — we are a CONNECTOR, not a provider. After matches are shown, this accepts
// only one voluntary contact method and explicit permissions. Match facilities are
// derived from the signed program manifest returned with /api/match; the browser
// cannot nominate arbitrary programs or inherit routes appended later.
//
// Do NOT re-add persistence of the raw blob: that rebuilds a clinical record in a
// non-BAA database. Storing PHI requires the project-b preconditions (BAA + HIPAA
// add-on + security review + 42 CFR Part 2 / EKRA sign-off) — not a feature flag.

type Body = {
  match_id?: string;
  contact?: { phone?: unknown; email?: unknown };
  consents?: { email?: boolean; share?: boolean };
};

const MAX_BODY_BYTES = 4 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function json(
  body: Record<string, unknown>,
  status: number,
  headers: HeadersInit = { 'Cache-Control': 'no-store' },
): Response {
  return Response.json(body, { status, headers });
}

function validEmail(value: string | undefined): string | undefined {
  if (!value || value.length > 254) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value.toLowerCase() : undefined;
}

function validPhone(value: string | undefined): string | undefined {
  if (!value || value.length > 50) return undefined;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? value : undefined;
}

export async function GET() {
  return json({ emailCopyAvailable: sensitiveEmailConfigured() }, 200);
}

export async function POST(request: Request) {
  let parsed: unknown;
  try {
    parsed = await readBoundedJson(request, MAX_BODY_BYTES);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return json(
      { error: status === 413 ? 'Request body is too large' : 'Invalid JSON' },
      status,
    );
  }
  if (!isRecord(parsed)) {
    return json({ error: 'Expected a JSON object' }, 400);
  }
  const body = parsed as Body;

  const allowedTopLevel = new Set(['match_id', 'contact', 'consents']);
  if (Object.keys(body).some((key) => !allowedTopLevel.has(key))) {
    return json({ error: 'Unexpected handoff field' }, 400);
  }

  const matchId = typeof body.match_id === 'string' ? body.match_id : '';
  const token = tokenFromCookie(request.headers.get('cookie'));
  const capability = UUID.test(matchId) ? verifyHandoffToken(token, matchId) : null;
  if (!capability) {
    return json({ error: 'This match session is invalid or expired' }, 403);
  }

  if (!isRecord(body.consents)) {
    return json({ error: 'Both permission choices are required' }, 400);
  }
  const allowedConsents = new Set(['email', 'share']);
  if (
    Object.keys(body.consents).some((key) => !allowedConsents.has(key)) ||
    typeof body.consents.email !== 'boolean' ||
    typeof body.consents.share !== 'boolean'
  ) {
    return json({ error: 'Both permission choices are required' }, 400);
  }
  const consents = { email: body.consents.email, share: body.consents.share };

  const allowedContact = new Set(['phone', 'email']);
  const contact = body.contact === undefined ? {} : body.contact;
  if (!isRecord(contact) || Object.keys(contact).some((key) => !allowedContact.has(key))) {
    return json({ error: 'Provide one contact method only' }, 400);
  }
  if (contact.phone !== undefined && typeof contact.phone !== 'string') {
    return json({ error: 'Enter a valid phone number' }, 400);
  }
  if (contact.email !== undefined && typeof contact.email !== 'string') {
    return json({ error: 'Enter a valid email address' }, 400);
  }
  const rawPhone = str(contact.phone);
  const rawEmail = str(contact.email);
  const identity = { phone: validPhone(rawPhone), email: validEmail(rawEmail) };
  if (rawPhone && !identity.phone) {
    return json({ error: 'Enter a valid phone number' }, 400);
  }
  if (rawEmail && !identity.email) {
    return json({ error: 'Enter a valid email address' }, 400);
  }
  if (identity.phone && identity.email) {
    return json({ error: 'Provide only one contact method' }, 400);
  }
  if ((consents.share || consents.email) && !identity.phone && !identity.email) {
    return json({ error: 'A contact method is required for this permission' }, 400);
  }
  if (consents.email && !identity.email) {
    return json({ error: 'An email address is required for email permission' }, 400);
  }
  if (consents.email && !sensitiveEmailConfigured()) {
    return json(
      { error: 'Email copies are temporarily unavailable; you can still contact programs directly' },
      503,
    );
  }

  const budget = await consumeAnonymousBudget(request, 'handoff');
  if (!budget.ok) {
    return json(
      {
        error:
          budget.status === 429
            ? 'Please wait before submitting another connection request.'
            : 'Connections are temporarily unavailable.',
      },
      budget.status,
      anonymousBudgetHeaders(budget),
    );
  }

  const responseHeaders = anonymousBudgetHeaders(budget);
  const supabase = createAdminClient();
  const needsRecipients = consents.share || consents.email;
  let facilities: (FacilityRowForSummary & { id: string })[] = [];

  if (needsRecipients) {
    if (capability.recipientFacilityIds.length === 0) {
      return json({ error: 'No programs are available for this connection' }, 404, responseHeaders);
    }
    const { data: facRows, error: facilitiesError } = await supabase
      .from('facilities')
      .select(
        'id, name, city, state, levels_of_care, referral_contact, facility_capacity(level_of_care, beds_available, last_updated), facility_payers(payer_type)'
      )
      .in('id', [...capability.recipientFacilityIds])
      .eq('is_published', true);
    if (facilitiesError) {
      console.error('[handoff] recipient lookup failed', {
        code: facilitiesError.code ?? 'unknown',
      });
      return json({ error: 'Could not load matching programs' }, 500, responseHeaders);
    }

    const availableById = new Map(
      ((facRows ?? []) as unknown as (FacilityRowForSummary & { id: string })[])
        .map((facility) => [facility.id, facility] as const),
    );
    facilities = capability.recipientFacilityIds
      .map((facilityId) => availableById.get(facilityId))
      .filter((facility): facility is FacilityRowForSummary & { id: string } => Boolean(facility));
    if (facilities.length === 0) {
      return json({ error: 'No programs are currently available for this connection' }, 404, responseHeaders);
    }
  }

  let completion;
  try {
    completion = await completeConnectorHandoff({
      matchId,
      recipientFacilityIds: facilities.map((facility) => facility.id),
      identity,
      consents,
    });
  } catch (error) {
    console.error('[handoff] permission transaction failed', {
      kind: error instanceof Error ? error.name : 'unknown',
    });
    return json({ error: 'Could not save that permission choice safely' }, 500, responseHeaders);
  }
  const seekerId = completion.seekerId;
  const contactSaved = Boolean(
    seekerId && (completion.consentEmail || completion.consentShare),
  );

  const summaries = facilities
    .map((f) => toFacilitySummary(f as unknown as FacilityRowForSummary))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // /match is anonymous-start by design. If the seeker is already signed in, link
  // this search to that account. Never create an account merely because someone
  // asked for an email copy; account creation requires a separate, explicit action.
  if (contactSaved && seekerId) {
    try {
      const roles = await getRoles();
      if (profileType(roles) === 'seeker' && roles.user) {
        await setSeekerAuthUser(seekerId, roles.user.id);
      }
    } catch {
      // Linking is secondary to the explicit contact decision. The compare-and-set
      // refused a cross-account transfer; log no IDs or contact details.
      console.warn('[handoff] account link was not applied');
    }
  }

  // Email exactly what was requested: one copy of the matched-program information.
  // A delivery failure is surfaced to the browser instead of being silently treated
  // as success. The matches remain available in-page either way.
  let emailSent: boolean | null = null;
  if (completion.consentEmail && identity.email && seekerId) {
    if (!sensitiveEmailConfigured()) {
      // Do not create an at-most-once reservation for a message that was never
      // attempted. A later retry may proceed after an approved sender is configured.
      console.warn('[handoff] sensitive email transport is unavailable');
      emailSent = false;
    } else {
      try {
        const reservation = await reserveTreatmentEmail(seekerId, identity.email);
        if (reservation.shouldSend) {
          const message = treatmentInfoEmail(undefined, summaries);
          const result = await sendSensitiveEmail({ to: identity.email, ...message });
          emailSent = result.ok;
          try {
            await finishTreatmentEmail(
              reservation.logId,
              result.ok ? 'sent' : 'failed',
              result.id,
            );
          } catch {
            // The pending reservation intentionally remains an at-most-once latch.
            // Never retry the external send merely because final bookkeeping failed.
            console.error('[handoff] email delivery status could not be finalized');
          }
        } else {
          emailSent =
            reservation.status === 'sent'
              ? true
              : reservation.status === 'failed' || reservation.status === 'recipient_mismatch'
                ? false
                : null;
        }
      } catch (error) {
        // The permission/contact transaction is already complete; report the email
        // as failed without misrepresenting or rolling back the sharing decision.
        console.error('[handoff] treatment email workflow failed', {
          kind: error instanceof Error ? error.name : 'unknown',
        });
        emailSent = false;
      }
    }
  }

  // NOTE: there is deliberately NO outbound send of seeker details to facilities here.
  // Consented contact details are surfaced to the facility in-app (Contacts), where the
  // facility runs its own intake. Emailing a referral packet to third-party inboxes is
  // exactly what 42 CFR Part 2 governs — do not reintroduce it.

  return json(
    {
      ok: true,
      mode: completion.consentEmail || completion.consentShare ? 'connect' : 'direct',
      contactSaved,
      shared: completion.consentShare && completion.sharedFacilityCount > 0,
      emailSent,
      facilities: facilities.map((facility) => ({
        id: facility.id,
        name: facility.name,
        referral_contact: facility.referral_contact,
      })),
    },
    200,
    responseHeaders,
  );
}
