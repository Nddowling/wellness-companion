import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';
import { LEVELS_OF_CARE, LEVEL_LABELS, PAYER_TYPES, PAYER_LABELS } from '@/lib/constants';
import { normalizePlan, PLAN_LABEL, type Plan } from '@/lib/facility/plan';
import {
  adminUpdateFacility,
  adminSetPlan,
  updateCapacity,
  togglePublish,
  verifyFacility,
  deleteFacility,
  addFacilityMember,
  removeFacilityMember,
} from '../../actions';

type Cap = { level_of_care: string; beds_available: number; last_updated: string };
type Member = { id: string; user_id: string; role: string };

const field = 'rounded border border-slate-300 px-3 py-2 text-sm';
const PLAN_BADGE: Record<Plan, string> = {
  free: 'bg-slate-100 text-slate-600',
  starter: 'bg-teal-100 text-teal-800',
  growth: 'bg-indigo-100 text-indigo-800',
  anchor: 'bg-amber-100 text-amber-800',
};

export default async function AdminFacilityEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: f } = await supabase
    .from('facilities')
    .select('*, facility_capacity(level_of_care, beds_available, last_updated), facility_payers(payer_type)')
    .eq('id', id)
    .maybeSingle();
  if (!f) notFound();

  const { data: memberRows } = await supabase.from('facility_members').select('id, user_id, role').eq('facility_id', id);
  const members = (memberRows ?? []) as Member[];
  const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? u.id]));

  const caps = (f.facility_capacity ?? []) as Cap[];
  const capByLevel = new Map(caps.map((c) => [c.level_of_care, c]));
  const facLevels = (f.levels_of_care ?? []) as string[];
  const facPayers = ((f.facility_payers ?? []) as { payer_type: string }[]).map((p) => p.payer_type);
  const contact = (f.referral_contact ?? {}) as { name?: string; email?: string; phone?: string };
  const currentPlan = normalizePlan(f.plan);
  const currentStatus = (f.plan_status as string | null) ?? 'active';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/facilities" className="text-sm text-teal-700">
            ← All facilities
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-800">{f.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/programs/${id}`} target="_blank" className="text-xs font-medium text-teal-700">
            View public profile ↗
          </Link>
          <form action={togglePublish}>
            <input type="hidden" name="facility_id" value={id} />
            <input type="hidden" name="publish" value={String(!f.is_published)} />
            <button className={'rounded-md px-3 py-1.5 text-xs font-medium ' + (f.is_published ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-600')}>
              {f.is_published ? '● Active' : '○ Inactive'}
            </button>
          </form>
          <form action={verifyFacility}>
            <input type="hidden" name="facility_id" value={id} />
            <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600">
              {f.verified_at ? 'Re-verify' : 'Verify'}
            </button>
          </form>
        </div>
      </div>

      {/* Plan & access — manual tier control (grants access immediately) */}
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Plan &amp; access</h2>
          <span className="flex items-center gap-2 text-xs">
            <span className={'rounded-full px-2 py-0.5 font-medium ' + PLAN_BADGE[currentPlan]}>
              {PLAN_LABEL[currentPlan]}
            </span>
            <span className="text-slate-400">{currentStatus}</span>
          </span>
        </div>
        <form action={adminSetPlan} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="facility_id" value={id} />
          <label className="text-xs text-slate-500">
            Tier
            <select name="plan" defaultValue={currentPlan} className={`${field} mt-1 block w-full`}>
              <option value="free">Free</option>
              <option value="starter">Starter — $499/mo</option>
              <option value="growth">Growth — $999/mo</option>
              <option value="anchor">Anchor — $1,999/mo</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Status
            <select name="plan_status" defaultValue={currentStatus} className={`${field} mt-1 block w-full`}>
              <option value="active">Active</option>
              <option value="lifetime">Lifetime (comp — never auto-downgrades)</option>
              <option value="canceled">Canceled</option>
            </select>
          </label>
          <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Apply</button>
        </form>
        <p className="text-xs text-slate-500">
          <strong>Starter</strong> unlocks photos, description, website, the call-intake button &amp; review replies ·{' '}
          <strong>Growth</strong> adds analytics, in-app seeker contacts, video &amp; featured placement ·{' '}
          <strong>Anchor</strong> adds full analytics, API bed board &amp; multi-location.
        </p>
        <p className="text-xs text-amber-700">
          Grants access immediately — does <strong>not</strong> bill. Use for comped or offline-paid accounts;
          self-serve billed upgrades go through Stripe checkout.
        </p>
      </section>

      {/* Profile editor */}
      <form action={adminUpdateFacility} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Profile</h2>
        <input type="hidden" name="facility_id" value={id} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="name" defaultValue={f.name} placeholder="Name" className={field} />
          <input name="operator_type" defaultValue={f.operator_type ?? ''} placeholder="Operator type" className={field} />
          <input name="street" defaultValue={f.street ?? ''} placeholder="Street" className={field} />
          <input name="city" defaultValue={f.city ?? ''} placeholder="City" className={field} />
          <input name="state" defaultValue={f.state ?? ''} placeholder="State" className={field} />
          <input name="zip" defaultValue={f.zip ?? ''} placeholder="ZIP" className={field} />
          <input name="website" defaultValue={f.website ?? ''} placeholder="Website (https://…)" className={field} />
          <input name="priority_tier" defaultValue={f.priority_tier ?? ''} placeholder="Priority tier" className={field} />
        </div>
        <textarea name="description" defaultValue={f.description ?? ''} rows={2} placeholder="Description (shown to seekers)" className={`${field} w-full`} />
        <input name="specialty_programs" defaultValue={f.specialty_programs ?? ''} placeholder="Specializes in (comma-separated)" className={`${field} w-full`} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="specialties" defaultValue={(f.specialties ?? []).join(', ')} placeholder="Specialties (comma-separated)" className={field} />
          <input name="populations_served" defaultValue={(f.populations_served ?? []).join(', ')} placeholder="Populations served (comma-separated)" className={field} />
          <input name="accreditations" defaultValue={(f.accreditations ?? []).join(', ')} placeholder="Accreditations (comma-separated)" className={field} />
          <input name="carriers_named" defaultValue={(f.carriers_named ?? []).join(', ')} placeholder="Accepted carriers (comma-separated)" className={field} />
        </div>

        <div>
          <div className="mb-1 text-xs text-slate-500">Levels of care</div>
          <div className="flex flex-wrap gap-3">
            {LEVELS_OF_CARE.map((l) => (
              <label key={l} className="flex items-center gap-1 text-sm text-slate-700">
                <input type="checkbox" name={`level_${l}`} defaultChecked={facLevels.includes(l)} /> {LEVEL_LABELS[l]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-slate-500">Payers accepted</div>
          <div className="flex flex-wrap gap-3">
            {PAYER_TYPES.map((p) => (
              <label key={p} className="flex items-center gap-1 text-sm text-slate-700">
                <input type="checkbox" name={`payer_${p}`} defaultChecked={facPayers.includes(p)} /> {PAYER_LABELS[p]}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1 text-sm text-slate-700">
            <input type="checkbox" name="is_gated" defaultChecked={f.is_gated} /> Gated
          </label>
          <label className="flex items-center gap-1 text-sm text-slate-700">
            <input type="checkbox" name="is_faith_based" defaultChecked={f.is_faith_based} /> Faith-based
          </label>
          <input name="cash_rate" type="number" defaultValue={f.cash_rate ?? ''} placeholder="Self-pay rate" className={`${field} w-32`} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <input name="contact_name" defaultValue={contact.name ?? ''} placeholder="Intake contact name" className={field} />
          <input name="contact_phone" defaultValue={contact.phone ?? ''} placeholder="Intake phone" className={field} />
          <input name="contact_email" defaultValue={contact.email ?? ''} placeholder="Intake email" className={field} />
        </div>
        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Save profile</button>
      </form>

      {/* Capacity */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Bed availability</h2>
        {facLevels.map((lvl) => {
          const cap = capByLevel.get(lvl);
          return (
            <form key={lvl} action={updateCapacity} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3">
              <input type="hidden" name="facility_id" value={id} />
              <input type="hidden" name="level_of_care" value={lvl} />
              <span className="w-44 text-sm text-slate-700">{LEVEL_LABELS[lvl as (typeof LEVELS_OF_CARE)[number]] ?? lvl}</span>
              <input type="number" name="beds_available" min={0} defaultValue={cap?.beds_available ?? 0} className={`${field} w-20`} />
              <span className="text-xs text-slate-400">beds</span>
              <button className="ml-auto rounded-md bg-teal-700 px-3 py-1 text-sm font-medium text-white">Save</button>
            </form>
          );
        })}
      </section>

      {/* Members */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Facility members (logins)</h2>
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 text-sm">
            <span className="text-slate-700">
              {emailById.get(m.user_id) ?? m.user_id} <span className="text-xs text-slate-400">· {m.role}</span>
            </span>
            <form action={removeFacilityMember}>
              <input type="hidden" name="member_id" value={m.id} />
              <input type="hidden" name="facility_id" value={id} />
              <button className="text-xs text-slate-400 hover:text-red-600">Remove</button>
            </form>
          </div>
        ))}
        <form action={addFacilityMember} className="flex gap-2">
          <input type="hidden" name="facility_id" value={id} />
          <input name="email" type="email" required placeholder="Add member by email…" className={`${field} flex-1`} />
          <button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white">Add &amp; invite</button>
        </form>
      </section>

      {/* Danger zone */}
      <section className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 className="text-sm font-semibold text-red-700">Delete facility</h2>
        <p className="text-xs text-red-600">Removes the facility and all its data. This cannot be undone.</p>
        <form action={deleteFacility}>
          <input type="hidden" name="facility_id" value={id} />
          <button className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white">Delete facility</button>
        </form>
      </section>
    </div>
  );
}
