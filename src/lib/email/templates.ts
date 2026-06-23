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

// Brand palette (mirrors globals.css). Inlined as hex so emails render anywhere.
const BRAND = {
  teal: '#2f6f6a',
  sage: '#5dcaa5',
  mist: '#e1f0ec',
  mistLine: '#cfe6df',
  terracotta: '#d4956a',
  terracottaDark: '#bd7f55',
  ink: '#243b3a',
  slate: '#475569',
  muted: '#94a3b8',
  line: '#e2e8f0',
  panel: '#f8fafc',
} as const;

// Hosted logo mark (served from /public). Email clients don't render SVG, so this is
// a PNG; the wordmark beside it is live text for crispness.
const LOGO_URL = 'https://clearbedrecovery.com/images/email-logo-mark.png';

/** A primary call-to-action button (teal for contrast with white text). */
function button(href: string, label: string, color: string = BRAND.teal): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${color};color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;line-height:1">${esc(
    label
  )}</a>`;
}

/** The temporary-credentials card used in every onboarding email. */
function credsCard(email: string, password?: string): string {
  const pw = password
    ? `<div style="font-size:14px;color:${BRAND.ink};margin-top:2px">Temporary password: <strong style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#ffffff;border:1px solid ${BRAND.mistLine};border-radius:6px;padding:2px 6px">${esc(
        password
      )}</strong></div>
      <div style="font-size:12px;color:${BRAND.slate};margin-top:8px">For your security you'll choose your own password right after you sign in.</div>`
    : `<div style="font-size:13px;color:${BRAND.slate};margin-top:4px">Sign in with your existing Clear Bed Recovery password.</div>`;
  return `<div style="background:${BRAND.mist};border:1px solid ${BRAND.mistLine};border-radius:10px;padding:16px;margin:16px 0">
    <div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${BRAND.teal};margin-bottom:8px">Your login</div>
    <div style="font-size:14px;color:${BRAND.ink}">Email: <strong>${esc(email)}</strong></div>
    ${pw}
  </div>`;
}

/** A compact numbered "how to get started" list. */
function steps(items: string[]): string {
  const lis = items
    .map(
      (s) =>
        `<li style="margin:0 0 6px;padding:0;font-size:14px;color:${BRAND.slate};line-height:1.5">${s}</li>`
    )
    .join('');
  return `<ol style="margin:8px 0 16px;padding-left:20px">${lis}</ol>`;
}

