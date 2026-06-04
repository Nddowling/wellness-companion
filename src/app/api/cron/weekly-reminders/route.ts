import 'server-only';

import { sendEmail } from '@/lib/email/send';
import { weeklyReminderEmail } from '@/lib/email/templates';
import { getReminderCandidates, logEmail, markReminded } from '@/lib/vault/seekers';

// Weekly nudge to seekers who requested info but haven't connected yet — a reminder
// of the facilities they were interested in. Triggered by Vercel Cron (see vercel.json).
// Protected by CRON_SECRET (Vercel sends it as a Bearer token).

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Needs the vault (PHI) — only runs once the BAA gate is set.
  if (process.env.HANDOFF_BAA_SIGNED !== 'true') {
    return Response.json({ skipped: 'vault disabled (HANDOFF_BAA_SIGNED not set)' });
  }

  let sentCount = 0;
  try {
    const candidates = await getReminderCandidates(7);
    for (const c of candidates) {
      const msg = weeklyReminderEmail(c.name ?? undefined, c.facilities);
      const res = await sendEmail({ to: c.email, ...msg });
      await logEmail({ seeker_id: c.seekerId, kind: 'weekly_reminder', to_email: c.email, provider_id: res.id });
      await markReminded(c.seekerId);
      sentCount++;
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'reminder run failed', sent: sentCount },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, sent: sentCount });
}
