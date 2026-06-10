import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/lib/auth';
import { getSeekerById, getConsentEvents, getSeekerTranscripts } from '@/lib/vault/seekers';
import { adminUpdateSeeker, adminDeleteSeeker } from '../../actions';

const field = 'rounded border border-slate-300 px-3 py-2 text-sm';

const CONSENT_LABELS: Record<string, string> = {
  share: 'Share details with matched programs',
  email: 'Be contacted by email',
};

export default async function AdminSeekerDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = await getSeekerById(id);
  if (!data) notFound();
  const { seeker, facilities } = data;
  const fs = seeker.face_sheet ?? {};
  const consentEvents = await getConsentEvents(id);
  const transcripts = await getSeekerTranscripts(id);

  return (
    <div className="space-y-6">
      <Link href="/admin/seekers" className="text-sm text-teal-700">
        ← All seekers
      </Link>

      <form action={adminUpdateSeeker} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-slate-800">Edit seeker</h1>
        <input type="hidden" name="seeker_id" value={seeker.id} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="name" defaultValue={seeker.name ?? ''} placeholder="Name" className={field} />
          <input name="email" defaultValue={seeker.email ?? ''} placeholder="Email" className={field} />
          <input name="phone" defaultValue={seeker.phone ?? ''} placeholder="Phone" className={field} />
          <input name="dob" defaultValue={seeker.dob ?? ''} placeholder="Date of birth" className={field} />
          <input name="insurance" defaultValue={seeker.insurance ?? ''} placeholder="Insurance" className={field} />
          <select name="status" defaultValue={seeker.status} className={field}>
            <option value="active">active</option>
            <option value="connected">connected</option>
            <option value="unsubscribed">unsubscribed</option>
          </select>
        </div>
        <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">Save</button>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Consent record</h2>
        <p className="mb-3 text-xs text-slate-400">
          Immutable audit trail — exactly what this seeker answered, and when.
        </p>
        {consentEvents.length === 0 ? (
          <p className="text-sm text-slate-400">No consent events recorded.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {consentEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1">
                <span className="text-slate-700">{CONSENT_LABELS[e.channel] ?? e.channel}</span>
                <span className="flex items-center gap-3">
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-xs font-medium ' +
                      (e.granted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500')
                    }
                  >
                    {e.granted ? 'Yes' : 'No'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(e.occurred_at).toLocaleString()}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Face sheet</h2>
        <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {Object.entries(fs)
            .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1">
                <span className="text-slate-500">{k.replace(/_/g, ' ')}</span>
                <span className="text-right text-slate-700">{String(v)}</span>
              </div>
            ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Matched programs</h2>
        <ul className="space-y-1 text-sm">
          {facilities.map((f) => (
            <li key={f.id}>
              <Link href={`/admin/facilities/${f.id}`} className="text-teal-700 hover:underline">
                {f.name}
              </Link>{' '}
              <span className="text-xs text-slate-400">— {[f.city, f.state].filter(Boolean).join(', ')}</span>
            </li>
          ))}
          {facilities.length === 0 && <li className="text-slate-400">No matched programs.</li>}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Conversation</h2>
        <p className="mb-3 text-xs text-slate-400">
          The full chat their information was gathered from.
        </p>
        {transcripts.length === 0 ? (
          <p className="text-sm text-slate-400">No saved transcript for this contact.</p>
        ) : (
          transcripts.map((t) => (
            <div key={t.id} className="mb-4 last:mb-0">
              <p className="mb-2 text-xs text-slate-400">{new Date(t.created_at).toLocaleString()}</p>
              <div className="space-y-2">
                {t.messages.map((m, i) => (
                  <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={
                        'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ' +
                        (m.role === 'user'
                          ? 'rounded-br-sm bg-teal-700 text-white'
                          : 'rounded-bl-sm bg-slate-100 text-slate-700')
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 className="text-sm font-semibold text-red-700">Delete seeker</h2>
        <form action={adminDeleteSeeker}>
          <input type="hidden" name="seeker_id" value={seeker.id} />
          <button className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white">Delete record</button>
        </form>
      </section>
    </div>
  );
}
