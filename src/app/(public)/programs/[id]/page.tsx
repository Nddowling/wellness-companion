import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  LEVEL_LABELS,
  PAYER_LABELS,
  freshnessTone,
  isBedBased,
  type LevelOfCare,
  type PayerType,
} from '@/lib/constants';
import { addReview } from '../actions';

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
  const images = (f.images ?? []) as string[];
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex gap-4 text-sm text-teal-700">
        <Link href="/match" className="hover:underline">
          ← Your matches
        </Link>
        <Link href="/programs" className="hover:underline">
          Browse all programs
        </Link>
      </div>

      {/* Hero */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {images.slice(0, 3).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={f.name} className="h-44 w-full object-cover" />
            ))}
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center bg-gradient-to-br from-teal-700 to-emerald-400 text-white">
            <div className="text-center">
              <div className="text-3xl font-semibold">{f.name.charAt(0)}</div>
              <div className="mt-1 text-xs opacity-80">Photos coming soon</div>
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
              {f.website && (
                <a
                  href={f.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark"
                >
                  Go to website ↗
                </a>
              )}
              {intakePhone && (
                <a
                  href={`tel:${intakePhone.replace(/[^\d+]/g, '')}`}
                  className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                >
                  Call intake
                </a>
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

      {f.description && <p className="mt-5 text-sm leading-relaxed text-slate-700">{f.description}</p>}

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

        <form action={addReview} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-medium text-slate-700">Share your experience</h3>
          <input type="hidden" name="facility_id" value={f.id} />
          <div className="flex gap-2">
            <input
              name="author_name"
              placeholder="Name or initials (optional)"
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <select name="rating" defaultValue="" className="rounded border border-slate-300 px-2 py-2 text-sm text-slate-600">
              <option value="">Rating</option>
              <option value="5">★★★★★</option>
              <option value="4">★★★★</option>
              <option value="3">★★★</option>
              <option value="2">★★</option>
              <option value="1">★</option>
            </select>
          </div>
          <textarea
            name="body"
            required
            rows={3}
            placeholder="What was your experience like? What should others know?"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            Post comment
          </button>
          <p className="text-xs text-slate-400">
            Please be respectful and don&apos;t include anyone&apos;s private health details.
          </p>
        </form>
      </section>
    </main>
  );
}
