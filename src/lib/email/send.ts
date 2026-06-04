import 'server-only';

// Provider-agnostic transactional email. Uses Resend's HTTP API when
// RESEND_API_KEY is set; otherwise logs to the server console so flows are
// testable in dev without sending. No SDK dependency — just fetch.
//
// Production note: emails to seekers reference treatment-seeking and are
// 42 CFR Part 2-sensitive. Send only with consent, over a BAA-covered provider,
// from a verified domain (set EMAIL_FROM).

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(msg: EmailMessage): Promise<{ id: string | null; ok: boolean }> {
  const from = process.env.EMAIL_FROM || 'Wellness Companion <onboarding@resend.dev>';
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    // Dev fallback — never silently "succeed" in a way that hides misconfig.
    console.log(`[email:dev] (no RESEND_API_KEY) would send → ${msg.to} :: ${msg.subject}`);
    return { id: null, ok: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) {
      console.error('[email] send failed', res.status, await res.text().catch(() => ''));
      return { id: null, ok: false };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { id: data.id ?? null, ok: true };
  } catch (err) {
    console.error('[email] send error', err instanceof Error ? err.message : err);
    return { id: null, ok: false };
  }
}
