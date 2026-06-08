import 'server-only';

import { sendEmail } from '@/lib/email/send';
import {
  seekerAccountEmail,
  providerClaimApprovedEmail,
  staffInviteEmail,
  adminWelcomeEmail,
  type FacilitySummary,
} from '@/lib/email/templates';

// TEMPORARY dev-only route to send branded test emails. Delete after use.
const TO = 'Ndowling970@gmail.com';
const LOGIN = 'https://clearbedrecovery.com/login';

const sampleFacilities: FacilitySummary[] = [
  {
    name: 'Sunrise Recovery Center',
    city: 'Atlanta',
    state: 'GA',
    levels: ['residential', 'php'],
    payers: ['medicaid'],
    beds: 6,
    freshnessLabel: 'Beds confirmed recently',
    contact: { phone: '(404) 555-0190', email: 'intake@sunrise.org' },
  },
];

export async function GET(request: Request) {
  // Temporary + guarded: only callable with the secret token, removed right after use.
  if (new URL(request.url).searchParams.get('key') !== 'cbr-mailtest-9f2a3b71') {
    return new Response('Not found', { status: 404 });
  }
  const jobs = [
    {
      label: 'seeker',
      msg: seekerAccountEmail({
        email: TO,
        password: 'WC-9f2a-3b71',
        loginUrl: LOGIN,
        faceSheet: { name: 'Jordan Smith', concern_category: 'alcohol', insurance_carrier: 'Aetna', coverage_status: 'active' },
        facilities: sampleFacilities,
      }),
    },
    {
      label: 'provider',
      msg: providerClaimApprovedEmail({ facilityName: 'Sunrise Recovery Center', loginUrl: LOGIN, email: TO, password: 'WC-4c81-9aa2' }),
    },
    {
      label: 'staff',
      msg: staffInviteEmail({ facilityName: 'Sunrise Recovery Center', loginUrl: LOGIN, email: TO, role: 'staff', password: 'CB-7d10-2f55' }),
    },
    {
      label: 'admin',
      msg: adminWelcomeEmail({ email: TO, loginUrl: LOGIN, password: 'WC-1a2b-3c4d' }),
    },
  ];

  const results = [];
  for (const j of jobs) {
    const r = await sendEmail({ to: TO, subject: `[TEST] ${j.msg.subject}`, html: j.msg.html, text: j.msg.text });
    results.push({ label: j.label, subject: j.msg.subject, ...r });
  }
  return Response.json({ to: TO, results });
}
