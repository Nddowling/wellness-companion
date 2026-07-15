import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireFacilityMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { listFacilityContacts, type MatchedContact } from '@/lib/facility/contacts';
import { LEVEL_LABELS, PAYER_LABELS, type LevelOfCare, type PayerType } from '@/lib/constants';

const CONCERN_LABELS: Record<string, string> = {
  substance_use: 'Substance use',
  alcohol: 'Alcohol',
  opioids: 'Opioids',
  stimulants: 'Stimulants',
  other_substance: 'Other substance',
  mental_health: 'Mental health',
  co_occurring: 'Co-occurring',
  unsure: 'Unsure',
};

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

function ContactCard({ c }: { c: MatchedContact }) {
  const summary = [
    c.level ? LEVEL_LABELS[c.level as LevelOfCare] ?? c.level : null,
    c.concern ? CONCERN_LABELS[c.concern] ?? c.concern : null,
    c.payer ? PAYER_LABELS[c.payer as PayerType] ?? c.payer : null,
    c.region ? `region ${c.region}xx` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div id={c.routeId} className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-800">
            Matched seeker
          </div>
          <div className="mt-0.5 text-sm text-slate-500">{summary || 'Match details on file'}</div>

          {c.shared ? (
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
          ) : (
            <div className="mt-1 text-xs text-slate-400">Hasn&apos;t shared contact details</div>
          )}
        </div>
        <div className="text-right">
          <StatusBadge status={c.status} />
          <div className="mt-1 text-xs text-slate-400">{new Date(c.matchedAt).toLocaleDateString()}</div>
        </div>
      </div>

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

  const contacts = await listFacilityContacts(id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/facility/${id}`} className="text-sm text-teal-700">
          ← Back to profile
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">Contacts</h1>
        <p className="text-sm text-slate-500">
          Everyone the matcher routed to {facility.name}. Direct identifiers are withheld by default; people who consented to share
          show their full details. Private to your team — never shown publicly.
        </p>
      </div>

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
              <ContactCard key={c.routeId} c={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
