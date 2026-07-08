import { facilityRich } from '@/lib/facility/samhsa';
import type { FacilityFull } from '@/lib/facility/load';

// Recovery.com-style deep-content sections, rendered from the imported SAMHSA data.
// Every block self-hides when it has no data, so thin listings degrade gracefully.

function Chips({ items, tone = 'slate' }: { items: string[]; tone?: 'slate' | 'teal' | 'indigo' }) {
  const cls =
    tone === 'teal'
      ? 'bg-teal-50 text-teal-800'
      : tone === 'indigo'
        ? 'bg-indigo-50 text-indigo-800'
        : 'bg-slate-100 text-slate-700';
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <span key={s} className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
          {s}
        </span>
      ))}
    </div>
  );
}

function Card({ id, title, subtitle, children }: { id?: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-5 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function FacilityRichSections({ f }: { f: FacilityFull }) {
  const r = facilityRich(f as Record<string, unknown>);
  if (!r.hasAny) return null;

  const name = (f.name as string) ?? 'This program';

  return (
    <>
      {/* Therapies & clinical approaches */}
      {r.approaches.length > 0 && (
        <Card id="treatment" title="Therapies & treatment approaches" subtitle={`Clinical methods offered at ${name}.`}>
          <Chips items={r.approaches} tone="teal" />
        </Card>
      )}

      {/* Medication-assisted treatment */}
      {r.mat.available && (
        <Card
          id="mat"
          title="Medication-assisted treatment (MAT)"
          subtitle="FDA-approved medications used alongside counseling to support recovery."
        >
          {r.mat.groups.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {r.mat.groups.map((g) => (
                <div key={g.label} className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{g.label}</div>
                  <ul className="mt-2 space-y-1.5">
                    {g.meds.map((m) => (
                      <li key={m} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-0.5 text-teal-600">✓</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Medication-assisted treatment is available. Contact the program for specifics.
            </p>
          )}
        </Card>
      )}

      {/* Who they serve — demographics */}
      {(r.populations.length > 0 || r.ageGroups.length > 0 || r.sexAccepted) && (
        <Card id="who" title="Who they serve">
          <div className="space-y-4">
            {r.sexAccepted && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Gender</div>
                <p className="mt-1 text-sm text-slate-700">{r.sexAccepted}</p>
              </div>
            )}
            {r.ageGroups.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Age groups</div>
                <Chips items={r.ageGroups} />
              </div>
            )}
            {r.populations.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Special populations</div>
                <Chips items={r.populations} tone="indigo" />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Languages */}
      {r.languages.length > 0 && (
        <Card id="languages" title="Languages & accessibility">
          <Chips items={r.languages} />
        </Card>
      )}

      {/* Aftercare / recovery support */}
      {r.aftercare.length > 0 && (
        <Card id="aftercare" title="Aftercare & recovery support" subtitle="Support that continues after primary treatment.">
          <ul className="grid gap-2 sm:grid-cols-2">
            {r.aftercare.map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 text-teal-600">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Facility policies / care experience */}
      {(r.smoking || r.vaping || r.telehealth) && (
        <Card id="policies" title="Care experience & policies">
          <dl className="grid gap-3 sm:grid-cols-2">
            {r.smoking && (
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Smoking</dt>
                <dd className="mt-0.5 text-sm text-slate-700">{r.smoking}</dd>
              </div>
            )}
            {r.vaping && (
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vaping</dt>
                <dd className="mt-0.5 text-sm text-slate-700">{r.vaping}</dd>
              </div>
            )}
            {r.telehealth && (
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Telehealth</dt>
                <dd className="mt-0.5 text-sm text-slate-700">Virtual visits available</dd>
              </div>
            )}
          </dl>
        </Card>
      )}
    </>
  );
}
