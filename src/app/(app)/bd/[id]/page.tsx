import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getRoles } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  freshnessTone,
  LEVEL_LABELS,
  PAYER_LABELS,
  type LevelOfCare,
  type PayerType,
} from '@/lib/constants';
import { addNote, deleteNote, toggleSaved } from '../actions';

const TONE_STYLES = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
} as const;

type Cap = { level_of_care: string; beds_available: number; last_updated: string };
type Payer = { payer_type: string; in_network: boolean };
type Contact = { name?: string; email?: string; phone?: string };
type Note = { id: string; body: string; created_at: string };

export default async function BdFacility({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, isBd } = await getRoles();
  if (!user) redirect('/login');
  if (!isBd) redirect('/bd');

  const supabase = await createClient();
  const { data: facility } = await supabase
    .from('facilities')
    .select(
      'id, name, city, state, referral_contact, facility_capacity(level_of_care, beds_available, last_updated), facility_payers(payer_type, in_network)'
    )
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();
  if (!facility) notFound();

  const [{ data: savedRow }, { data: noteData }] = await Promise.all([
    supabase
      .from('bd_saved_facilities')
      .select('facility_id')
      .eq('bd_user_id', user.id)
      .eq('facility_id', id)
      .maybeSingle(),
    supabase
      .from('bd_facility_notes')
      .select('id, body, created_at')
      .eq('facility_id', id)
      .eq('bd_user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const caps = (facility.facility_capacity ?? []) as Cap[];
  const payers = (facility.facility_payers ?? []) as Payer[];
  const contact = (facility.referral_contact ?? {}) as Contact;
  const notes = (noteData ?? []) as Note[];
  const isSaved = !!savedRow;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/bd" className="text-sm text-teal-700">
          ← Directory
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{facility.name}</h1>
            <p className="text-sm text-slate-500">
              {[facility.city, facility.state].filter(Boolean).join(', ') || 'No location set'}
            </p>
          </div>
          <form action={toggleSaved}>
            <input type="hidden" name="facility_id" value={id} />
            <input type="hidden" name="currently_saved" value={String(isSaved)} />
            <button
              type="submit"
              className={
                'rounded-md px-3 py-1.5 text-sm font-medium ' +
                (isSaved ? 'bg-teal-50 text-teal-700' : 'border border-slate-300 text-slate-600')
              }
            >
              {isSaved ? '★ Saved' : '☆ Save'}
            </button>
          </form>
        </div>
      </div>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Live availability</h2>
          <div className="space-y-1">
            {caps.map((c) => {
              const tone = freshnessTone(c.last_updated);
              return (
                <div key={c.level_of_care} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {LEVEL_LABELS[c.level_of_care as LevelOfCare] ?? c.level_of_care}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-slate-600">{c.beds_available} beds</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${TONE_STYLES[tone]}`}>
                      {tone === 'green' ? 'fresh' : tone === 'amber' ? 'aging' : 'stale'}
                    </span>
                  </span>
                </div>
              );
            })}
            {caps.length === 0 && <p className="text-sm text-slate-500">No capacity reported.</p>}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Accepts</h2>
          <p className="text-sm text-slate-700">
            {payers.length
              ? payers
                  .map((p) => `${PAYER_LABELS[p.payer_type as PayerType] ?? p.payer_type}${p.in_network ? '' : ' (OON)'}`)
                  .join(', ')
              : 'Not specified'}
          </p>
          {(contact.phone || contact.email) && (
            <p className="mt-3 text-sm text-slate-600">
              Intake{contact.name ? ` · ${contact.name}` : ''}: {contact.phone}
              {contact.phone && contact.email ? ' · ' : ''}
              {contact.email}
            </p>
          )}
        </div>
      </section>

      {/* Private notes — about the place, never patients */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">My notes</h2>
        <form action={addNote} className="flex gap-2">
          <input type="hidden" name="facility_id" value={id} />
          <input
            name="body"
            placeholder="Add a note about this facility…"
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white">
            Add
          </button>
        </form>
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start justify-between rounded-md border border-slate-200 bg-white p-3">
              <p className="text-sm text-slate-700">{n.body}</p>
              <form action={deleteNote}>
                <input type="hidden" name="note_id" value={n.id} />
                <input type="hidden" name="facility_id" value={id} />
                <button type="submit" className="ml-3 text-xs text-slate-400 hover:text-red-600">
                  Delete
                </button>
              </form>
            </div>
          ))}
          {notes.length === 0 && <p className="text-sm text-slate-500">No notes yet.</p>}
        </div>
      </section>
    </div>
  );
}
