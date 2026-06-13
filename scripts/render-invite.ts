// Render the facility claim-invite email to standalone files (for pasting into a
// Gmail template, or opening in a browser). Writes full + short variants.
//   npx tsx scripts/render-invite.ts [outDir]
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { facilityClaimInviteEmail } from '@/lib/email/templates';

const OUT = process.argv[2] || path.join(homedir(), 'Downloads');
const common = {
  facilityName: '{{facility_name}}',
  city: '{{city}}',
  state: '',
  listingUrl: 'https://clearbedrecovery.com/programs/{{facility_id}}',
  firstName: '{{first_name}}',
  fromName: 'Nick Dowling',
  unsubscribeUrl: 'mailto:nick.dowling@clearbedrecovery.com?subject=Unsubscribe',
  mailingAddress: '{{your mailing address}}',
};

for (const short of [false, true]) {
  const m = facilityClaimInviteEmail({ ...common, short });
  const tag = short ? 'short' : 'full';
  writeFileSync(path.join(OUT, `clearbed-invite-${tag}.html`), m.html);
  writeFileSync(path.join(OUT, `clearbed-invite-${tag}.txt`), `Subject: ${m.subject}\n\n${m.text}\n`);
  console.log(`  ✓ ${tag}: ${path.join(OUT, `clearbed-invite-${tag}.html`)} (+ .txt)`);
}
console.log('\n  Subjects:');
console.log('   full :', facilityClaimInviteEmail({ ...common, short: false }).subject);
console.log('   short:', facilityClaimInviteEmail({ ...common, short: true }).subject);
