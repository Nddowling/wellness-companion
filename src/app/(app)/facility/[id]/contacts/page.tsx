import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireFacilityMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isVaultEnabled } from '@/lib/supabase/vault';
import { listFacilityContacts, type MatchedContact } from '@/lib/facility/contacts';
import { normalizePlan, planAllows, PLAN_LABEL, requiredPlan } from '@/lib/facility/plan';
import { LEVEL_LABELS, PAYER_LABELS, type LevelOfCare, type PayerType } from '@/lib/constants';
import { UpgradePrompt } from '@/components/UpgradePrompt';

const CONCERN_LABELS: Record<string, string> = {
  alcohol: 'Alcohol',
  opioids: 'Opioids',
  stimulants: 'Stimulants',
  other_substance: 'Other substance',
  mental_health: 'Mental health',
  co_occurring: 'Co-occurring',
  unsure: 'Unsure',
};

// Face-sheet keys already shown in the header — don't repeat in the detail grid.
const HEADER_KEYS = new Set(['name', 'full_name', 'preferred_name', 'email', 'phone', 'status']);
const FIELD_LABELS: Record<string, string> = {
  insurance_carrier: 'Insurance carrier',
  insurance_member_id: 'Member ID',
  other_substances: 'Other substances',
  last_use: 'Last use',
  co_occurring_mh: 'Co-occurring',
  prior_treatment: 'Prior treatment',
  court_ordered: 'Court ordered',
  urgency: 'Urgency',
  transportation_needs: 'Transportation',
  dob: 'Date of birth',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
};
const fieldLabel = (k: string) => FIELD_LABELS[k] ?? k.replace(/_/g, ' ');

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'accepted'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'declined'
        ? 'bg-slate-100 text-slate-500'
        : status === 'viewed'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-teal-100 text-teal-800';
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

function ContactCard({ c, canSeeIdentity }: { c: MatchedContact; canSeeIdentity: boolean }) {
  const deid = [
    c.level ? LEVEL_LABELS[c.level as LevelOfCare] ?? c.level : null,
    c.concern ? CONCERN_LABELS[c.concern] ?? c.concern : null,
    c.payer ? PAYER_LABELS[c.payer as PayerType] ?? c.payer : null,
    c.coverage ? `coverage: ${c.coverage}` : null,
    c.region ? `region ${c.region}xx` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const details = c.faceSheet
    ? Object.entries(c.faceSheet)
        .filter(([k, v]) => !HEADER_KEYS.has(k) && v !== null && v !== undefined && String(v).trim() !== '')
        .slice(0, 14)
    : [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-800">
            {c.shared && canSeeIdentity ? c.name || 'Matched seeker' : 'Matched seeker'}
          </div>
          <div className="mt-0.5 text-sm text-slate-500">{deid || 'Match details on file'}</div>

          {c.shared && canSeeIdentity ? (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
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
          ) : c.shared ? (
            <div className="mt-1">
              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                Contact details shared — upgrade to view
              </span>
            </div>
          ) : (
            <div className="mt-1 text-xs text-slate-400">Hasn&apos;t shared contact details</div>
          )}
        </div>
        <div className="text-right">
          <StatusBadge status={c.status} />
          <div className="mt-1 text-xs text-slate-400">{new Date(c.matchedAt).toLocaleDateString()}</div>
        </div>
      </div>

      {c.shared && canSeeIdentity && details.length > 0 && (
        <div className="mt-3 grid gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2">
          {details.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-slate-50 py-1">
              <span className="capitalize text-slate-500">{fieldLabel(k)}</span>
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
  const { data: facility } = await supabase.from('facilities').select('name, plan').eq('id', id).maybeSingle();
  if (!facility) notFound();

  const plan = normalizePlan(facility.plan);
  const vaultOn = isVaultEnabled();
  // Seeing a seeker's IDENTITY (name/phone/face sheet) is a Growth+ feature; the
  // de-identified matched contacts themselves are visible to every facility member.
  const canSeeIdentity = planAllows(plan, 'seekerContacts') && vaultOn;

  const contacts = await listFacilityContacts(id);
  const sharedCount = contacts.filter((c) => c.shared).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/facility/${id}`} className="text-sm text-teal-700">
          ← Back to profile
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">Contacts</h1>
        <p className="text-sm text-slate-500">
          Everyone the matcher routed to {facility.name}. De-identified by default; people who consented to share
          show their full details. Private to your team — never shown publicly.
        </p>
      </div>

      {!canSeeIdentity && (
        <UpgradePrompt
          variant="card"
          title="Unlock who your matches are"
          body={`You're seeing de-identified matched seekers${sharedCount ? ` — ${sharedCount} already consented to share their contact details` : ''}. ${PLAN_LABEL[requiredPlan('seekerContacts')]} and up reveals names, phone/email, and their full intake so your team can reach out.`}
          cta="Upgrade to see contacts →"
          href={`/pricing?facility=${id}`}
        />
      )}

      {contacts.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No matched contacts yet. When a seeker matches with {facility.name}, they&apos;ll appear here automatically.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-400">
            {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} · protected information, handle with care.
          </p>
          <div className="space-y-3">
            {contacts.map((c) => (
              <ContactCard key={c.routeId} c={c} canSeeIdentity={canSeeIdentity} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