// Branded shell. Header band + card + footer. Seeker-facing emails carry the 988
// crisis footer; business emails pass their own (the crisis line is out of place there).
// Signature is unchanged so existing callers brand automatically.
function wrap(title: string, inner: string, footer: string = CRISIS): string {
  return `<div style="margin:0;padding:24px 12px;background:#f1f6f4">
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BRAND.line}">
    <div style="background:${BRAND.teal};padding:20px 24px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:10px;vertical-align:middle"><img src="${LOGO_URL}" width="30" height="30" alt="Clear Bed Recovery" style="display:block;border:0"/></td>
        <td style="vertical-align:middle">
          <div style="font-size:18px;font-weight:800;letter-spacing:-.01em;line-height:1.1"><span style="color:#7ad9bb">Clear</span><span style="color:#ffffff">Bed Recovery</span></div>
          <div style="color:#9fdcc9;font-size:12px;margin-top:3px">Connecting you to treatment that fits</div>
        </td>
      </tr></table>
    </div>
    <div style="padding:24px;color:${BRAND.ink}">
      <h1 style="font-size:20px;color:${BRAND.ink};margin:0 0 12px;line-height:1.3">${esc(title)}</h1>
      ${inner}
    </div>
    <div style="padding:16px 24px;background:${BRAND.panel};border-top:1px solid ${BRAND.line}">
      <p style="font-size:12px;color:${BRAND.muted};margin:0;line-height:1.5">${esc(footer)}</p>
      <p style="font-size:11px;color:${BRAND.muted};margin:8px 0 0">Clear Bed Recovery is a connector — we help you reach treatment; we don't provide treatment ourselves.</p>
    </div>
  </div>
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

// 0) Facility claim invite — cold outreach to a listed-but-unclaimed program.
// Founder-voice: we already listed them free; claiming unlocks free performance
// updates; it stays free (optional paid profile upgrades are revealed on-site).
// CAN-SPAM: pass a real mailing address + working unsubscribe URL.
export function facilityClaimInviteEmail(p: {
  facilityName: string;
  city?: string | null;
  state?: string | null;
  listingUrl: string;
  firstName?: string | null;
  fromName: string;
  unsubscribeUrl: string;
  mailingAddress: string;
  short?: boolean;
}): { subject: string; html: string; text: string } {
  const loc = [p.city, p.state].filter(Boolean).join(', ');
  const where = loc ? ` in ${loc}` : '';
  const hi = p.firstName ? `Hi ${p.firstName},` : `Hi,`;
  const subject = p.short
    ? `I built ${p.facilityName} a free page — come claim it`
    : `${p.facilityName} is already listed on Clear Bed Recovery — it's yours, free`;

  const canSpam = `<div style="margin-top:22px;border-top:1px solid ${BRAND.line};padding-top:12px;font-size:11px;color:${BRAND.muted};line-height:1.5">
    You're receiving this once because ${esc(p.facilityName)} appears in our public treatment directory.
    <a href="${esc(p.unsubscribeUrl)}" style="color:${BRAND.muted};text-decoration:underline">Unsubscribe / don't contact me</a> · ${esc(p.mailingAddress)}
  </div>`;

  const cta = `<div style="margin:20px 0">${button(p.listingUrl, 'View & claim your free listing →')}</div>`;

  const innerFull = `
    <p>${esc(hi)}</p>
    <p>I'll be straight with you, because you deserve that: I'm a person in long-term recovery, and I'm also a software developer. <strong>Clear Bed Recovery is what I built to give back</strong> to the people still sick and suffering — so the next person searching at 2&nbsp;a.m. finds hope, and finds <em>you</em>.</p>
    <p>We're a free directory that connects people looking for treatment to real programs near them — matched by level of care, insurance, and location. We're a <strong>connector, not a provider</strong>, and the person seeking help <strong>never pays a cent</strong>.</p>
    <p>Here's why I'm writing: <strong>I've already listed ${esc(p.facilityName)}${esc(where)} — completely free.</strong> Your page is live right now.</p>
    ${cta}
    <p>If you take two minutes to <strong>claim and verify your listing</strong>, I'll start sending you <strong>free monthly updates on how it's performing</strong> — how many people viewed your program, searched your area, and clicked through. Those updates only start once you've claimed it, so it's worth doing today.</p>
    <p>After that, it stays <strong>100% free.</strong> No card, no contract, no catch — just me trying to do one good thing with the skill I have.</p>
    <p style="margin-top:16px">In your corner,<br/><strong>${esc(p.fromName)}</strong><br/>Founder, Clear Bed Recovery</p>
    ${canSpam}`;

  const innerShort = `
    <p>${esc(hi)}</p>
    <p>I'm in recovery and a developer — I built <strong>Clear Bed Recovery</strong>, a free directory that connects people to treatment near them, to give back. We're a connector, not a provider, and people seeking help never pay.</p>
    <p><strong>I've already listed ${esc(p.facilityName)}${esc(where)}, free.</strong> Claim it (2 min) and I'll send you <strong>free monthly updates</strong> on how your listing performs. It stays 100% free — no catch.</p>
    ${cta}
    <p style="margin-top:8px">In your corner,<br/><strong>${esc(p.fromName)}</strong> · Founder, Clear Bed Recovery</p>
    ${canSpam}`;

  const businessFooter = `${p.fromName}, Founder · Clear Bed Recovery — a connector, not a treatment provider.`;
  const html = wrap(
    p.short ? `${p.facilityName} — your free listing is live` : `${p.facilityName} is already on Clear Bed Recovery`,
    p.short ? innerShort : innerFull,
    businessFooter
  );

  const text = (
    p.short
      ? `${hi}\n\nI'm in recovery and a developer — I built Clear Bed Recovery, a free directory that connects people to treatment near them. We're a connector, not a provider, and people seeking help never pay.\n\nI've already listed ${p.facilityName}${where}, free. Claim it (2 min) and I'll send you free monthly updates on how your listing performs. It stays 100% free — no catch.\n\nView & claim: ${p.listingUrl}\n\nIn your corner,\n${p.fromName} · Founder, Clear Bed Recovery`
      : `${hi}\n\nI'll be straight with you: I'm a person in long-term recovery, and a software developer. Clear Bed Recovery is what I built to give back — a free directory that connects people looking for treatment to real programs near them, matched by level of care, insurance, and location. We're a connector, not a provider, and the person seeking help never pays a cent.\n\nI've already listed ${p.facilityName}${where} — completely free. Your page is live right now:\n${p.listingUrl}\n\nClaim and verify your listing (2 minutes) and I'll send you free monthly updates on how it's performing — views, searches in your area, and click-throughs. Those only start once you've claimed it. After that it stays 100% free. No card, no contract, no catch.\n\nIn your corner,\n${p.fromName}\nFounder, Clear Bed Recovery`
  ) + `\n\n—\nYou're receiving this once because ${p.facilityName} appears in our public directory. Unsubscribe: ${p.unsubscribeUrl} · ${p.mailingAddress}`;

  return { subject, html, text };
}

