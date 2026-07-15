import 'server-only';

import { randomUUID } from 'node:crypto';
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

/**
 * Send treatment-seeking or other Part 2-sensitive content only through an SMTP
 * transport the operator has explicitly attested is covered by the required BAA.
 * This path deliberately never falls back to the generic Resend integration.
 */
export function sensitiveEmailConfigured(): boolean {
  return (
    process.env.SENSITIVE_EMAIL_BAA_APPROVED === 'true' &&
    Boolean(SMTP_USER) &&
    Boolean(SMTP_PASS)
  );
}

export async function sendSensitiveEmail(
  msg: EmailMessage,
): Promise<{ id: string | null; ok: boolean }> {
  const deliveryId = randomUUID();
  if (!sensitiveEmailConfigured() || !SMTP_USER || !SMTP_PASS) {
    console.warn('[email] sensitive delivery is not configured', { deliveryId });
    return { id: null, ok: false };
  }

  try {
    const info = await smtpTransport().sendMail({
      from: fromAddress(SMTP_USER),
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    return { id: info.messageId ?? null, ok: true };
  } catch {
    console.error('[email] sensitive smtp delivery failed', { deliveryId });
    return { id: null, ok: false };
  }
}

export async function sendEmail(msg: EmailMessage): Promise<{ id: string | null; ok: boolean }> {
  // Correlate a delivery attempt without ever putting the recipient, subject, body,
  // or a provider response (which may echo them) into runtime logs.
  const deliveryId = randomUUID();
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
    } catch {
      console.error('[email] smtp delivery failed', { deliveryId });
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
        // Do not consume/log the response body: providers may echo recipient data.
        console.error('[email] resend delivery failed', { deliveryId, status: res.status });
        return { id: null, ok: false };
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return { id: data.id ?? null, ok: true };
    } catch {
      console.error('[email] resend delivery failed', { deliveryId });
      return { id: null, ok: false };
    }
  }

  // 3) Dev fallback
  console.warn('[email] delivery is not configured', { deliveryId });
  return { id: null, ok: false };
}
