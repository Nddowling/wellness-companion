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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{plan} feature</p>
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

export function FreeProfileUpgradePreview({
  facilityName,
  location,
}: {
  facilityName: string;
  location: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Upgraded public listing preview</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            These greyed-out previews are visible only to your facility team. People browsing your public Free listing
            continue to see only the basic listing.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          Facility admin preview
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LockedPreview
          plan="Starter"
          title="Show your facility with real photos"
          body="Add a gallery so seekers can see the environment before they reach out."
          className="min-h-64 lg:col-span-2"
        >
          <div className="grid h-64 grid-cols-3 gap-1 bg-slate-100 p-2">
            <div className="flex items-center justify-center rounded-lg bg-slate-300 text-sm font-medium text-slate-600">
              Main photo
            </div>
            <div className="flex items-center justify-center rounded-lg bg-slate-200 text-sm font-medium text-slate-600">
              Program space
            </div>
            <div className="flex items-center justify-center rounded-lg bg-slate-300 text-sm font-medium text-slate-600">
              Rooms and grounds
            </div>
          </div>
        </LockedPreview>

        <LockedPreview
          plan="Starter"
          title="Tell seekers what makes your program different"
          body="Unlock your About section, specialties, website link, and call-intake button."
          className="min-h-72"
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
            <div className="flex flex-wrap gap-2">
              {['Trauma-informed care', 'Family program', 'Dual diagnosis'].map((label) => (
                <span key={label} className="rounded-full bg-slate-200 px-2.5 py-1 text-xs text-slate-700">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </LockedPreview>

        <LockedPreview
          plan="Growth"
          title="Add a welcome or walkthrough video"
          body="Give families a clearer sense of your team, space, and approach before the first call."
          className="min-h-72"
        >
          <div className="flex h-72 items-center justify-center bg-slate-800">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl text-slate-700">
              Play
            </div>
          </div>
        </LockedPreview>

        <LockedPreview
          plan="Starter"
          title="Publish the details people compare"
          body="Show populations served, insurance, specialties, amenities, and other decision-making details."
          className="min-h-96 lg:col-span-2"
        >
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {[
              ['Specializes in', 'Trauma support', 'Co-occurring care', 'Family support'],
              ['Who you serve', 'Adults', 'Young adults', 'Veterans'],
              ['Insurance and payment', 'Commercial insurance', 'Medicaid', 'Self-pay options'],
              ['Good to know', 'Accreditations', 'Intake hours', 'On-site services'],
            ].map(([heading, ...items]) => (
              <div key={heading} className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700">{heading}</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {items.map((item) => (
                    <li key={item}>- {item}</li>
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
          className="min-h-64"
        >
          <div className="relative h-64 overflow-hidden bg-slate-200">
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
          className="min-h-64"
        >
          <div className="space-y-3 p-5">
            {[1, 2].map((review) => (
              <div key={review} className="rounded-lg bg-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Verified review</span>
                  <span className="text-sm text-slate-600">5 out of 5</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-slate-300" />
                <div className="mt-2 h-3 w-3/4 rounded-full bg-slate-300" />
              </div>
            ))}
          </div>
        </LockedPreview>
      </div>
    </section>
  );
}
