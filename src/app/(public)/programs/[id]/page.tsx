import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import JsonLd from '@/components/JsonLd';
import { GoToWebsiteButton } from '@/components/GoToWebsiteButton';
import { TrackedContactLink } from '@/components/TrackedContactLink';
import { MatchBackLink } from '@/components/MatchBackLink';
import { Gallery } from '@/components/Gallery';
import { FacilityTeam } from '@/components/rep/FacilityTeam';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePlan, planAllows } from '@/lib/facility/plan';
import { getRoles, isProviderSide } from '@/lib/auth';
import {
  LEVEL_LABELS,
  PAYER_LABELS,
  bedSummary,
  freshnessTone,
  isBedBased,
  type LevelOfCare,
  type PayerType,
} from '@/lib/constants';
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl } from '@/lib/seo';
import { stateSlug, stateName, slugify } from '@/lib/geo';
import { ReviewForm } from './ReviewForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: f } = await supabase
    .from('facilities')
    .select('name, city, state, levels_of_care, description, images')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();

  if (!f) return { title: 'Program not found', robots: { index: false, follow: true } };

  const loc = [f.city, f.state].filter(Boolean).join(', ');
  const levels = ((f.levels_of_care ?? []) as string[])
    .map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l)
    .join(', ');
  const title = `${f.name}${loc ? ` — ${loc}` : ''}`;
  const description =
    (f.description && f.description.trim().slice(0, 200)) ||
    `${f.name}${loc ? ` in ${loc}` : ''} offers ${levels || 'addiction and mental-health treatment'}. ` +
      `See levels of care, accepted insurance, bed availability, reviews, and how to reach their intake team.`;
  const image = ((f.images ?? []) as string[])[0] || DEFAULT_OG_IMAGE.url;
  const canonical = `/programs/${id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title: `${title} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(canonical),
      images: [{ url: image }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

type Cap = { level_of_care: string; beds_available: number; last_updated: string };
type Payer = { payer_type: string; in_network: boolean };
type Review = {
  id: string;
  author_name: string | null;
  rating: number | null;
  body: string;
  created_at: string;
};

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

export default async function ProgramProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: f } = await supabase
    .from('facilities')
    .select('*, facility_capacity(level_of_care, beds_available, last_updated), facility_payers(payer_type, in_network)')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();
  if (!f) notFound();

  const { data: reviewRows } = await supabase
    .from('facility_reviews')
    .select('id, author_name, rating, body, created_at')
    .eq('facility_id', id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  const reviews = (reviewRows ?? []) as Review[];

  const caps = (f.facility_capacity ?? []) as Cap[];
  const payers = (f.facility_payers ?? []) as Payer[];
  // Plan-gated profile richness (photos, about, website are part of a claimed,
  // Starter+ profile). Matching/availability is NOT gated — it stays need-based.
  const plan = normalizePlan(f.plan);
  const providerSide = isProviderSide(await getRoles());
  const showCallIntake = planAllows(plan, 'callIntake'); // no "Call intake" on Free profiles
  const images = planAllows(plan, 'photos') ? ((f.images ?? []) as string[]) : [];
  const videos = planAllows(plan, 'video') ? ((f.videos ?? []) as string[]) : [];
  const showDescription = planAllows(plan, 'description') && !!f.description;
  const showWebsite = planAllows(plan, 'website') && !!f.website;
  const contact = (f.referral_contact ?? {}) as { name?: string; email?: string; phone?: string };
  const intakePhone = f.intake_line || contact.phone || f.main_phone || null;

  const levels = (f.levels_of_care ?? []) as string[];
  const specialties = [...((f.specialties ?? []) as string[]), ...splitList(f.specialty_programs)];
  const populations = (f.populations_served ?? []) as string[];
  const carriers = (f.carriers_named ?? []) as string[];
  const govPayers = payers.filter((p) => p.payer_type !== 'commercial');
  const acceptsCommercial = payers.some((p) => p.payer_type === 'commercial');

  const ratings = reviews.map((r) => r.rating).filter((r): r is number => typeof r === 'number');
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  // schema.org MedicalBusiness — drives rich results (rating stars, address, phone).
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: f.name,
    url: absoluteUrl(`/programs/${f.id}`),
    address: {
      '@type': 'PostalAddress',
      ...(f.street ? { streetAddress: f.street } : {}),
      ...(f.city ? { addressLocality: f.city } : {}),
      ...(f.state ? { addressRegion: f.state } : {}),
      ...(f.zip ? { postalCode: f.zip } : {}),
      addressCountry: 'US',
    },
    medicalSpecialty: 'Addiction',
    image: images.length ? images.slice(0, 3) : [absoluteUrl(DEFAULT_OG_IMAGE.url)],
  };
  if (showDescription) jsonLd.description = f.description;
  if (intakePhone) jsonLd.telephone = intakePhone;
  if (showWebsite) jsonLd.sameAs = [f.website];
  if (f.city || f.state) {
    jsonLd.areaServed = { '@type': 'Place', name: [f.city, f.state].filter(Boolean).join(', ') };
  }
  if (f.cash_rate) jsonLd.priceRange = `$${Number(f.cash_rate).toLocaleString()}`;
  if (avg !== null && ratings.length) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: avg.toFixed(1),
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (reviews.length) {
    jsonLd.review = reviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author_name || 'Anonymous' },
      ...(r.created_at ? { datePublished: r.created_at.slice(0, 10) } : {}),
      reviewBody: r.body,
      ...(r.rating
        ? { reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 } }
        : {}),
    }));
  }

  const goodToKnow: [string, string | null][] = [
    ['Setting', f.operator_type],
    ['Beds', f.bed_detail],
    ['Detox on-site', f.detox_on_site],
    ['MAT on-site', f.mat_on_site],
    ['Co-occurring / dual diagnosis', f.co_occurring],
    ['Court-ordered accepted', f.accepts_court_ordered],
    ['Intake hours', f.intake_hours],
    ['Accreditations', (f.accreditations ?? []).join(', ') || null],
  ];

  // FREE tier → a basic directory listing only: name, location, accreditations,
  // treatment type, address, and email. No photos, insurance, description,
  // reviews, etc. (Claiming the program + upgrading unlocks the full profile.)
  if (plan === 'free') {
    const streetAddress = [f.street, f.zip].filter(Boolean).join(', '); // the specific part; city/state is in the header
    const treatmentTypes =
      levels.map((l) => LEVEL_LABELS[l as LevelOfCare] ?? l).join(' · ') || 'Addiction & mental-health treatment';
    const email = contact.email || null;
    const minimalLd = {
      '@context': 'https://schema.org',
      '@type': 'MedicalBusiness',
      name: f.name,
      medicalSpecialty: 'Addiction',
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
      <main className="mx-auto max-w-3xl px-4 py-8">
        <JsonLd data={minimalLd} />
        <div className="flex gap-4 text-sm text-teal-700">
          <MatchBackLink className="hover:underline" />
          <Link href="/programs" className="hover:underline">
            Browse all programs
          </Link>
        </div>

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
              Unverified listing — details not yet confirmed
            </div>
          )}

          {((f.accreditations ?? []).length > 0 || f.is_faith_based || f.verified_at) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(f.accreditations ?? []).map((a: string) => (
                <span key={a} className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                  {a.toUpperCase()}
                </span>
              ))}
              {f.is_faith_based && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">Faith-based</span>
              )}
              {f.verified_at && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">Verified</span>
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
                    className="text-teal-700 hover:underline"
                  >
                    {intakePhone}
                  </TrackedContactLink>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="mt-6">
          <FacilityTeam facilityId={f.id} />
        </div>

        {!providerSide && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-terracotta/40 bg-gradient-to-br from-terracotta/5 to-sage/10">
            <div className="border-b border-terracotta/20 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-terracotta-dark">Is this your program?</div>
              <h2 className="mt-1 font-serif text-xl text-ink">Claim this profile — free — to add:</h2>
            </div>
            <ul className="grid gap-x-5 gap-y-2.5 px-5 py-4 sm:grid-cols-2">
              {[
                'Website & online presence',
                'Admissions email',
                'Photos & your logo',
                'Named insurance plans',
                'Medicaid MCO names',
                'License & accreditation proof',
                'Current availability notes',
                'Cash / self-pay pricing',
                'Fast-response intake links',
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
              <Link
                href="/for-providers"
                className="rounded-md bg-terracotta px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
              >
                Claim this profile →
              </Link>
              <Link href="/for-reps" className="text-sm font-medium text-teal-700 hover:underline">
                Or add yourself to the team →
              </Link>
              <span className="text-xs text-slate-500">Free · verified by our team</span>
            </div>
          </div>
        )}
      </main>
    );
  }

  const mapQuery = [f.street, f.city, f.state, f.zip].filter(Boolean).join(', ');
  const anyAccepting = levels.some(
    (l) => !isBedBased(l) || (caps.find((c) => c.level_of_care === l)?.beds_available ?? 0) > 0
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <JsonLd data={jsonLd} />
      <div className="flex gap-4 text-sm text-teal-700">
        <MatchBackLink className="hover:underline" />
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
                  {stars(avg)} <span className="text-slate-500">({reviews.length})</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {showWebsite && (
                <GoToWebsiteButton
                  facilityId={f.id}
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
                  className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                >
                  Call intake
                </TrackedContactLink>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(f.accreditations ?? []).map((a: string) => (
              <span key={a} className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                {a.toUpperCase()}
              </span>
            ))}
            {f.is_faith_based && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">Faith-based</span>
            )}
            {f.verified_at && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">Verified</span>
            )}
          </div>
        </div>
      </div>

      {anyAccepting && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
          <span>
            <strong>Accepting clients now</strong> — contact their intake team to confirm a spot.
          </span>
        </div>
      )}

      {showDescription && <p className="mt-5 text-sm leading-relaxed text-slate-700">{f.description}</p>}

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
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Levels of care</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {levels.length ? (
              levels.map((l) => {
                const cap = caps.find((c) => c.level_of_care === l);
                const tone = !isBedBased(l)
                  ? 'outpatient'
                  : cap && cap.beds_available > 0
                    ? freshnessTone(cap.last_updated)
                    : 'none';
                return (
                  <li key={l} className="flex items-center justify-between gap-2">
                    <span>• {LEVEL_LABELS[l as LevelOfCare] ?? l}</span>
                    <span className="text-xs text-slate-400">
                      {tone === 'outpatient'
                        ? 'outpatient'
                        : tone === 'none'
                          ? 'call to confirm beds'
                          : cap
                            ? `${cap.beds_available} beds`
                            : ''}
                    </span>
                  </li>
                );
              })
            ) : (
              <li className="text-slate-400">Not specified</li>
            )}
          </ul>
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
              <li className="text-slate-400">All adults (confirm specifics)</li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Insurance &amp; payment</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {govPayers.map((p) => (
              <li key={p.payer_type}>
                • {PAYER_LABELS[p.payer_type as PayerType] ?? p.payer_type}
                {p.in_network ? '' : ' (out-of-network)'}
              </li>
            ))}
            {acceptsCommercial &&
              (carriers.length > 0 ? (
                carriers.map((c, i) => <li key={i}>• {c}</li>)
              ) : (
                <li>• Most major commercial insurance (call to confirm)</li>
              ))}
            {f.cash_rate ? <li>• Self-pay rate: ${Number(f.cash_rate).toLocaleString()}</li> : null}
            {!payers.length && carriers.length === 0 && (
              <li className="text-slate-400">Call to verify coverage</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-slate-400">Always confirm current in-network status with the program.</p>
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

      {/* Their team (verified reps) */}
      <div className="mt-5">
        <FacilityTeam facilityId={f.id} />
      </div>

      {/* Reviews */}
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">
          What people say {avg !== null && <span className="text-amber-500">· {stars(avg)}</span>}
        </h2>

        <div className="mt-3 space-y-3">
          {reviews.length === 0 && (
            <p className="text-sm text-slate-500">
              No comments yet. If you&apos;ve been here, your experience could help someone else decide.
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

        <ReviewForm facilityId={f.id} />
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

      {/* Mobile sticky contact bar — claimed/paid profiles only (desktop uses the hero buttons) */}
      {((showCallIntake && intakePhone) || contact.email) && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
          {showCallIntake && intakePhone && (
            <TrackedContactLink
              facilityId={f.id}
              eventType="call"
              href={`tel:${intakePhone.replace(/[^\d+]/g, '')}`}
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
              className="flex-1 rounded-md border border-teal-600 px-4 py-2.5 text-center text-sm font-semibold text-teal-700"
            >
              Email
            </TrackedContactLink>
          )}
        </div>
      )}
    </main>
  );
}
