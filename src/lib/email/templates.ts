import {
  LEVEL_LABELS,
  PAYER_LABELS,
  COVERAGE_LABELS,
  type LevelOfCare,
  type PayerType,
  type CoverageStatus,
} from '@/lib/constants';

// Email templates. Pure functions → { subject, html, text }. Kept simple and
// inline-styled so they render in any client without external CSS.

export type FacilitySummary = {
  name: string;
  city: string | null;
  state: string | null;
  levels: string[]; // raw level keys
  payers: string[]; // raw payer keys
  beds: number;
  freshnessLabel: string;
  contact: { name?: string; email?: string; phone?: string } | null;
};

export type SeekerFaceSheet = {
  // identity & contact
  name?: string;
  preferred_name?: string;
  dob?: string;
  phone?: string;
  contact_pref?: string;
  email?: string;
  city?: string;
  state?: string;
  zip?: string;
  language?: string;
  // insurance
  insurance?: string;
  insurance_carrier?: string;
  insurance_member_id?: string;
  insurance_group?: string;
  subscriber_name?: string;
  subscriber_relationship?: string;
  secondary_insurance?: string;
  coverage_status?: string;
  // presenting (coarse)
  concern_category?: string;
  other_substances?: string;
  last_use?: string;
  co_occurring_mh?: string;
  prior_treatment?: string;
  medications?: string;
  allergies?: string;
  region_zip3?: string;
  // emergency contact
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_phone?: string;
  // logistics
  court_ordered?: string;
  urgency?: string;
  transportation_needs?: string;
  note?: string;
};

const CRISIS =
  'If you are ever in immediate danger or crisis, call or text 988 (Suicide & Crisis Lifeline), available 24/7.';

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function wrap(title: string, inner: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
  <h1 style="font-size:20px;color:#0f766e">${esc(title)}</h1>
  ${inner}
  <p style="font-size:12px;color:#94a3b8;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px">${esc(CRISIS)}</p>
</div>`;
}

function facilityBlockHtml(f: FacilitySummary): string {
  const loc = [f.city, f.state].filter(Boolean).join(', ');
  const levels = f.levels.map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l).join(', ');
  const payers = f.payers.map((p) => PAYER_LABELS[p as PayerType] ?? p).join(', ');
  const contact = f.contact
    ? [f.contact.phone, f.contact.email].filter(Boolean).join(' · ')
    : 'Contact on file';
  return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:8px 0">
    <div style="font-weight:600">${esc(f.name)}</div>
    <div style="font-size:13px;color:#64748b">${esc(loc)} · ${esc(levels)}</div>
    <div style="font-size:13px;color:#64748b">${f.beds} beds · ${esc(f.freshnessLabel)}${payers ? ` · Accepts: ${esc(payers)}` : ''}</div>
    <div style="font-size:13px;margin-top:6px">Reach intake: <strong>${esc(contact)}</strong></div>
  </div>`;
}

function facilityBlockText(f: FacilitySummary): string {
  const loc = [f.city, f.state].filter(Boolean).join(', ');
  const levels = f.levels.map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l).join(', ');
  const contact = f.contact ? [f.contact.phone, f.contact.email].filter(Boolean).join(' · ') : 'Contact on file';
  return `• ${f.name} — ${loc} (${levels}); ${f.beds} beds; reach intake: ${contact}`;
}

// 1) Welcome — sent when a seeker shares contact info + consents to email.
export function welcomeEmail(name?: string): { subject: string; html: string; text: string } {
  const hi = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Welcome to Wellness Companion';
  const html = wrap('You took a brave first step', `
    <p>${esc(hi)}</p>
    <p>Thank you for reaching out. Finding the right treatment can feel overwhelming, and you don't have to do it alone. We'll send you the facilities that fit your needs, and you can reach out to any of them whenever you're ready — there's no pressure and no wrong pace.</p>
    <p>If you'd like, we'll also check in next week in case it helps to have a gentle reminder.</p>`);
  const text = `${hi}\n\nThank you for reaching out. We'll send you the facilities that fit your needs, and you can reach out to any of them whenever you're ready.\n\n${CRISIS}`;
  return { subject, html, text };
}

// 2) Treatment info — the matched facilities with full details + contact.
export function treatmentInfoEmail(
  name: string | undefined,
  facilities: FacilitySummary[]
): { subject: string; html: string; text: string } {
  const hi = name ? `Hi ${name},` : 'Hi,';
  const subject = 'The treatment options that fit your needs';
  const html = wrap('Places that may be a good fit', `
    <p>${esc(hi)}</p>
    <p>Here are the facilities matched to what you shared. Each has current availability and can take your call directly:</p>
    ${facilities.map(facilityBlockHtml).join('')}
    <p>You can reach out to any of them whenever you're ready.</p>`);
  const text = `${hi}\n\nHere are the facilities matched to your needs:\n\n${facilities
    .map(facilityBlockText)
    .join('\n')}\n\n${CRISIS}`;
  return { subject, html, text };
}

