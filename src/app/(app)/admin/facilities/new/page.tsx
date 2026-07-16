import Link from 'next/link';

import { createFacility } from '../../actions';
import { LEVELS_OF_CARE, LEVEL_LABELS, PAYER_TYPES, PAYER_LABELS } from '@/lib/constants';

const inputClass = 'rounded-md border border-slate-300 px-3 py-2 text-sm w-full';
const labelClass = 'text-xs font-medium text-slate-600';

export default function NewFacilityPage() {
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-teal-700">
        ← Back
      </Link>
      <h1 className="text-xl font-semibold text-slate-800">Onboard facility</h1>

      <form action={createFacility} className="space-y-6">
        <section className="grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelClass}>Facility name *</span>
            <input name="name" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Street</span>
            <input name="street" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>City</span>
            <input name="city" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>State</span>
            <input name="state" maxLength={2} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>ZIP</span>
            <input name="zip" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>NPI</span>
            <input name="npi" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>License #</span>
            <input name="license_number" className={inputClass} />
          </label>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <p className={labelClass}>Levels of care</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {LEVELS_OF_CARE.map((l) => (
              <label key={l} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name={`level_${l}`} /> {LEVEL_LABELS[l]}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Residential creates a bed-capacity row. Detox setting and outpatient scheduling are not represented as
            bed counts in the current model.
          </p>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <p className={labelClass}>Payer types accepted</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {PAYER_TYPES.map((p) => (
              <label key={p} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name={`payer_${p}`} /> {PAYER_LABELS[p]}
              </label>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Specialties (comma-separated)</span>
            <input name="specialties" placeholder="dual_diagnosis, trauma" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Populations served (comma-separated)</span>
            <input name="populations_served" placeholder="adolescent, veterans" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Accreditations (comma-separated)</span>
            <input name="accreditations" placeholder="jcaho, carf" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Cash rate (USD)</span>
            <input name="cash_rate" type="number" step="0.01" className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_gated" /> Gated community
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_faith_based" /> Faith-based
          </label>
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-3">
          <p className={`${labelClass} sm:col-span-3`}>Intake contact — shown publicly so matched seekers can reach the program&apos;s admissions team</p>
          <input name="contact_name" placeholder="Name" className={inputClass} />
          <input name="contact_email" type="email" autoComplete="email" placeholder="Email" className={inputClass} />
          <input name="contact_phone" type="tel" autoComplete="tel" placeholder="Phone" className={inputClass} />
        </section>

        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
          Create facility
        </button>
      </form>
    </div>
  );
}