// 1) Welcome — sent when a seeker shares contact info + consents to email.
export function welcomeEmail(name?: string): { subject: string; html: string; text: string } {
  const hi = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Welcome to Clear Bed Recovery';
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

// 2b) Account — sent to a seeker when an account is created on completion. Includes
// their login, a summary of what they shared, and the programs matched to them.
export function seekerAccountEmail(params: {
  email: string;
  password: string;
  loginUrl: string;
  faceSheet: SeekerFaceSheet;
  facilities: FacilitySummary[];
}): { subject: string; html: string; text: string } {
  const s = params.faceSheet;
  const hi = s.name ? `Hi ${s.name.split(' ')[0]},` : 'Hi,';
  const subject = 'Your Clear Bed Recovery account & matched programs';

  const info = (
    [
      ['Looking for', s.concern_category ? `help with ${s.concern_category.replace(/_/g, ' ')}` : undefined],
      ['Insurance', s.insurance_carrier ?? s.insurance],
      ['Coverage', s.coverage_status ? COVERAGE_LABELS[s.coverage_status as CoverageStatus] ?? s.coverage_status : undefined],
    ] as [string, string | undefined][]
  ).filter(([, v]) => v && v.trim()) as [string, string][];

  const html = wrap('Welcome — your account is ready', `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(hi)}</p>
    <p style="margin:0 0 4px;font-size:15px;line-height:1.6">Thank you for taking this step — that took courage. We saved everything you shared, so your matched programs and your conversation are waiting whenever you come back. No need to start over.</p>
    ${credsCard(params.email, params.password)}
    <div style="margin:16px 0">${button(params.loginUrl, 'Sign in & set your password')}</div>
    <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${BRAND.ink}">What happens next:</p>
    ${steps([
      'Sign in with the email and temporary password above.',
      'Choose your own password when prompted — it only takes a moment.',
      'You’re in: your matched programs and saved conversations are all there.',
    ])}
    <p style="margin:0 0 12px;font-size:14px;color:${BRAND.slate};line-height:1.6">You don’t have to sign in to keep going — you can reach any of the programs below directly, any time.</p>
    ${info.length ? `<div style="font-size:14px;color:${BRAND.slate};margin:0 0 8px"><strong>What you shared:</strong> ${info.map(([k, v]) => `${esc(k)} — ${esc(v)}`).join(' · ')}</div>` : ''}
    <h2 style="font-size:15px;color:${BRAND.teal};margin:16px 0 4px">Programs matched to you</h2>
    ${params.facilities.map(facilityBlockHtml).join('')}
    <p style="font-size:13px;color:${BRAND.slate};margin-top:12px">Reach out whenever you’re ready — there’s no pressure and no wrong pace.</p>`);

  const text = `${hi}\n\nThank you for taking this step. Your Clear Bed Recovery account is ready — your matches and conversation are saved.\n\nGet started:\n1) Sign in: ${params.loginUrl}\n2) Email: ${params.email}\n3) Temporary password: ${params.password}\n4) Choose your own password when prompted.\n\nYou can also reach any program directly, any time.\n\nPrograms matched to you:\n${params.facilities.map(facilityBlockText).join('\n')}\n\n${CRISIS}`;
  return { subject, html, text };
}

// 3) Face sheet — sent to a FACILITY when the seeker consents to share details.
export function faceSheetEmail(
  facilityName: string,
  s: SeekerFaceSheet
): { subject: string; html: string; text: string } {
  const subject = 'New referral via Clear Bed Recovery';

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
    <p>A person matched to your facility through Clear Bed Recovery consented to share these details so your intake team has them in hand when you reach out:</p>
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
  const text = `New referral for ${facilityName} via Clear Bed Recovery.\n\n${textSections}\n\nThis information is confidential and protected. Use it only to coordinate this person's care.`;

  return { subject, html, text };
}

// 5) Staff invite — to a colleague added to a facility team. Business email, NOT
// PHI: no crisis footer, just a sign-in link and (for brand-new accounts) a temp
// password. Used by both facility self-serve invites and admin "add member".
export function staffInviteEmail(params: {
  facilityName: string;
  loginUrl: string;
  email: string;
  role: 'owner' | 'staff';
  password?: string; // present only when a new login was just created
}): { subject: string; html: string; text: string } {
  const subject = `You've been added to ${params.facilityName} on Clear Bed Recovery`;
  const roleLine =
    params.role === 'owner'
      ? 'As an <strong>owner</strong>, you can update beds and profile, manage leads, and invite others.'
      : 'As <strong>staff</strong>, you can update beds and profile and manage incoming referrals.';
  const footer =
    'You received this because someone added you to a facility team on Clear Bed Recovery, the addiction-treatment referral directory.';

  const html = wrap(
    `Welcome to the ${params.facilityName} team`,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">You've been added to <strong>${esc(
      params.facilityName
    )}</strong> on Clear Bed Recovery.</p>
     <p style="margin:0 0 4px;font-size:14px;color:${BRAND.slate};line-height:1.6">${roleLine}</p>
     ${credsCard(params.email, params.password)}
     <div style="margin:16px 0">${button(params.loginUrl, params.password ? 'Sign in & set your password' : 'Sign in to get started')}</div>
     <p style="font-size:13px;color:${BRAND.slate};line-height:1.6;margin:0">Keeping your bed availability current is what gets your program matched to the right referrals first.</p>`,
    footer
  );

  const text = `You've been added to ${params.facilityName} on Clear Bed Recovery (${params.role}).\n\nSign in: ${
    params.loginUrl
  }\nEmail: ${params.email}${
    params.password ? `\nTemporary password: ${params.password} (change it after signing in)` : ''
  }\n\nKeeping your bed availability current is what gets your program matched to the right referrals first.\n\n${footer}`;

  return { subject, html, text };
}

// Provider claim approved — sent when an admin verifies a facility claim and creates
// the provider's login. Carries the temp password for first sign-in (they're then
// forced to set their own password).
export function providerClaimApprovedEmail(params: {
  facilityName: string;
  setPasswordUrl: string; // single-use link to /reset where they choose a password
  email: string;
}): { subject: string; html: string; text: string } {
  const subject = `You're verified — set your password for ${params.facilityName}`;
  const footer =
    'You received this because you requested to claim a facility on Clear Bed Recovery, the addiction-treatment referral directory.';

  const html = wrap(
    `You're verified — welcome aboard`,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">Good news — we've verified your claim for <strong>${esc(
      params.facilityName
    )}</strong>. Set your password to finish setting up your account and start managing your program.</p>
     <div style="margin:16px 0">${button(params.setPasswordUrl, 'Set your password & sign in')}</div>
     <p style="margin:0 0 12px;font-size:13px;color:${BRAND.slate};line-height:1.6">You'll sign in with <strong>${esc(
       params.email
     )}</strong> and the password you choose. This link is single-use and expires — if it stops working, use “Forgot password” on the sign-in page.</p>
     <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${BRAND.ink}">Getting set up:</p>
     ${steps([
       'Click the button above and choose your password.',
       'Complete your profile and keep your bed availability current.',
       'Upgrade any time to unlock photos, video, analytics, and featured placement.',
     ])}
     <p style="font-size:13px;color:${BRAND.slate};line-height:1.6;margin:12px 0 0">Keeping your bed availability current is what gets your program matched to the right referrals first. Flat monthly pricing — never per-lead or per-admission.</p>`,
    footer
  );

  const text = `You're verified — welcome to Clear Bed Recovery.\n\nYour claim for ${params.facilityName} is approved.\n\nSet your password to finish: ${params.setPasswordUrl}\n\nYou'll sign in with ${params.email} and the password you choose. The link is single-use and expires; if it stops working, use "Forgot password" on the sign-in page.\n\nThen complete your profile and keep your bed availability current — that's what gets you matched to the right referrals first.\n\n${footer}`;

  return { subject, html, text };
}

