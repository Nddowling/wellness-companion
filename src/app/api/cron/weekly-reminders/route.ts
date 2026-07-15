import 'server-only';

// Retired: the matcher now asks only for permission to send one copy of the
// current matches. That narrow permission does not authorize recurring outreach.
export async function GET() {
  return Response.json({ error: 'Recurring seeker reminders are retired' }, { status: 410 });
}
