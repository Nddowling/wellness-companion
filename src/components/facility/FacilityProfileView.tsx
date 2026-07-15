import Link from 'next/link';

import JsonLd, { serializeJsonLd } from '@/components/JsonLd';
import { GoToWebsiteButton } from '@/components/GoToWebsiteButton';
import { TrackedContactLink } from '@/components/TrackedContactLink';
import { FacilityProfileAnalytics } from '@/components/analytics/FacilityProfileAnalytics';
import { ClaimProfileLink } from '@/components/analytics/ClaimProfileLink';
import { Gallery } from '@/components/Gallery';
import { FacilityTeam } from '@/components/rep/FacilityTeam';
import { FacilityContextBlock } from '@/components/facility/FacilityContextBlock';
import { FacilityRichSections } from '@/components/facility/FacilityRichSections';
import { FacilityStickyNav } from '@/components/facility/FacilityStickyNav';
import { FacilityStickyContact } from '@/components/facility/FacilityStickyContact';
import { hasFullPublicProfile } from '@/lib/facility/plan';
import { HideForProviders } from '@/components/facility/HideForProviders';
import { loadFacilityContext, loadFacilityReviews, type FacilityFull } from '@/lib/facility/load';
import { facilityContextLines } from '@/lib/facility/context';
import {
  LEVEL_LABELS,
  PAYER_LABELS,
  bedSummary,
  freshnessTone,
  isBedBased,
  availabilityStale,
  availabilityAsOf,
  AVAILABILITY_DISCLAIMER,
  type LevelOfCare,
  type PayerType,
} from '@/lib/constants';
import { absoluteUrl } from '@/lib/seo';
import { stateSlug, stateName, slugify } from '@/lib/geo';
import { Breadcrumb, breadcrumbJsonLd, DisclosurePanel, Accordion } from '@/components/ui';
import { SnapshotBar } from '@/components/SnapshotBar';
import { PayerMark } from '@/components/PayerLogo';
import { payerTypeBrand, payerBrandForLabel } from '@/lib/payers';
import { credentialLabel, normalizeCredentials } from '@/lib/facility/accreditation';

type Cap = { level_of_care: string; beds_available: number; last_updated: string; updated_by?: string | null };
type Payer = { payer_type: string };

function splitList(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/[,;]|·| - /)
    .map((s) => s.trim())
    .filter(Boolean);
}

function stars(n: number): string {
  const r = Math.round(n);
  return '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
}

function FacilityTrustPanel({
  claimed,
  verificationConfidence,
  lastVerified,
  verifiedAt,
  verifiedBy,
  sourceUrl,
  caps,
}: {
  claimed: boolean;
  verificationConfidence: string | null;
  lastVerified: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  sourceUrl: string | null;
  caps: Cap[];
}) {
  const isSamhsaImport = verifiedBy === 'samhsa_import';
  let verificationLabel = 'Directory source — confirm details directly';
  if (claimed) verificationLabel = 'Program ownership claim approved by an administrator';
  else if (verifiedAt) verificationLabel = 'Listing reviewed by an administrator';
  else if (isSamhsaImport) verificationLabel = 'SAMHSA directory import — confirm details directly';
  else if (verificationConfidence === 'high') verificationLabel = 'High-confidence directory source';
  else if (verificationConfidence === 'medium') verificationLabel = 'Cross-checked directory source';
  const latestCapacity = [...caps]
    .filter((cap) => isBedBased(cap.level_of_care) && cap.last_updated)
    .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())[0] ?? null;
  // The imported corpus carries a generic locator homepage, not a record-level
  // citation. Do not present that generic URL as if it substantiated this listing.
  const linkedSource = !isSamhsaImport && sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null;
  const formatDate = (value: string | null) =>
    value && !Number.isNaN(new Date(value).getTime())
      ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
          new Date(value),
        )
      : null;
  // `facilities.updated_at` can be bumped by imports or related availability edits,
  // so it is never evidence that the profile was checked. The SAMHSA backfill also
  // marks its timestamp as an import rather than an independent verification.
  const checked = formatDate(verifiedAt) ?? (isSamhsaImport ? null : formatDate(lastVerified));
  const imported = isSamhsaImport ? formatDate(lastVerified) : null;
  const verificationDetail = checked
    ? `record checked ${checked}`
    : imported
      ? `directory source imported ${imported}`
      : linkedSource
        ? 'source linked below; no check date recorded'
        : 'no source check date recorded';

  return (
    <section aria-label="Profile trust and data sources" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">How to read this profile</h2>
      <dl className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-slate-700">Profile ownership</dt>
          <dd>{claimed ? 'Claimed by the program' : 'Maintained from directory sources'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Verification</dt>
          <dd>
            {verificationLabel} · {verificationDetail}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Availability</dt>
          <dd>
            {latestCapacity
              ? `${latestCapacity.updated_by ? 'Program account report' : 'Directory availability record'} · ${availabilityAsOf(latestCapacity.last_updated)}`
              : 'No residential-bed report available'}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Availability, insurance, accreditation, and services can change. Exact bed counts are hidden after seven days;
        confirm current availability, network status, benefits, and credentials directly.
        {linkedSource && (
          <>
            {' '}
            <a href={linkedSource} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-700 hover:underline">
              View cited source page ↗
            </a>
          </>
        )}
      </p>
    </section>
  );
}