// Admin welcome — for provisioning the single global administrator. Not wired to an
// automated trigger (admins are added directly to platform_admins); send manually
// from a script/console when setting up or moving the admin account.
export function adminWelcomeEmail(params: {
  email: string;
  loginUrl: string;
  password?: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your Clear Bed Recovery admin access';
  const footer =
    'You received this because you were granted administrator access to Clear Bed Recovery.';
  const html = wrap(
    'Welcome — you have admin access',
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">You've been set up as the <strong>global administrator</strong> for Clear Bed Recovery. You have full oversight: review and approve facility claims, manage every program, and view seeker records.</p>
     ${credsCard(params.email, params.password)}
     <div style="margin:16px 0">${button(params.loginUrl, params.password ? 'Sign in & set your password' : 'Sign in to the admin dashboard')}</div>
     <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${BRAND.ink}">Getting started:</p>
     ${steps([
       'Sign in with the email and temporary password above.',
       'Choose your own password when prompted.',
       'You’ll land on the admin dashboard — claims, facilities, and seekers are all there.',
       'You can open the seeker AI from your menu (“AI chat (test)”) any time to try it.',
     ])}`,
    footer
  );
  const text = `Welcome to Clear Bed Recovery — you have global admin access.\n\nGet started:\n1) Sign in: ${
    params.loginUrl
  }\n2) Email: ${params.email}${
    params.password ? `\n3) Temporary password: ${params.password}\n4) Choose your own password when prompted.` : ''
  }\n\nYou'll land on the admin dashboard — claims, facilities, and seekers.\n\n${footer}`;
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
