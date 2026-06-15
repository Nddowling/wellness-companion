import Link from 'next/link';
import type { ReactNode } from 'react';

function LockedPreview({
  title,
  body,
  plan,
  children,
  className = '',
}: {
  title: string;
  body: string;
  plan: 'Starter' | 'Growth';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white ${className}`}>
      <div aria-hidden="true" className="pointer-events-none select-none opacity-35 grayscale">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/55 p-4 backdrop-blur-[1px]">
        <div className="max-w-xs rounded-xl border border-slate-200 bg-white/95 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">🔒 {plan} feature</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-800">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
          <Link
            href="/pricing"
            className="mt-3 inline-flex rounded-md bg-terracotta px-4 py-2 text-sm font-semibold text-white transition hover:bg-terracotta-dark"
          >
            Upgrade to {plan}
          </Link>
        </div>
      </div>
    </div>
  );
}

const LOCKED_COUNT = 7; // keep in sync with the cards below — used in the hero hook

export function FreeProfileUpgradePreview({
  facilityName,
  location,
  treatmentTypes,
  accreditations = [],
  phone,
  email,
  engagement30 = 0,
}: {
  facilityName: string;
  location: string;
  treatmentTypes: string;
  accreditations?: string[];
  phone?: string | null;
  email?: string | null;
  engagement30?: number;
}) {
  return (
    <section className="space-y-5">
      {/* ── FOMO hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-terracotta/30 bg-gradient-to-br from-terracotta/10 via-white to-teal-50 p-6">
        <span className="inline-block rounded-full bg-terracotta px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          You&apos;re on the Free plan
        </span>
        <h2 className="mt-3 font-serif text-2xl leading-tight text-ink sm:text-3xl">
          Your listing is live — and it&apos;s already working.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-700">
          {engagement30 > 0 ? (
            <>
              <strong className="text-ink">{engagement30} famil{engagement30 === 1 ? 'y' : 'ies'}</strong> took action on
              your bare listing in the last 30 days — with nothing but your name, location, and phone number.
            </>
          ) : (
            <>Families are finding you here, free — with nothing but your name, location, and phone number.</>
          )}{' '}
          Imagine what they&apos;d do with <strong>photos</strong>, <strong>your story</strong>,{' '}
          <strong>reviews</strong>, and a one-tap way to reach your intake team. You&apos;re leaving{' '}
          <strong>{LOCKED_COUNT} upgrades</strong> on the table.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/pricing"
            className="rounded-md bg-terracotta px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
          >
            Unlock your full profile →
          </Link>
          <span className="text-xs text-slate-500">Starter is the highest-ROI line in your outreach budget.</span>
        </div>
      </div>

      {/* ── The actual free tile: "what families see today" ───────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-start">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            What families see today
          </p>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-lg font-semibold text-slate-800">{facilityName}</h3>
            <p className="text-xs text-slate-500">{location || 'Location on file'}</p>
            {accreditations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {accreditations.slice(0, 3).map((a) => (
                  <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {a.toUpperCase()}
                  </span>
                ))}
              </div>
            )}
            <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Treatment</dt>
                <dd className="text-right text-slate-600">{treatmentTypes || 'Addiction treatment'}</dd>
              </div>
              {phone && (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Phone</dt>
                  <dd className="text-right text-slate-600">{phone}</dd>
                </div>
              )}
              {email && (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Email</dt>
                  <dd className="truncate text-right text-slate-600">{email}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              That&apos;s the whole free listing. No photos, no story, no reviews, no website link.
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
            What you&apos;d unlock — only you can see these previews
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <LockedPreview
              plan="Starter"
              title="Show your facility with real photos"
              body="Add a gallery so seekers can see the environment before they reach out."
              className="min-h-56 sm:col-span-2"
            >
              <div className="grid h-56 grid-cols-3 gap-1 bg-slate-100 p-2">
                <div className="flex items-center justify-center rounded-lg bg-slate-300 text-sm font-medium text-slate-600">
                  Main photo
                </div>
                <div className="flex items-center justify-center rounded-lg bg-slate-200 text-sm font-medium text-slate-600">
                  Program space
                </div>
                <div className="flex items-center justify-center rounded-lg bg-slate-300 text-sm font-medium text-slate-600">
                  Rooms &amp; grounds
                </div>
              </div>
            </LockedPreview>

            <LockedPreview
              plan="Starter"
              title="Tell seekers what makes you different"
              body="Unlock your About section, specialties, website link, and call-intake button."
              className="min-h-64"
            >
              <div className="space-y-4 p-5">
                <div>
                  <h3 className="text-xl font-semibold text-slate-800">{facilityName}</h3>
                  <p className="text-sm text-slate-500">{location || 'Your location'}</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white">Go to website</span>
                  <span className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white">Call intake</span>
                </div>
                <div className="space-y-2">
                  <div className="h-3 rounded-full bg-slate-300" />
                  <div className="h-3 w-11/12 rounded-full bg-slate-300" />
                  <div className="h-3 w-4/5 rounded-full bg-slate-300" />
                </div>
              </div>
            </LockedPreview>

            <LockedPreview
              plan="Growth"
              title="Add a welcome or walkthrough video"
              body="Give families a clearer sense of your team and space before the first call."
              className="min-h-64"
            >
              <div className="flex h-64 items-center justify-center bg-slate-800">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl text-slate-700">
                  ▶
                </div>
              </div>
            </LockedPreview>

            <LockedPreview
              plan="Starter"
              title="Publish the details people compare"
              body="Populations served, insurance, specialties, amenities — the decision-making details."
              className="min-h-72 sm:col-span-2"
            >
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                {[
                  ['Specializes in', 'Trauma support', 'Co-occurring care', 'Family support'],
                  ['Who you serve', 'Adults', 'Young adults', 'Veterans'],
                  ['Insurance & payment', 'Commercial insurance', 'Medicaid', 'Self-pay options'],
                  ['Good to know', 'Accreditations', 'Intake hours', 'On-site services'],
                ].map(([heading, ...items]) => (
                  <div key={heading} className="rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700">{heading}</h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {items.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </LockedPreview>

            <LockedPreview
              plan="Starter"
              title="Show a map and directions"
              body="Help seekers understand where you are and make the next step easier."
              className="min-h-56"
            >
              <div className="relative h-56 overflow-hidden bg-slate-200">
                <div className="absolute left-1/4 top-0 h-full w-8 rotate-12 bg-white" />
                <div className="absolute left-0 top-1/2 h-8 w-full -rotate-6 bg-white" />
                <div className="absolute right-1/4 top-1/3 h-12 w-12 rounded-full border-8 border-slate-700 bg-white" />
                <div className="absolute bottom-3 left-3 rounded bg-white px-3 py-2 text-sm text-slate-700">
                  Get directions
                </div>
              </div>
            </LockedPreview>

            <LockedPreview
              plan="Starter"
              title="Build trust with reviews"
              body="Display approved reviews and give your team the ability to respond."
              className="min-h-56"
            >
              <div className="space-y-3 p-5">
                {[1, 2].map((review) => (
                  <div key={review} className="rounded-lg bg-slate-100 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">★★★★★ Verified review</span>
                      <span className="text-sm text-slate-600">5/5</span>
                    </div>
                    <div className="mt-3 h-3 rounded-full bg-slate-300" />
                    <div className="mt-2 h-3 w-3/4 rounded-full bg-slate-300" />
                  </div>
                ))}
              </div>
            </LockedPreview>

            <LockedPreview
              plan="Growth"
              title="See who's trying to reach you"
              body="Seeker contacts, follow-up tools, and full performance analytics."
              className="min-h-56 sm:col-span-2"
            >
              <div className="grid h-56 grid-cols-2 gap-3 p-5 sm:grid-cols-4">
                {['Profile views', 'Calls', 'Directions', 'Seeker contacts'].map((label) => (
                  <div key={label} className="flex flex-col items-center justify-center rounded-lg bg-slate-100 p-3">
                    <div className="text-2xl font-semibold text-slate-700">—</div>
                    <div className="mt-1 text-center text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
            </LockedPreview>
          </div>
        </div>
      </div>
    </section>
  );
}