/**
 * The full facility profile, rendered from a pre-loaded row. Shared by the
 * canonical slug route (/treatment/[state]/[city]/[slug]) and the legacy UUID
 * route. `canonicalPath` is the slug URL and is used for the JSON-LD `url`.
 */
export async function FacilityProfileView({ f, canonicalPath }: { f: FacilityFull; canonicalPath: string }) {
  const id = f.id;
  const reviews = await loadFacilityReviews(id);

  // Computed-differentiation lines (city → county → state) — unique factual value per
  // page. Rendered on both free and full profiles (free/thin pages need it most).
  const ctx = await loadFacilityContext(f);
  const contextLines = ctx ? facilityContextLines(f, ctx) : [];

  const caps = (f.facility_capacity ?? []) as Cap[];
  const payers = (f.facility_payers ?? []) as Payer[];
  // Only an approved ownership claim unlocks full public-profile content. A paid
  // subscription adds operational tooling but cannot unlock an unclaimed profile.
  const fullProfile = hasFullPublicProfile(f.facility_claims);
  const isClaimed = fullProfile;
  const showCallIntake = fullProfile;
  const images = fullProfile ? ((f.images ?? []) as string[]) : [];
  const videos = fullProfile ? ((f.videos ?? []) as string[]) : [];
  // Descriptions render on every profile regardless of plan: unclaimed pages carry a
  // directory-authored, source-grounded description (the SEO layer + what drives the
  // claim/growth loop), and a free claim lets a facility replace it with their own.
  const showDescription = !!f.description;
  const showWebsite = fullProfile && !!f.website;
  const contact = (f.referral_contact ?? {}) as { name?: string; email?: string; phone?: string };
  const intakePhone = f.intake_line || contact.phone || f.main_phone || null;

  // Public directory facts shared by every analytics event on this page — no
  // seeker-identifying data, just the listed business.
  const facilityMeta = {
    id: f.id as string,
    name: f.name as string,
    slug: (f.slug ?? null) as string | null,
    city: (f.city ?? null) as string | null,
    state: (f.state ?? null) as string | null,
    facilityType: (f.operator_type ?? null) as string | null,
  };

  const levels = (f.levels_of_care ?? []) as string[];
  const specialties = [...((f.specialties ?? []) as string[]), ...splitList(f.specialty_programs)];
  const populations = (f.populations_served ?? []) as string[];
  const carriers = (f.carriers_named ?? []) as string[];
  const govPayers = payers.filter((p) => p.payer_type !== 'commercial');
  const acceptsCommercial = payers.some((p) => p.payer_type === 'commercial');
  const credentials = normalizeCredentials(f.accreditations);

  const ratings = reviews.map((r) => r.rating).filter((r): r is number => typeof r === 'number');
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  // Breadcrumb trail: All Centers → State → City → this program (orientation + SEO).
  const st = f.state ? f.state.toUpperCase() : null;
  const crumbs: { label: string; href?: string }[] = [{ label: 'All Centers', href: '/' }];
  if (st) crumbs.push({ label: stateName(st), href: `/treatment/${stateSlug(st)}` });
  if (st && f.city) crumbs.push({ label: f.city, href: `/treatment/${stateSlug(st)}/${slugify(f.city)}` });
  crumbs.push({ label: f.name });

  // FAQs generated from structured fields and mirrored exactly in FAQPage JSON-LD.
  const paymentNames = [
    ...govPayers.map((p) => PAYER_LABELS[p.payer_type as PayerType] ?? p.payer_type),
    ...(acceptsCommercial ? ['commercial insurance'] : []),
  ];
  const faqs: { q: string; a: string }[] = [];
  if (levels.length)
    faqs.push({
      q: `What levels of care are listed for ${f.name}?`,
      a: `The directory lists ${levels.map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l).join(', ')}. A qualified provider determines the appropriate level of care and admission.`,
    });
  faqs.push({
    q: `Does ${f.name} accept insurance?`,
    a: paymentNames.length ? `The directory lists these payment categories: ${paymentNames.join(', ')}. This does not prove in-network status or member benefits; confirm both directly.` : `Call the program and your insurer to verify coverage.`,
  });
  faqs.push({
    q: `Is detox available at ${f.name}?`,
    a: levels.includes('detox') ? `Detox is listed for ${f.name}. Confirm clinical staffing and admission details directly.` : `Detox is not listed for this program — ask their intake team about options.`,
  });
  if (f.city || f.state) faqs.push({ q: `Where is ${f.name} located?`, a: `${f.name} is in ${[f.city, f.state].filter(Boolean).join(', ')}.` });

  // schema.org MedicalBusiness describing only facts also visible on this page.
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: f.name,
    url: absoluteUrl(canonicalPath),
    address: {
      '@type': 'PostalAddress',
      ...(f.street ? { streetAddress: f.street } : {}),
      ...(f.city ? { addressLocality: f.city } : {}),
      ...(f.state ? { addressRegion: f.state } : {}),
      ...(f.zip ? { postalCode: f.zip } : {}),
      addressCountry: 'US',
    },
    ...(images.length ? { image: images.slice(0, 3) } : {}),
  };
  if (showDescription) jsonLd.description = f.description;
  if (intakePhone) jsonLd.telephone = intakePhone;
  if (showWebsite) jsonLd.sameAs = [f.website];
  if (f.city || f.state) {
    jsonLd.areaServed = { '@type': 'Place', name: [f.city, f.state].filter(Boolean).join(', ') };
  }
  // Community comments are moderated but identity and attendance are not verified,
  // so they are deliberately excluded from Review/AggregateRating structured data.

  const goodToKnow: [string, string | null][] = [
    ['Setting', f.operator_type],
    ['Beds', f.bed_detail],
    ['Detox on-site', f.detox_on_site],
    ['MAT on-site', f.mat_on_site],
    ['Co-occurring / dual diagnosis', f.co_occurring],
    ['Court-ordered accepted', f.accepts_court_ordered],
    ['Intake hours', f.intake_hours],
    ['Credentials reported', credentials.map(credentialLabel).join(', ') || null],
  ];

  // Unclaimed free directory rows stay concise until a program takes ownership.
  // Claiming is free and immediately unlocks the complete public profile.
  if (!fullProfile) {
    const streetAddress = [f.street, f.zip].filter(Boolean).join(', '); // the specific part; city/state is in the header
    const treatmentTypes =
      levels.map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l).join(' · ') || 'Addiction-treatment program';
    const email = contact.email || null;
    const minimalLd = {
      '@context': 'https://schema.org',
      '@type': 'MedicalBusiness',
      name: f.name,
      address: {
        '@type': 'PostalAddress',
        ...(f.street ? { streetAddress: f.street } : {}),
        ...(f.city ? { addressLocality: f.city } : {}),
        ...(f.state ? { addressRegion: f.state } : {}),
        ...(f.zip ? { postalCode: f.zip } : {}),
        addressCountry: 'US',
      },
      ...(f.city || f.state
        ? { areaServed: { '@type': 'Place', name: [f.city, f.state].filter(Boolean).join(', ') } }
        : {}),
      ...(email ? { email } : {}),
      ...(intakePhone ? { telephone: intakePhone } : {}),
    };
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 pb-28">
        <JsonLd data={minimalLd} />
        <FacilityProfileAnalytics
          facilityId={f.id}
          facilityName={f.name}
          slug={f.slug}
          city={f.city}
          state={f.state}
          facilityType={f.operator_type}
          hasWebsite={Boolean(f.website)}
          hasPhone={Boolean(intakePhone)}
          sourcePage="facility_profile_free"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs)) }} />
        <Breadcrumb items={crumbs} />

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h1 className="text-2xl font-semibold text-slate-800">{f.name}</h1>
          <p className="text-sm text-slate-500">
            {[f.city, f.state].filter(Boolean).join(', ') || 'Location on file'}
            {f.operator_type ? ` · ${f.operator_type}` : ''}
          </p>

          {!f.verified_at && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M8.49 2.94c.67-1.16 2.35-1.16 3.02 0l6.28 10.87c.67 1.17-.17 2.63-1.51 2.63H3.72c-1.34 0-2.18-1.46-1.51-2.63L8.49 2.94zM10 7a1 1 0 0 0-1 1v3a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1zm0 7.5a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2z"
                  clipRule="evenodd"
                />
              </svg>
              Directory-sourced listing — details not admin-reviewed
            </div>
          )}

          {(credentials.length > 0 || f.is_faith_based || f.verified_at) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {credentials.map((credential) => (
                <span
                  key={`${credential.kind}:${credential.label}`}
                  title="Credential reported in the directory source; confirm current status with the issuing body."
                  className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800"
                >
                  {credentialLabel(credential)}
                </span>
              ))}
              {f.is_faith_based && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">Faith-based</span>
              )}
              {f.verified_at && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">Admin-reviewed listing</span>
              )}
            </div>
          )}

          <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
            {streetAddress && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Address</dt>
                <dd className="text-right text-slate-700">{streetAddress}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Treatment</dt>
              <dd className="text-right text-slate-700">{treatmentTypes}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Beds</dt>
              <dd className="text-right text-slate-700">{bedSummary(caps, levels).label}</dd>
            </div>
            {email && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Email</dt>
                <dd className="text-right">
                  <TrackedContactLink
                    facilityId={f.id}
                    eventType="email"
                    href={`mailto:${email}`}
                    facilityName={f.name}
                    slug={f.slug}
                    city={f.city}
                    state={f.state}
                    sourcePage="facility_profile_free"
                    className="text-teal-700 hover:underline"
                  >
                    {email}
                  </TrackedContactLink>
                </dd>
              </div>
            )}
            {intakePhone && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Phone</dt>
                <dd className="text-right">
                  <TrackedContactLink
                    facilityId={f.id}
                    eventType="call"
                    href={`tel:${intakePhone.replace(/[^\d+]/g, '')}`}
                    facilityName={f.name}
                    slug={f.slug}
                    city={f.city}
                    state={f.state}
                    sourcePage="facility_profile_free"
                    className="text-teal-700 hover:underline"
                  >
                    {intakePhone}
                  </TrackedContactLink>
                </dd>
              </div>
            )}
          </dl>

          <FacilityTrustPanel
            claimed={isClaimed}
            verificationConfidence={f.verification_confidence ?? null}
            lastVerified={f.last_verified ?? null}
            verifiedAt={f.verified_at ?? null}
            verifiedBy={f.verified_by ?? null}
            sourceUrl={f.source_url ?? null}
            caps={caps}
          />
        </div>

        <FacilityContextBlock lines={contextLines} />

        {/* Recovery.com-style in-page section tabs (free profiles get them too) */}
        <FacilityStickyNav />

        {/* Rich directory content (therapies, MAT, populations, aftercare, policies) —
            public SAMHSA data, shown free on every profile. This IS the Recovery.com-style
            depth that makes a free listing worth landing on (and worth claiming). */}
        <FacilityRichSections f={f} />

        {/* Locked previews — show everything a claimed profile gets, greyed out, so the
            facility sees exactly what they're missing. Unlocks on a free claim. */}
        {(['Photos & video tour', 'Location & directions', 'Insurance & payment information'] as const).map((title) => (
          <section key={title} className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <span className="text-sm font-semibold text-slate-700">{title}</span>
              <span className="text-xs font-medium text-slate-400">🔒 Locked</span>
            </div>
            <div className="relative">
              <div className="pointer-events-none select-none opacity-60 blur-[2px] grayscale">
                {title.startsWith('Photos') ? (
                  <div className="grid grid-cols-3 gap-1 p-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-28 bg-gradient-to-br from-slate-200 to-slate-300" />
                    ))}
                  </div>
                ) : title.startsWith('Location') ? (
                  <div className="relative h-56 bg-[linear-gradient(135deg,#dbe4e0,#c3d2cc)]">
                    <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:28px_28px]" />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl">📍</span>
                  </div>
                ) : (
                  <div className="space-y-3 p-5 text-sm text-slate-600">
                    {[
                      'Reported payment categories',
                      'Program-listed commercial carrier names',
                      'Direct intake contact',
                    ].map((r) => (
                      <div key={r} className="flex items-center justify-between gap-4">
                        <span>{r}</span>
                        <span className="h-3 w-40 rounded bg-slate-200" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-white/45">
                <ClaimProfileLink
                  facility={facilityMeta}
                  sourcePage="locked_profile_preview"
                  href={`/claim?facility=${f.id}`}
                  className="rounded-full bg-ink/85 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-ink"
                >
                  🔒 Claim for free to unlock
                </ClaimProfileLink>
              </div>
            </div>
          </section>
        ))}

        <div className="mt-6">
          <FacilityTeam facilityId={f.id} />
        </div>

        <HideForProviders>
          <div className="mt-6 overflow-hidden rounded-2xl border border-terracotta/40 bg-gradient-to-br from-terracotta/5 to-sage/10">
            <div className="border-b border-terracotta/20 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-terracotta-dark">Is this your program?</div>
              <h2 className="mt-1 font-serif text-xl text-ink">Claim this profile — free — to add:</h2>
            </div>
            <ul className="grid gap-x-5 gap-y-2.5 px-5 py-4 sm:grid-cols-2">
              {[
                'Website & program description',
                'Specialty and program details',
                'Photos & video',
                'Reported payment categories',
                'Program-listed commercial carrier names',
                'Residential-bed reports',
                'Direct intake contact',
              ].map((label) => (
                <li key={label} className="flex items-start gap-2 text-sm text-slate-700">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3 border-t border-terracotta/20 px-5 py-4">
              <ClaimProfileLink
                facility={facilityMeta}
                sourcePage="facility_profile_free"
                href={`/claim?facility=${f.id}`}
                className="rounded-md bg-terracotta px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
              >
                Claim this profile for free →
              </ClaimProfileLink>
              <Link href="/for-reps" className="text-sm font-medium text-teal-700 hover:underline">
                Or add yourself to the team →
              </Link>
              <span className="text-xs text-slate-500">Free · ownership claim reviewed before access</span>
            </div>
          </div>
        </HideForProviders>

        {/* Floating contact bar — follows the user down the page */}
        <FacilityStickyContact name={f.name as string} phone={intakePhone} />
      </main>
    );
  }

  const mapQuery = [f.street, f.city, f.state, f.zip].filter(Boolean).join(', ');
  const hasFreshReportedBed = levels.some((l) => {
    if (!isBedBased(l)) return false;
    const cap = caps.find((c) => c.level_of_care === l);
    // A fresh positive report is useful evidence, but never an admission guarantee.
    return !!cap && cap.beds_available > 0 && !availabilityStale(cap.last_updated);
  });
  // True if any bed-based level has a stale/unverified count — drives the disclaimer.
  const showsBedCounts = levels.some((l) => isBedBased(l));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
      <JsonLd data={jsonLd} />
      <FacilityProfileAnalytics
        facilityId={f.id}
        facilityName={f.name}
        slug={f.slug}
        city={f.city}
        state={f.state}
        facilityType={f.operator_type}
        hasWebsite={Boolean(f.website)}
        hasPhone={Boolean(intakePhone)}
        sourcePage="facility_profile_full"
      />
      <div className="flex gap-4 text-sm text-teal-700">
        <Link href="/programs" className="hover:underline">
          Browse all programs
        </Link>
      </div>

      {/* Hero */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {images.length > 0 ? (
          <Gallery images={images} alt={f.name} />
        ) : (
          <div className="relative flex h-44 items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/facility.jpg')" }} />
            <div className="absolute inset-0 bg-gradient-to-br from-ink/70 to-brand/50" />
            <div className="relative text-center text-white">
              <div className="text-4xl font-semibold">{f.name.charAt(0)}</div>
              {[f.city, f.state].filter(Boolean).length > 0 && (
                <div className="mt-1 text-xs opacity-90">{[f.city, f.state].filter(Boolean).join(', ')}</div>
              )}
            </div>
          </div>
        )}

        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">{f.name}</h1>
              <p className="text-sm text-slate-500">
                {[f.city, f.state].filter(Boolean).join(', ') || 'Location on file'}
                {f.operator_type ? ` · ${f.operator_type}` : ''}
              </p>
              {avg !== null && (
                <p className="mt-1 text-sm text-amber-500">
                  {stars(avg)} <span className="text-slate-500">({reviews.length} community-submitted)</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {showWebsite && (
                <GoToWebsiteButton
                  facilityId={f.id}
                  facilityName={f.name}
                  slug={f.slug}
                  city={f.city}
                  state={f.state}
                  sourcePage="facility_profile_full"
                  className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark"
                >
                  Go to website ↗
                </GoToWebsiteButton>
              )}
              {intakePhone && showCallIntake && (
                <TrackedContactLink
                  facilityId={f.id}
                  eventType="call"
                  href={`tel:${intakePhone.replace(/[^\d+]/g, '')}`}
                  facilityName={f.name}
                  slug={f.slug}
                  city={f.city}
                  state={f.state}
                  sourcePage="facility_profile_full"
                  className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                >
                  Call intake
                </TrackedContactLink>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {credentials.map((credential) => (
              <span
                key={`${credential.kind}:${credential.label}`}
                title="Credential reported in the directory source; confirm current status with the issuing body."
                className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800"
              >
                {credentialLabel(credential)}
              </span>
            ))}
            {f.is_faith_based && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">Faith-based</span>
            )}
            {f.verified_at && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">Admin-reviewed listing</span>
            )}
          </div>

          <SnapshotBar
            focus={f.operator_type}
            levels={levels}
            rating={avg !== null ? { avg, count: reviews.length } : null}
            paymentLabel={paymentNames.slice(0, 3).join(' · ') || null}
          />
        </div>
      </div>

      <FacilityTrustPanel
        claimed={isClaimed}
        verificationConfidence={f.verification_confidence ?? null}
        lastVerified={f.last_verified ?? null}
        verifiedAt={f.verified_at ?? null}
        verifiedBy={f.verified_by ?? null}
        sourceUrl={f.source_url ?? null}
        caps={caps}
      />

      {hasFreshReportedBed && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
          <span>
            <strong>Recent positive bed report</strong> — contact the intake team to confirm current availability and admission.
          </span>
        </div>
      )}

      <FacilityContextBlock lines={contextLines} />

      {showDescription && <p className="mt-5 text-sm leading-relaxed text-slate-700">{f.description}</p>}

      {/* Recovery.com-style in-page section tabs — sticks under the header on scroll */}
      <FacilityStickyNav />

      {f.street && (
        <section className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <iframe
            title={`Map of ${f.name}`}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&output=embed`}
            className="h-64 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <span className="truncate text-slate-500">{mapQuery}</span>
            <TrackedContactLink
              facilityId={f.id}
              eventType="directions"
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              facilityName={f.name}
              slug={f.slug}
              city={f.city}
              state={f.state}
              sourcePage="facility_profile_full"
              className="shrink-0 font-medium text-teal-700 hover:underline"
            >
              Get directions ↗
            </TrackedContactLink>
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Video tour</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {videos.map((src) => (
              <video
                key={src}
                src={src}
                controls
                preload="metadata"
                className="w-full rounded-xl border border-slate-200 bg-black"
              />
            ))}
          </div>
        </section>
      )}

      {/* Treatment & details */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <section id="levels" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Levels of care</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {levels.length ? (
              levels.map((l) => {
                const cap = caps.find((c) => c.level_of_care === l);
                const hasBeds = !!cap && cap.beds_available > 0;
                const fresh = hasBeds && !availabilityStale(cap!.last_updated);
                let label: string;
                let tone: 'green' | 'amber' | 'red' | 'muted';
                if (l === 'detox') {
                  label = 'setting not specified · call to confirm';
                  tone = 'muted';
                } else if (!isBedBased(l)) {
                  label = 'call for scheduling';
                  tone = 'muted';
                } else if (fresh) {
                  label = `${cap!.beds_available} beds reported · ${availabilityAsOf(cap!.last_updated)}`;
                  tone = freshnessTone(cap!.last_updated);
                } else if (hasBeds) {
                  // reported, but older than the seven-day window — never show a stale count
                  label = 'Availability not recently verified';
                  tone = 'muted';
                } else {
                  label = 'call to confirm beds';
                  tone = 'muted';
                }
                const toneClass =
                  tone === 'green'
                    ? 'text-emerald-600'
                    : tone === 'amber'
                      ? 'text-amber-600'
                      : 'text-slate-400';
                return (
                  <li key={l} className="flex items-center justify-between gap-2">
                    <span>• {LEVEL_LABELS[l as LevelOfCare] ?? l}</span>
                    <span className={`text-xs ${toneClass}`}>{label}</span>
                  </li>
                );
              })
            ) : (
              <li className="text-slate-400">Not specified</li>
            )}
          </ul>
          {showsBedCounts && (
            <p className="mt-2 text-xs text-slate-400">{AVAILABILITY_DISCLAIMER}.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Specializes in</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {specialties.length ? (
              specialties.map((s, i) => <li key={i}>• {s}</li>)
            ) : (
              <li className="text-slate-400">Ask their intake team</li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Who they serve</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {populations.length ? (
              populations.map((p) => <li key={p}>• {p.replace(/_/g, ' ')}</li>)
            ) : (
              <li className="text-slate-400">Population information not specified — confirm with intake</li>
            )}
          </ul>
        </section>

        <section id="insurance" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Insurance &amp; payment</h2>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {govPayers.map((p) => (
              <li key={p.payer_type} className="flex items-center gap-2">
                <PayerMark brand={payerTypeBrand(p.payer_type as PayerType)} size="md" />
                <span>
                  {PAYER_LABELS[p.payer_type as PayerType] ?? p.payer_type} — reported payment option
                </span>
              </li>
            ))}
            {acceptsCommercial &&
              (carriers.length > 0 ? (
                carriers.map((c, i) => {
                  const brand = payerBrandForLabel(c) ?? payerTypeBrand('commercial');
                  return (
                    <li key={i} className="flex items-center gap-2">
                      <PayerMark brand={brand} size="md" />
                      <span>{c} — reported by the program or directory source</span>
                    </li>
                  );
                })
              ) : (
                <li className="flex items-center gap-2">
                  <PayerMark brand={payerTypeBrand('commercial')} size="md" />
                  <span>Commercial insurance category listed (carrier not confirmed)</span>
                </li>
              ))}
            {!payers.length && carriers.length === 0 && (
              <li className="text-slate-400">Call to verify coverage</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            A listed payment option is not a guarantee of in-network status or member benefits. Confirm both with
            the program and your insurer.
          </p>
        </section>
      </div>

      {/* Good to know */}
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Good to know</h2>
        <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {goodToKnow
            .filter(([, v]) => v && v.trim())
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1">
                <span className="text-slate-500">{k}</span>
                <span className="text-right text-slate-700">{v}</span>
              </div>
            ))}
        </div>
      </section>

      {/* Recovery.com-style deep content — therapies, MAT, who they serve, aftercare, policies */}
      <FacilityRichSections f={f} />

      {/* Their team (verified reps) */}
      <div className="mt-5">
        <FacilityTeam facilityId={f.id} />
      </div>

      {/* Reviews */}
      <section id="reviews" className="mt-5 scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">
          What people say {avg !== null && <span className="text-amber-500">· {stars(avg)}</span>}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Published comments are moderated for safety, but Clear Bed does not verify identity, attendance, or factual
          claims. They are not medical advice or an endorsement. New submissions are paused while stronger privacy and
          experience-verification safeguards are developed.
        </p>

        <div className="mt-3 space-y-3">
          {reviews.length === 0 && (
            <p className="text-sm text-slate-500">
              No published community comments.
            </p>
          )}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{r.author_name || 'Anonymous'}</span>
                {r.rating && <span className="text-xs text-amber-500">{stars(r.rating)}</span>}
              </div>
              <p className="mt-1 text-sm text-slate-700">{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      {f.state && (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Explore more treatment near {f.city || stateName(f.state.toUpperCase())}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {f.city && (
              <Link
                href={`/treatment/${stateSlug(f.state.toUpperCase())}/${slugify(f.city)}`}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-slate-700 transition hover:border-teal-300"
              >
                All treatment in {f.city}
              </Link>
            )}
            <Link
              href={`/treatment/${stateSlug(f.state.toUpperCase())}`}
              className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-slate-700 transition hover:border-teal-300"
            >
              Treatment in {stateName(f.state.toUpperCase())}
            </Link>
            {levels.slice(0, 3).map((l) => (
              <Link
                key={l}
                href={`/treatment/${stateSlug(f.state!.toUpperCase())}/${l}`}
                className="rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 font-medium text-teal-800 transition hover:bg-teal-100"
              >
                {LEVEL_LABELS[l as LevelOfCare] ?? l} in {stateName(f.state!.toUpperCase())}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FAQs — generated from structured fields; JSON-LD mirrors the visible copy. */}
      {faqs.length > 0 && (
        <section id="faqs" className="mt-6 scroll-mt-20">
          <h2 className="h3 mb-2 text-ink">Frequently asked</h2>
          <Accordion items={faqs.map((item, i) => ({ id: `faq-${i}`, trigger: item.q, content: item.a }))} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: faqs.map((item) => ({
                  '@type': 'Question',
                  name: item.q,
                  acceptedAnswer: { '@type': 'Answer', text: item.a },
                })),
              }),
            }}
          />
        </section>
      )}

      {/* Why-trust disclosures — the "explain-it-right-there" boxes, next to the decision. */}
      <section className="mt-6 space-y-2">
        <DisclosurePanel label="How this listing is sourced" tone="trust" icon={<span aria-hidden>🛡️</span>}>
          This profile may start from the federal SAMHSA treatment directory and may be updated by an approved
          program account. {f.verified_at ? 'An administrator has reviewed the listing or ownership claim.' : 'It has not been admin-reviewed.'}{' '}
          That review is not a clinical endorsement, licensing determination, or guarantee that every field is current.{' '}
          <Link href="/about" className="font-medium text-teal-700 underline">
            How directory data works →
          </Link>
        </DisclosurePanel>
        <DisclosurePanel label="How ClearBed makes money" icon={<span aria-hidden>⚖️</span>}>
          Some programs pay a flat subscription for in-app analytics and lead-status workflow. Directory inclusion
          and need-based match order do not require payment, and fees are never per admission or per call.{' '}
          <Link href="/how-we-make-money" className="font-medium text-teal-700 underline">
            The details →
          </Link>
        </DisclosurePanel>
      </section>

      {/* Mobile sticky contact bar (desktop uses the hero buttons). */}
      {((showCallIntake && intakePhone) || contact.email) && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
          {showCallIntake && intakePhone && (
            <TrackedContactLink
              facilityId={f.id}
              eventType="call"
              href={`tel:${intakePhone.replace(/[^\d+]/g, '')}`}
              facilityName={f.name}
              slug={f.slug}
              city={f.city}
              state={f.state}
              sourcePage="facility_profile_full"
              className="flex-1 rounded-md bg-teal-700 px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Call intake
            </TrackedContactLink>
          )}
          {contact.email && (
            <TrackedContactLink
              facilityId={f.id}
              eventType="email"
              href={`mailto:${contact.email}`}
              facilityName={f.name}
              slug={f.slug}
              city={f.city}
              state={f.state}
              sourcePage="facility_profile_full"
              className="flex-1 rounded-md border border-teal-600 px-4 py-2.5 text-center text-sm font-semibold text-teal-700"
            >
              Email
            </TrackedContactLink>
          )}
        </div>
      )}

      {/* Floating contact bar — follows the user down the page */}
      <FacilityStickyContact name={f.name as string} phone={intakePhone} />
    </main>
  );
}
