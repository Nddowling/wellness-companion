// PHI-free, client-safe helper. Builds the referral message the SEEKER sends to a
// facility from their OWN email client. The fields below live only in the browser;
// they are never sent to or stored by Clear Bed Recovery (see /api/handoff).

export type SeekerContact = {
  name?: string;
  dob?: string;
  insurance?: string;
  note?: string;
};

export function buildReferralMessage(
  facilityName: string,
  s: SeekerContact
): { subject: string; body: string } {
  const subject = 'Referral inquiry via Clear Bed Recovery';
  const body = [
    `Hello ${facilityName} team,`,
    '',
    'I found you through Clear Bed Recovery and would like to ask about availability and next steps.',
    '',
    s.name ? `Name: ${s.name}` : '',
    s.dob ? `Date of birth: ${s.dob}` : '',
    s.insurance ? `Insurance: ${s.insurance}` : '',
    s.note ? `What I'm looking for: ${s.note}` : '',
    '',
    'Thank you.',
  ]
    .filter(Boolean)
    .join('\n');
  return { subject, body };
}

/** A mailto: URL the browser can open — keeps PHI on the seeker's device. */
export function mailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
