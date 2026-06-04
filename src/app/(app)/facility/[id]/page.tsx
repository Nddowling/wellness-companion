import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireFacilityMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  freshnessTone,
  LEVEL_LABELS,
  PAYER_LABELS,
  type LevelOfCare,
  type PayerType,
} from '@/lib/constants';
import { updateCapacity, setLeadStatus, updateContact, updateProfile, uploadPhoto, removePhoto } from '../actions';

const CONCERN_LABELS: Record<string, string> = {
  alcohol: 'Alcohol',
  opioids: 'Opioids',
  stimulants: 'Stimulants',
  other_substance: 'Other substance',
  mental_health: 'Mental health',
  co_occurring: 'Co-occurring',
  unsure: 'Unsure',
};

const TONE_STYLES = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
} as const;

type Cap = { level_of_care: string; beds_available: number; last_updated: string };
type Contact = { name?: string; email?: string; phone?: string };
type Match = {
  region_zip3: string | null;
  care_level_needed: string | null;
  payer_type: string | null;
  concern_category: string | null;
  created_at: string;
};
type Route = { id: string; status: string; created_at: string; matches: Match | null };

export default async function FacilityManage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { facilityIds } = await requireFacilityMember();
  if (!facilityIds.includes(id)) notFound();

  const supabase = await createClient();
  const { data: facility } = await supabase
    .from('facilities')
    .select(
      'id, name, city, state, verified_at, is_published, levels_of_care, referral_contact, description, website, specialty_programs, images, facility_capacity(level_of_care, beds_available, last_updated)'
    )
    .eq('id', id)
    .maybeSingle();
  if (!facility) notFound();

  const caps = (facility.facility_capacity ?? []) as Cap[];
  const capByLevel = new Map(caps.map((c) => [c.level_of_care, c]));
  const levels = (facility.levels_of_care ?? []) as string[];
  const contact = (facility.referral_contact ?? {}) as Contact;
  const images = (facility.images ?? []) as string[];

  const { data: routeData } = await supabase
    .from('match_routes')
    .select('id, status, created_at, matches(region_zip3, care_level_needed, payer_type, concern_category, created_at)')
    .eq('facility_id', id)
    .order('created_at', { ascending: false });
  const routes = (routeData ?? []) as unknown as Route[];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/facility" className="text-sm text-teal-700">
          ← All facilities
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">{facility.name}</h1>
        <p className="text-sm text-slate-500">
          {[facility.city, facility.state].filter(Boolean).join(', ') || 'No location set'}
          {facility.verified_at ? ' · verified' : ''}
          {facility.is_published ? '' : ' · not yet published'}
        </p>
        <Link href={`/programs/${id}`} target="_blank" className="mt-1 inline-block text-xs font-medium text-teal-700">
          View public profile ↗
        </Link>
      </div>

      {/* Public profile editor */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Public profile</h2>
        <form action={updateProfile} className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
          <input type="hidden" name="facility_id" value={id} />
          <label className="text-xs text-slate-500">About your program (shown to seekers)</label>
          <textarea
            name="description"
            defaultValue={facility.description ?? ''}
            rows={3}
            placeholder="Tell people what makes your program a good place to heal…"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <label className="text-xs text-slate-500">Specializes in (separate with commas)</label>
          <input
            name="specialty_programs"
            defaultValue={facility.specialty_programs ?? ''}
            placeholder="Trauma-informed, dual diagnosis, family program…"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <label className="text-xs text-slate-500">Website</label>
          <input
            name="website"
            type="url"
            defaultValue={facility.website ?? ''}
            placeholder="https://…"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="justify-self-start rounded-md bg-teal-700 px-3 py-1 text-sm font-medium text-white">
            Save profile
          </button>
        </form>
      </section>

      {/* Photos */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Photos</h2>
        <p className="text-xs text-slate-500">
          Photos of your space help people feel comfortable reaching out — it&apos;s one of the most reassuring
          things a seeker sees.
        </p>
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((src) => (
              <div key={src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Facility" className="h-24 w-32 rounded-md object-cover" />
                <form action={removePhoto} className="absolute right-1 top-1">
                  <input type="hidden" name="facility_id" value={id} />
                  <input type="hidden" name="url" value={src} />
                  <button
                    type="submit"
                    title="Remove photo"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                  >
                    ×
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
        <form action={uploadPhoto} className="flex items-center gap-2">
          <input type="hidden" name="facility_id" value={id} />
          <input type="file" name="photo" accept="image/*" required className="text-sm" />
          <button type="submit" className="rounded-md bg-teal-700 px-3 py-1 text-sm font-medium text-white">
            Upload photo
          </button>
        </form>
      </section>

      {/* Inbound leads */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Inbound leads</h2>
        {routes.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No leads yet. They&apos;ll appear here when a seeker is matched to you.
          </p>
        )}
        {routes.map((r) => (
          <div key={r.id} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-800">
                {r.matches?.care_level_needed
                  ? LEVEL_LABELS[r.matches.care_level_needed as LevelOfCare]
                  : 'Care'}{' '}
                · region {r.matches?.region_zip3 ?? '—'}xx
              </div>
              <span
                className={
                  'rounded-full px-2 py-0.5 text-xs ' +
                  (r.status === 'accepted'
                    ? 'bg-emerald-100 text-emerald-800'
                    : r.status === 'declined'
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-teal-100 text-teal-800')
                }
              >
                {r.status}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {r.matches?.payer_type ? PAYER_LABELS[r.matches.payer_type as PayerType] : 'Coverage —'} ·{' '}
              {r.matches?.concern_category
                ? CONCERN_LABELS[r.matches.concern_category] ?? r.matches.concern_category
                : 'Concern —'}{' '}
              · de-identified
            </div>
            <div className="mt-2 flex gap-2">
              {(['viewed', 'accepted', 'declined'] as const).map((s) => (
                <form key={s} action={setLeadStatus}>
                  <input type="hidden" name="route_id" value={r.id} />
                  <input type="hidden" name="facility_id" value={id} />
                  <input type="hidden" name="status" value={s} />
                  <button
                    type="submit"
                    disabled={r.status === s}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-teal-400 disabled:opacity-40"
                  >
                    {s === 'viewed' ? 'Mark viewed' : s === 'accepted' ? 'Accept' : 'Decline'}
                  </button>
                </form>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Bed availability — the moat */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Bed availability</h2>
        <p className="text-xs text-slate-500">Update whenever beds change. Each save refreshes your freshness.</p>
        <div className="space-y-2">
          {levels.map((lvl) => {
            const cap = capByLevel.get(lvl);
            const tone = freshnessTone(cap?.last_updated ?? null);
            return (
              <form
                key={lvl}
                action={updateCapacity}
                className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3"
              >
                <input type="hidden" name="facility_id" value={id} />
                <input type="hidden" name="level_of_care" value={lvl} />
                <span className="w-48 text-sm text-slate-700">
                  {LEVEL_LABELS[lvl as LevelOfCare] ?? lvl}
                </span>
                <input
                  type="number"
                  name="beds_available"
                  min={0}
                  defaultValue={cap?.beds_available ?? 0}
                  className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <span className="text-xs text-slate-400">beds</span>
                <span className={`rounded px-2 py-0.5 text-xs ${TONE_STYLES[tone]}`}>
                  {tone === 'green' ? 'fresh' : tone === 'amber' ? 'aging' : 'stale'}
                </span>
                <button
                  type="submit"
                  className="ml-auto rounded-md bg-teal-700 px-3 py-1 text-sm font-medium text-white"
                >
                  Save
                </button>
              </form>
            );
          })}
          {levels.length === 0 && (
            <p className="text-sm text-slate-500">No levels of care configured. Ask an admin to set them.</p>
          )}
        </div>
      </section>

      {/* Referral contact */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Referral contact</h2>
        <p className="text-xs text-slate-500">Who matched seekers and referrers should reach.</p>
        <form action={updateContact} className="grid max-w-lg gap-2 rounded-md border border-slate-200 bg-white p-3">
          <input type="hidden" name="facility_id" value={id} />
          <input
            name="contact_name"
            defaultValue={contact.name ?? ''}
            placeholder="Contact name (e.g. Intake Team)"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            name="contact_phone"
            defaultValue={contact.phone ?? ''}
            placeholder="Phone"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            name="contact_email"
            type="email"
            defaultValue={contact.email ?? ''}
            placeholder="Email"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button type="submit" className="justify-self-start rounded-md bg-teal-700 px-3 py-1 text-sm font-medium text-white">
            Save contact
          </button>
        </form>
      </section>
    </div>
  );
}
