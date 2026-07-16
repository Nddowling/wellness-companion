import {
  LEVEL_LABELS,
  PAYER_LABELS,
  type LevelOfCare,
  type PayerType,
} from '@/lib/constants';

// Email templates. Pure functions → { subject, html, text }. Kept simple and
// inline-styled so they render in any client without external CSS.

export type FacilitySummary = {
  name: string;
  city: string | null;
  state: string | null;
  levels: string[]; // raw level keys
  payers: string[]; // raw payer keys
  beds: number | null;
  freshnessLabel: string;
  contact: { name?: string; email?: string; phone?: string } | null;
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
          <div style="color:#9fdcc9;font-size:12px;margin-top:3px">Clearer addiction-treatment directory options</div>
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
  const availability =
    f.beds === null ? f.freshnessLabel : `${f.beds} ${f.beds === 1 ? 'bed' : 'beds'} · ${f.freshnessLabel}`;
  return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:8px 0">
    <div style="font-weight:600">${esc(f.name)}</div>
    <div style="font-size:13px;color:#64748b">${esc(loc)} · ${esc(levels)}</div>
    <div style="font-size:13px;color:#64748b">${esc(availability)}${payers ? ` · Listed payment: ${esc(payers)}` : ''}</div>
    <div style="font-size:13px;margin-top:6px">Reach intake: <strong>${esc(contact)}</strong></div>
  </div>`;
}

function facilityBlockText(f: FacilitySummary): string {
  const loc = [f.city, f.state].filter(Boolean).join(', ');
  const levels = f.levels.map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l).join(', ');
  const contact = f.contact ? [f.contact.phone, f.contact.email].filter(Boolean).join(' · ') : 'Contact on file';
  const availability =
    f.beds === null ? f.freshnessLabel : `${f.beds} ${f.beds === 1 ? 'bed' : 'beds'} · ${f.freshnessLabel}`;
  return `• ${f.name} — ${loc} (${levels}); ${availability}; reach intake: ${contact}`;
}

// 0) Facility claim invite — cold outreach to a listed-but-unclaimed program.
// Founder-voice: we already listed them free; an approved ownership claim unlocks
// the complete editable profile. Do not promise recurring reports without a pipeline.
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
    <p>If you submit an <strong>ownership claim</strong>, an administrator will review it before granting dashboard access. Once approved, you can correct directory details, add profile content, and keep your availability reports current.</p>
    <p>The complete claimed public profile stays <strong>free.</strong> No card or contract is required to manage it.</p>
    <p style="margin-top:16px">In your corner,<br/><strong>${esc(p.fromName)}</strong><br/>Founder, Clear Bed Recovery</p>
    ${canSpam}`;

  const innerShort = `
    <p>${esc(hi)}</p>
    <p>I'm in recovery and a developer — I built <strong>Clear Bed Recovery</strong>, a free directory that connects people to treatment near them, to give back. We're a connector, not a provider, and people seeking help never pay.</p>
    <p><strong>I've already listed ${esc(p.facilityName)}${esc(where)}, free.</strong> Submit an ownership claim so an administrator can review dashboard access. Once approved, you can correct the listing, add profile content, and update availability. The complete claimed public profile stays free.</p>
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
      ? `${hi}\n\nI'm in recovery and a developer — I built Clear Bed Recovery, a free directory that connects people to treatment near them. We're a connector, not a provider, and people seeking help never pay.\n\nI've already listed ${p.facilityName}${where}, free. Submit an ownership claim so an administrator can review dashboard access. Once approved, you can correct the listing, add profile content, and update availability. The complete claimed public profile stays free.\n\nView & claim: ${p.listingUrl}\n\nIn your corner,\n${p.fromName} · Founder, Clear Bed Recovery`
      : `${hi}\n\nI'll be straight with you: I'm a person in long-term recovery, and a software developer. Clear Bed Recovery is what I built to give back — a free directory that connects people looking for treatment to real programs near them, narrowed by listed care level, payment type, and location. We're a connector, not a provider, and the person seeking help never pays.\n\nI've already listed ${p.facilityName}${where} — completely free. Your page is live right now:\n${p.listingUrl}\n\nSubmit an ownership claim so an administrator can review dashboard access. Once approved, you can correct the listing, add profile content, and update availability. The complete claimed public profile stays free; no card or contract is required to manage it.\n\nIn your corner,\n${p.fromName}\nFounder, Clear Bed Recovery`
  ) + `\n\n—\nYou're receiving this once because ${p.facilityName} appears in our public directory. Unsubscribe: ${p.unsubscribeUrl} · ${p.mailingAddress}`;

  return { subject, html, text };
}

// Treatment info — one consented email containing matched facilities + contact.
export function treatmentInfoEmail(
  name: string | undefined,
  facilities: FacilitySummary[]
): { subject: string; html: string; text: string } {
  const hi = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Your Clear Bed directory options';
  const html = wrap('Directory options narrowed from your answers', `
    <p>${esc(hi)}</p>
    <p>Here are directory options narrowed from what you shared. Availability and coverage are not guaranteed; use the listed contact to verify both directly:</p>
    ${facilities.map(facilityBlockHtml).join('')}
    <p>You can reach out to any of them whenever you're ready.</p>`);
  const text = `${hi}\n\nHere are directory options narrowed from your answers. Verify availability and coverage directly, and ask a qualified provider to assess level of care and admission:\n\n${facilities
    .map(facilityBlockText)
    .join('\n')}\n\n${CRISIS}`;
  return { subject, html, text };
}