// 3) Face sheet — sent to a FACILITY when the seeker consents to share details.
export function faceSheetEmail(
  facilityName: string,
  s: SeekerFaceSheet
): { subject: string; html: string; text: string } {
  const subject = 'New referral via Wellness Companion';

  const nameLine = [s.name, s.preferred_name ? `(prefers "${s.preferred_name}")` : '']
    .filter(Boolean)
    .join(' ');
  const address = [s.city, s.state, s.zip].filter(Boolean).join(', ');
  const coverage = s.coverage_status
    ? COVERAGE_LABELS[s.coverage_status as CoverageStatus] ?? s.coverage_status
    : undefined;
  const subscriber = s.subscriber_name
    ? `${s.subscriber_name}${s.subscriber_relationship ? ` (${s.subscriber_relationship})` : ''}`
    : undefined;
  const emergency = s.emergency_contact_name
    ? `${s.emergency_contact_name}${s.emergency_contact_relationship ? ` (${s.emergency_contact_relationship})` : ''}${s.emergency_contact_phone ? ` — ${s.emergency_contact_phone}` : ''}`
    : undefined;

  const sections: [string, [string, string | undefined][]][] = [
    ['Contact', [
      ['Name', nameLine || s.name],
      ['Date of birth', s.dob],
      ['Phone', s.phone],
      ['Contact preference', s.contact_pref],
      ['Email', s.email],
      ['Location', address || (s.region_zip3 ? `${s.region_zip3}xx` : undefined)],
      ['Language', s.language],
    ]],
    ['Insurance', [
      ['Carrier / plan', s.insurance_carrier ?? s.insurance],
      ['Member / policy ID', s.insurance_member_id],
      ['Group #', s.insurance_group],
      ['Coverage status', coverage],
      ['Policy holder', subscriber],
      ['Secondary insurance', s.secondary_insurance],
    ]],
    ['Presenting (coarse — facility to assess clinically)', [
      ['Primary concern', s.concern_category],
      ['Other substances', s.other_substances],
      ['Last use', s.last_use],
      ['Co-occurring mental health', s.co_occurring_mh],
      ['Prior treatment', s.prior_treatment],
      ['Current medications', s.medications],
      ['Allergies', s.allergies],
    ]],
    ['Emergency contact', [['Contact', emergency]]],
    ['Logistics', [
      ['Court-ordered / legal', s.court_ordered],
      ['Hoping to start', s.urgency],
      ['Transportation / access', s.transportation_needs],
      ['Note', s.note],
    ]],
  ];

  const htmlSections = sections
    .map(([title, rows]) => {
      const present = rows.filter(([, v]) => v && String(v).trim());
      if (!present.length) return '';
      return `<h2 style="font-size:13px;color:#0f766e;margin:16px 0 4px">${esc(title)}</h2>
      <table style="font-size:14px;border-collapse:collapse">
        ${present.map(([k, v]) => `<tr><td style="padding:3px 12px 3px 0;color:#64748b;vertical-align:top">${esc(k)}</td><td style="padding:3px 0"><strong>${esc(String(v))}</strong></td></tr>`).join('')}
      </table>`;
    })
    .join('');

  const html = wrap(`New referral for ${facilityName}`, `
    <p>A person matched to your facility through Wellness Companion consented to share these details so your intake team has them in hand when you reach out:</p>
    ${htmlSections}
    <p style="font-size:12px;color:#94a3b8;margin-top:16px">This information is confidential and protected (incl. 42 CFR Part 2). Use it only to coordinate this person's care.</p>`);

  const textSections = sections
    .map(([title, rows]) => {
      const present = rows.filter(([, v]) => v && String(v).trim());
      if (!present.length) return '';
      return `${title}\n${present.map(([k, v]) => `  ${k}: ${v}`).join('\n')}`;
    })
    .filter(Boolean)
    .join('\n\n');
  const text = `New referral for ${facilityName} via Wellness Companion.\n\n${textSections}\n\nThis information is confidential and protected. Use it only to coordinate this person's care.`;

  return { subject, html, text };
}

// 4) Weekly reminder — to seekers who haven't connected yet.
export function weeklyReminderEmail(
  name: string | undefined,
  facilities: FacilitySummary[]
): { subject: string; html: string; text: string } {
  const hi = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Still here whenever you’re ready';
  const html = wrap('A gentle check-in', `
    <p>${esc(hi)}</p>
    <p>No pressure at all — we just wanted to leave the door open. These are the places you looked at, and they still have availability:</p>
    ${facilities.map(facilityBlockHtml).join('')}
    <p>Reaching out is always your call, on your timeline. We're glad you're here.</p>`);
  const text = `${hi}\n\nNo pressure — just leaving the door open. The places you looked at:\n\n${facilities
    .map(facilityBlockText)
    .join('\n')}\n\n${CRISIS}`;
  return { subject, html, text };
}
