import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireFacilityMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isVaultEnabled } from '@/lib/supabase/vault';
import { listSeekerContactsForFacility, type FacilityContact } from '@/lib/vault/seekers';

// Face-sheet keys that are already shown in the contact header — don't repeat them
// in the detail grid below.
const HEADER_KEYS = new Set([
  'name',
  'full_name',
  'full_legal_name',
  'preferred_name',
  'email',
  'phone',
  'status',
]);

const FIELD_LABELS: Record<string, string> = {
  concern_category: 'Primary concern',
  care_level_needed: 'Level of care',
  coverage_status: 'Coverage status',
  payer_type: 'Payer',
  insurance_carrier: 'Insurance carrier',
  member_id: 'Member ID',
  other_substances: 'Other substances',
  last_use: 'Last use',
  co_occurring: 'Co-occurring',
  prior_treatment: 'Prior treatment',
  court_ordered: 'Court ordered',
  urgency: 'Urgency',
  transportation: 'Transportation',
  emergency_contact: 'Emergency contact',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  dob: 'Date of birth',
};

function label(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ');
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'connected'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'unsubscribed'
        ? 'bg-slate-100 text-slate-500'
        : 'bg-teal-100 text-teal-800';
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

function ContactCard({ c }: { c: FacilityContact }) {
  const details = Object.entries(c.faceSheet)
    .filter(([k, v]) => !HEADER_KEYS.has(k) && v !== null && v !== undefined && String(v).trim() !== '')
    .slice(0, 14);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-800">{c.name || 'Seeker (name withheld)'}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
            {c.phone && (
              <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="text-teal-700 hover:underline">
                {c.phone}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="text-teal-700 hover:underline">
                {c.email}
              </a>
            )}
            {!c.phone && !c.email && <span className="text-slate-400">No contact method shared</span>}
          </div>
        </div>
        <div className="text-right">
          <StatusBadge status={c.status} />
          <div className="mt-1 text-xs text-slate-400">
            shared {new Date(c.sharedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {details.length > 0 && (
        <div className="mt-3 grid gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2">
          {details.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-slate-50 py-1">
              <span className="capitalize text-slate-500">{label(k)}</span>
              <span className="text-right text-slate-700">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function FacilityContacts({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { facilityIds } = await requireFacilityMember();
  if (!facilityIds.includes(id)) notFound();

  const supabase = await createClient();
  const { data: facility } = await supabase.from('facilities').select('name').eq('id', id).maybeSingle();
  if (!facility) notFound();

  const vaultOn = isVaultEnabled();
  const contacts = vaultOn ? await listSeekerContactsForFacility(id) : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/facility/${id}`} className="text-sm text-teal-700">
          ← Back to profile
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">Seeker contacts</h1>
        <p className="text-sm text-slate-500">
          People who matched with {facility.name} and chose to share their details with you, drawn from their intake
          conversation.
        </p>
      </div>

      {!vaultOn ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <strong>Contacts are not available yet.</strong>
          <p className="mt-1 text-amber-800">
            Seeker contact details are protected health information. They&apos;ll appear here once the platform&apos;s
            HIPAA/BAA agreement is in place. Until then, you&apos;ll see de-identified leads on your{' '}
            <Link href={`/facility/${id}`} className="font-medium underline">
              dashboard
            </Link>
            .
          </p>
        </div>
      ) : contacts.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No shared contacts yet. When a matched seeker consents to share their details with you, they&apos;ll appear
          here with everything they told us.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-400">
            {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} · shared with the seeker&apos;s consent ·
            protected information, handle with care.
          </p>
          <div className="space-y-3">
            {contacts.map((c) => (
              <ContactCard key={c.interestId} c={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