// 5) Staff invite — to a colleague added to a facility team. Business email, NOT
// PHI: no crisis footer and no relayed credentials. A new account receives a
// single-use set-password capability; an existing account receives the login URL.
export function staffInviteEmail(params: {
  facilityName: string;
  actionUrl: string;
  email: string;
  role: 'owner' | 'staff';
  newAccount: boolean;
}): { subject: string; html: string; text: string } {
  const subject = `You've been added to ${params.facilityName} on Clear Bed Recovery`;
  const roleLine =
    params.role === 'owner'
      ? 'As an <strong>owner</strong>, you can update residential-bed reports and profile information, view consented seeker contacts, and invite others.'
      : 'As <strong>staff</strong>, you can update residential-bed reports and profile information and view consented seeker contacts.';
  const footer =
    'You received this because someone added you to a facility team on Clear Bed Recovery, the addiction-treatment referral directory.';

  const html = wrap(
    `Welcome to the ${params.facilityName} team`,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">You've been added to <strong>${esc(
     params.facilityName
    )}</strong> on Clear Bed Recovery.</p>
     <p style="margin:0 0 4px;font-size:14px;color:${BRAND.slate};line-height:1.6">${roleLine}</p>
     <p style="font-size:13px;color:${BRAND.slate};line-height:1.6">Account email: <strong>${esc(params.email)}</strong></p>
     <div style="margin:16px 0">${button(params.actionUrl, params.newAccount ? 'Set your password & sign in' : 'Sign in to get started')}</div>
     ${
       params.newAccount
         ? `<p style="font-size:12px;color:${BRAND.slate};line-height:1.6">This setup link is single-use and expires. If it no longer works, choose “Forgot password” on the sign-in page.</p>`
         : ''
     }
     <p style="font-size:13px;color:${BRAND.slate};line-height:1.6;margin:0">Recent bed reports can improve ordering within the same region; they never determine clinical fit or guarantee admission.</p>`,
    footer
  );

  const text = `You've been added to ${params.facilityName} on Clear Bed Recovery (${params.role}).\n\n${
    params.newAccount ? 'Set your password and sign in' : 'Sign in'
  }: ${params.actionUrl}\nEmail: ${params.email}${
    params.newAccount
      ? '\nThis setup link is single-use and expires. If it no longer works, choose "Forgot password" on the sign-in page.'
      : ''
  }\n\nRecent bed reports can improve ordering within the same region; they never determine clinical fit or guarantee admission.\n\n${footer}`;

  return { subject, html, text };
}

// Provider claim approved — sent when an admin reviews a facility ownership claim
// and creates the provider login. Carries only a single-use set-password link.
export function providerClaimApprovedEmail(params: {
  facilityName: string;
  setPasswordUrl: string; // single-use link to /reset where they choose a password
  email: string;
}): { subject: string; html: string; text: string } {
  const subject = `Your claim was approved — set your password for ${params.facilityName}`;
  const footer =
    'You received this because you requested to claim a facility on Clear Bed Recovery, the addiction-treatment referral directory.';

  const html = wrap(
    `Your ownership claim was approved`,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">Good news — an administrator approved your ownership claim for <strong>${esc(
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
       'Your full public profile is free; paid plans add in-app analytics and lead-status workflow.',
     ])}
     <p style="font-size:13px;color:${BRAND.slate};line-height:1.6;margin:12px 0 0">Recent bed reports can improve ordering within the same region. Flat monthly pricing — never per-lead or per-admission.</p>`,
    footer
  );

  const text = `Your ownership claim was approved.\n\nAn administrator approved access for ${params.facilityName}. This is not a clinical endorsement or licensing determination.\n\nSet your password to finish: ${params.setPasswordUrl}\n\nYou'll sign in with ${params.email} and the password you choose. The link is single-use and expires; if it stops working, use "Forgot password" on the sign-in page.\n\nThen complete your profile and keep bed reports current.\n\n${footer}`;

  return { subject, html, text };
}

// Admin welcome — for provisioning the single global administrator. Not wired to an
// automated trigger (admins are added directly to platform_admins); send manually
// from a script/console when setting up or moving the admin account.
export function adminWelcomeEmail(params: {
  email: string;
  loginUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your Clear Bed Recovery admin access';
  const footer =
    'You received this because you were granted administrator access to Clear Bed Recovery.';
  const html = wrap(
    'Welcome — you have admin access',
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">You've been set up as the <strong>global administrator</strong> for Clear Bed Recovery. You have full oversight: review and approve facility claims, manage every program, and view seeker records.</p>
     <p style="font-size:13px;color:${BRAND.slate};line-height:1.6">Account email: <strong>${esc(params.email)}</strong></p>
     <div style="margin:16px 0">${button(params.loginUrl, 'Sign in to the admin dashboard')}</div>
     <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${BRAND.ink}">Getting started:</p>
     ${steps([
       'Open the secure sign-in link above.',
       'Use password recovery if you have not set a password yet.',
       'You’ll land on the admin dashboard — claims, facilities, and seekers are all there.',
       'You can open the directory matcher from your menu (“Matcher (test)”) any time to try it.',
     ])}`,
    footer
  );
  const text = `Welcome to Clear Bed Recovery — you have global admin access.\n\nSign in: ${
    params.loginUrl
  }\nEmail: ${params.email}\nUse password recovery if you have not set a password yet.\n\nYou'll land on the admin dashboard — claims, facilities, and seekers.\n\n${footer}`;
  return { subject, html, text };
}
