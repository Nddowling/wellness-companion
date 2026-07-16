import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireFacilityMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  freshnessTone,
  isBedBased,
  isoDaysAgo,
  LEVEL_LABELS,
  PAYER_LABELS,
  PAYER_TYPES,
  type LevelOfCare,
  type PayerType,
} from '@/lib/constants';
import { updateCapacity, setLeadStatus, updateContact, updateProfile, updateInsurance, uploadPhoto, removePhoto, uploadVideo, removeVideo } from '../actions';
import { COMMERCIAL_CARRIERS } from '@/lib/payers';
import { PayerMark } from '@/components/PayerLogo';
import { payerTypeBrand } from '@/lib/payers';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { ShareProfile } from '@/components/ShareProfile';
import { FacilityTeamManager } from '@/components/rep/FacilityTeamManager';
import { absoluteUrl } from '@/lib/seo';
import { facilityCanonicalPath } from '@/lib/facility/load';
import { effectivePlan, planAllows, PLAN_LABEL } from '@/lib/facility/plan';

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

function splitList(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/[,;]|·/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function FacilityManage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const editing = edit === '1';
  const { facilityIds } = await requireFacilityMember();
  if (!facilityIds.includes(id)) notFound();

  const supabase = await createClient();
  const { data: facility } = await supabase
    .from('facilities')
    .select(
      'id, name, slug, city, state, verified_at, is_published, plan, plan_status, levels_of_care, referral_contact, description, website, specialty_programs, images, videos, accreditations, main_phone, intake_line, carriers_named, facility_capacity(level_of_care, beds_available, last_updated), facility_payers(payer_type)'
    )
    .eq('id', id)
    .maybeSingle();
  if (!facility) notFound();

  const plan = effectivePlan(facility.plan, facility.plan_status);
  const isFree = plan === 'free';
  const canSeeBasicAnalytics = planAllows(plan, 'basicAnalytics');
  const canSeeFullAnalytics = planAllows(plan, 'fullAnalytics');
  const canUseLeadStatusWorkflow = planAllows(plan, 'followUpWorkflow');

  const caps = (facility.facility_capacity ?? []) as Cap[];
  const capByLevel = new Map(caps.map((c) => [c.level_of_care, c]));
  const levels = (facility.levels_of_care ?? []) as string[];
  const contact = (facility.referral_contact ?? {}) as Contact;
  const images = (facility.images ?? []) as string[];
  const videos = (facility.videos ?? []) as string[];
  const specialties = splitList(facility.specialty_programs);
  const currentPayers = new Set(((facility.facility_payers ?? []) as { payer_type: string }[]).map((p) => p.payer_type));
  const currentCarriers = new Set((facility.carriers_named ?? []) as string[]);

  const { data: routeData } = await supabase
    .from('match_routes')
    .select('id, status, created_at, matches(region_zip3, care_level_needed, payer_type, concern_category, created_at)')
    .eq('facility_id', id)
    .order('created_at', { ascending: false });
  const routes = (routeData ?? []) as unknown as Route[];
  const openLeads = routes.filter((r) => r.status !== 'declined').length;

  const location = [facility.city, facility.state].filter(Boolean).join(', ');

  let siteVisits: number | null = null;
  let perf = [
    { label: 'Website clicks', value: 0 },
    { label: 'Calls', value: 0 },
    { label: 'Directions', value: 0 },
    { label: 'Emails', value: 0 },
  ];
  if (canSeeBasicAnalytics) {
    // These tables are deny-all through browser RLS. Membership is verified above,
    // then the service role reads only this facility's aggregate event counts.
    const admin = createAdminClient();
    const since30 = isoDaysAgo(30);
    const evCount = (type: string) =>
      admin
        .from('facility_events')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', id)
        .eq('event_type', type)
        .gte('created_at', since30);
    const [
      { count: allWeb },
      { count: calls30 },
      { count: dirs30 },
      { count: emails30 },
      { count: web30 },
    ] = await Promise.all([
      admin.from('outbound_clicks').select('id', { count: 'exact', head: true }).eq('facility_id', id),
      evCount('call'),
      evCount('directions'),
      evCount('email'),
      admin
        .from('outbound_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', id)
        .gte('created_at', since30),
    ]);
    siteVisits = allWeb;
    perf = [
      { label: 'Website clicks', value: web30 ?? 0 },
      { label: 'Calls', value: calls30 ?? 0 },
      { label: 'Directions', value: dirs30 ?? 0 },
      { label: 'Emails', value: emails30 ?? 0 },
    ];
  }
  const perfTotal = perf.reduce((s, p) => s + p.value, 0);

  // ── EDIT MODE ────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="space-y-8">
        <div>
          <Link href={`/facility/${id}`} className="text-sm text-teal-700">
            ← Back to profile
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-800">Editing {facility.name}</h1>
          <p className="text-sm text-slate-500">Changes show on your public profile right away.</p>
        </div>

        {/* Public profile editor — the full profile is free once claimed. */}
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
            things a seeker sees. JPEG, PNG, WebP, or AVIF; up to 8MB each.
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
          <form action={uploadPhoto} className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <input type="hidden" name="facility_id" value={id} />
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              className="w-full max-w-full text-sm sm:w-auto"
            />
            <button type="submit" className="rounded-md bg-teal-700 px-3 py-1 text-sm font-medium text-white">
              Upload photo
            </button>
          </form>
        </section>

        {/* Videos are part of the complete free claimed profile. */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Videos</h2>
          <p className="text-xs text-slate-500">
            A short walkthrough or welcome video builds trust faster than almost anything else. MP4, MOV, WebM,
            or Ogg; up to 25MB each.
          </p>
          {videos.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {videos.map((src) => (
                <div key={src} className="relative">
                  <video src={src} controls preload="metadata" className="h-32 w-56 rounded-md bg-black object-cover" />
                  <form action={removeVideo} className="absolute right-1 top-1">
                    <input type="hidden" name="facility_id" value={id} />
                    <input type="hidden" name="url" value={src} />
                    <button
                      type="submit"
                      title="Remove video"
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                    >
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form action={uploadVideo} className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <input type="hidden" name="facility_id" value={id} />
            <input
              type="file"
              name="video"
              accept="video/mp4,video/quicktime,video/webm,video/ogg"
              required
              className="w-full max-w-full text-sm sm:w-auto"
            />
            <button type="submit" className="rounded-md bg-teal-700 px-3 py-1 text-sm font-medium text-white">
              Upload video
            </button>
          </form>
        </section>

        {/* Insurance & payment */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Insurance &amp; payment</h2>
          <p className="text-xs text-slate-500">
            List payment types you currently accept or bill. Seekers can filter on this program-reported information,
            but it does not establish network status or member benefits.
          </p>
          <form action={updateInsurance} className="grid gap-4 rounded-md border border-slate-200 bg-white p-3">
            <input type="hidden" name="facility_id" value={id} />
            <div>
              <div className="text-xs font-medium text-slate-600">Payment types you currently accept or bill</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAYER_TYPES.map((pt) => (
                  <label key={pt} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:border-teal-400">
                    <input type="checkbox" name="payer_type" value={pt} defaultChecked={currentPayers.has(pt)} />
                    <PayerMark brand={payerTypeBrand(pt)} size="sm" />
                    {PAYER_LABELS[pt]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-600">Commercial insurers you currently accept or bill</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {COMMERCIAL_CARRIERS.map((c) => (
                  <label key={c.slug} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:border-teal-400">
                    <input type="checkbox" name="carrier" value={c.name} defaultChecked={currentCarriers.has(c.name)} />
                    <PayerMark brand={c.brand} size="sm" />
                    {c.name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                This is shown as reported directory information, not a guarantee of network status or member benefits.
              </p>
            </div>
            <button type="submit" className="justify-self-start rounded-md bg-teal-700 px-3 py-1 text-sm font-medium text-white">
              Save insurance
            </button>
          </form>
        </section>

        {/* Residential-bed availability */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Residential-bed availability</h2>
          <p className="text-xs text-slate-500">
            Update residential beds whenever the count changes. Detox, PHP, IOP, and outpatient scheduling are not
            represented as beds in the current directory model.
          </p>
          <div className="space-y-2">
            {levels.filter(isBedBased).map((lvl) => {
              const cap = capByLevel.get(lvl);
              const tone = freshnessTone(cap?.last_updated ?? null);
              return (
                <form
                  key={lvl}
                  action={updateCapacity}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-3"
                >
                  <input type="hidden" name="facility_id" value={id} />
                  <input type="hidden" name="level_of_care" value={lvl} />
                  <span className="w-full text-sm text-slate-700 sm:w-48">
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
            {!levels.some(isBedBased) && (
              <p className="text-sm text-slate-500">This facility does not currently list residential care.</p>
            )}
          </div>
        </section>

        {/* Intake contact */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Intake contact</h2>
          <p className="text-xs text-slate-500">
            Your admissions/intake point of contact. It is shown publicly so people can contact the program directly.
            When a seeker separately consents to connect, authorized users can view their name, email, and phone in Contacts.
          </p>
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
              type="tel"
              autoComplete="tel"
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

        <div>
          <Link
            href={`/facility/${id}`}
            className="inline-block rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-400"
          >
            Done editing
          </Link>
        </div>
      </div>
    );
  }

  // ── PROFILE VIEW (default landing) ─────────────────────────────────────────
  return (
    <div className="space-y-8">
      {facilityIds.length > 1 && (
        <Link href="/facility" className="text-sm text-teal-700">
          ← All facilities
        </Link>
      )}

      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {images.length > 0 ? (
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
            {images.slice(0, 3).map((src, i) => (
              // On phones show one full-width hero; the 3-up row kicks in at sm+.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={facility.name}
                className={'w-full object-cover h-48 sm:h-40 ' + (i > 0 ? 'hidden sm:block' : '')}
              />
            ))}
          </div>
        ) : (
          <div className="relative flex h-40 items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-700/80 to-teal-500/60" />
            <div className="relative text-center text-white">
              <div className="text-4xl font-semibold">{facility.name.charAt(0)}</div>
              <div className="mt-1 text-xs opacity-90">Add photos to bring your profile to life</div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{facility.name}</h1>
            <p className="text-sm text-slate-500">{location || 'No location set'}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
              {facility.verified_at ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">Listing admin-reviewed</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">Listing not admin-reviewed</span>
              )}
              {facility.is_published ? (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-800">Published</span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Not yet published</span>
              )}
              {openLeads > 0 && (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-800">
                  {openLeads} open {openLeads === 1 ? 'lead' : 'leads'}
                </span>
              )}
              {canSeeBasicAnalytics && siteVisits ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                  ClearBed sent {siteVisits} to your site
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                'rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                (isFree ? 'bg-slate-100 text-slate-600' : 'bg-teal-100 text-teal-800')
              }
            >
              {PLAN_LABEL[plan]} plan
            </span>
            {isFree && <UpgradePrompt variant="inline" cta="⬆ Upgrade" facilityId={id} />}
            <Link
              href={`/facility/${id}?edit=1`}
              className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
            >
              Edit profile
            </Link>
            <Link
              href={`/facility/${id}/contacts`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-400"
            >
              Seeker contacts
            </Link>
            <Link
              href={`/programs/${id}`}
              target="_blank"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-400"
            >
              View public profile ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Profile performance — aggregate, non-contact engagement counts. */}
      {canSeeBasicAnalytics ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Profile performance</h2>
            <span className="text-xs text-slate-400">last 30 days</span>
          </div>
          {canSeeFullAnalytics ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {perf.map((p) => (
                <div key={p.label} className="rounded-lg bg-slate-50 p-3 text-center">
                  <div className="text-2xl font-semibold text-slate-800">{p.value}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{p.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-slate-50 p-4 text-center">
              <div className="text-3xl font-semibold text-slate-800">{perfTotal}</div>
              <div className="mt-0.5 text-xs text-slate-500">contact actions across all channels</div>
              <p className="mt-2 text-xs text-slate-400">Anchor adds the channel-by-channel breakdown.</p>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            {perfTotal === 0
              ? 'No recorded contact actions in the last 30 days.'
              : `${perfTotal} contact actions from your Clear Bed Recovery profile in the last 30 days.`}
          </p>
        </section>
      ) : (
        <UpgradePrompt
          title="In-app profile analytics"
          body="Starter adds the 30-day contact-action total and all-time website referral count."
          cta="View plans →"
          facilityId={id}
        />
      )}

      {facility.is_published && <ShareProfile profileUrl={absoluteUrl(facilityCanonicalPath(facility))} facilityName={facility.name} />}

      {/* Team — reps who added themselves to this listing */}
      <div className="mt-5">
        <FacilityTeamManager facilityId={id} />
      </div>

      {/* About */}
      <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">About</h2>
          {facility.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{facility.description}</p>
          ) : (
            <p className="text-sm text-slate-400">
              No description yet.{' '}
              <Link href={`/facility/${id}?edit=1`} className="text-teal-700">
                Add one
              </Link>{' '}
              so seekers know what makes your program a good place to heal.
            </p>
          )}
          {specialties.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <span key={s} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                  {s}
                </span>
              ))}
            </div>
          )}
          {facility.website && (
            <a href={facility.website} target="_blank" rel="noreferrer" className="inline-block break-all text-sm text-teal-700 hover:underline">
              {facility.website.replace(/^https?:\/\//, '')} ↗
            </a>
          )}
      </section>

      {/* Residential-bed availability (read-only summary) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Residential-bed availability</h2>
          <Link href={`/facility/${id}?edit=1`} className="text-xs font-medium text-teal-700">
            Update beds
          </Link>
        </div>
        {!levels.some(isBedBased) ? (
          <p className="text-sm text-slate-500">
            This facility does not list residential care. Confirm detox setting and outpatient scheduling directly.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {levels.filter(isBedBased).map((lvl) => {
              const cap = capByLevel.get(lvl);
              const tone = freshnessTone(cap?.last_updated ?? null);
              return (
                <div key={lvl} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3">
                  <span className="flex-1 text-sm text-slate-700">{LEVEL_LABELS[lvl as LevelOfCare] ?? lvl}</span>
                  <span className="text-sm font-semibold text-slate-800">{cap?.beds_available ?? 0}</span>
                  <span className="text-xs text-slate-400">beds</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${TONE_STYLES[tone]}`}>
                    {tone === 'green' ? 'fresh' : tone === 'amber' ? 'aging' : 'stale'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/facility/${id}/contacts#${r.id}`}
                className="text-sm font-medium text-slate-800 hover:text-teal-700"
              >
                {r.matches?.care_level_needed
                  ? LEVEL_LABELS[r.matches.care_level_needed as LevelOfCare]
                  : 'Care'}{' '}
                · region {r.matches?.region_zip3 ?? '—'}xx
              </Link>
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
              · limited non-contact match data
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {canUseLeadStatusWorkflow ? (
                (['viewed', 'accepted', 'declined'] as const).map((s) => (
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
                ))
              ) : (
                <span className="text-xs text-slate-400">Growth adds viewed / accepted / declined status tracking.</span>
              )}
              <Link
                href={`/facility/${id}/contacts#${r.id}`}
                className="w-full text-xs font-medium text-teal-700 hover:underline sm:ml-auto sm:w-auto"
              >
                View details →
              </Link>
            </div>
          </div>
        ))}
      </section>

      {/* Intake contact (read-only summary) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Intake contact</h2>
            <p className="text-xs text-slate-500">
              Shown publicly so matched seekers can reach your admissions team.
            </p>
          </div>
          <Link href={`/facility/${id}?edit=1`} className="text-xs font-medium text-teal-700">
            Edit contact
          </Link>
        </div>
        {contact.name || contact.phone || contact.email ? (
          <div className="grid max-w-lg gap-1 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
            {contact.name && <div className="font-medium text-slate-800">{contact.name}</div>}
            {contact.phone && <div>{contact.phone}</div>}
            {contact.email && <div className="break-all">{contact.email}</div>}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No intake contact set yet.</p>
        )}
      </section>
    </div>
  );
}
