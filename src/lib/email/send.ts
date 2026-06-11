import 'server-only';

import nodemailer from 'nodemailer';

// Provider-agnostic transactional email. Send priority:
//   1. Gmail / Google Workspace SMTP  (SMTP_USER + SMTP_PASS app password)
//   2. Resend HTTP API                 (RESEND_API_KEY)
//   3. Dev console fallback            (logs, never silently "succeeds" in a way
//      that hides misconfig)
// Always returns the same { id, ok } shape.
//
// PHI note: seeker emails reference treatment-seeking and are 42 CFR Part 2-sensitive.
// Send only with consent, over a BAA-covered sender (Google Workspace signs one),
// from a DKIM-signed domain.

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Gmail/Workspace requires the From to be the authenticated mailbox (or a configured
// send-as alias) — so default to SMTP_USER unless EMAIL_FROM is explicitly set.
function fromAddress(fallbackUser?: string): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (fallbackUser) return `Clear Bed Recovery <${fallbackUser}>`;
  return 'Clear Bed Recovery <onboarding@resend.dev>';
}

// One transporter per warm lambda — avoids re-handshaking SMTP on every send.
let transporter: nodemailer.Transporter | null = null;
function smtpTransport(): nodemailer.Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail(msg: EmailMessage): Promise<{ id: string | null; ok: boolean }> {
  // 1) Gmail / Google Workspace SMTP
  if (SMTP_USER && SMTP_PASS) {
    try {
      const info = await smtpTransport().sendMail({
        from: fromAddress(SMTP_USER),
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      return { id: info.messageId ?? null, ok: true };
    } catch (err) {
      console.error('[email] smtp send error', err instanceof Error ? err.message : err);
      return { id: null, ok: false };
    }
  }

  // 2) Resend HTTP API
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromAddress(), to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
      });
      if (!res.ok) {
        console.error('[email] resend send failed', res.status, await res.text().catch(() => ''));
        return { id: null, ok: false };
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return { id: data.id ?? null, ok: true };
    } catch (err) {
      console.error('[email] resend send error', err instanceof Error ? err.message : err);
      return { id: null, ok: false };
    }
  }

  // 3) Dev fallback
  console.log(`[email:dev] (no SMTP_* or RESEND_API_KEY) would send → ${msg.to} :: ${msg.subject}`);
  return { id: null, ok: true };
}
