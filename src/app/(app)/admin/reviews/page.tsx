import Link from 'next/link';

import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { approveReview, rejectReview } from '../actions';

type Review = {
  id: string;
  facility_id: string;
  author_name: string | null;
  rating: number | null;
  body: string;
  created_at: string;
  status: string;
  facilities: { name: string } | null;
};

function stars(n: number | null): string {
  if (!n) return 'No rating';
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}

export default async function AdminReviews() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('facility_reviews')
    .select('id, facility_id, author_name, rating, body, created_at, status, facilities(name)')
    .order('created_at', { ascending: false });
  const reviews = (data ?? []) as unknown as Review[];
  const pending = reviews.filter((r) => r.status === 'pending');
  const resolved = reviews.filter((r) => r.status !== 'pending').slice(0, 30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Reviews</h1>
        <p className="text-sm text-slate-500">
          {pending.length} awaiting moderation · public comments appear on a program only after you approve them.
        </p>
      </div>

      <div className="space-y-2">
        {pending.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Nothing to moderate.
          </p>
        )}
        {pending.map((r) => (
          <div key={r.id} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/admin/facilities/${r.facility_id}`} className="text-sm font-medium text-teal-700 hover:underline">
                {r.facilities?.name ?? 'Facility'}
              </Link>
              <span className="text-xs text-amber-500">{stars(r.rating)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.body}</p>
            <div className="mt-1 text-xs text-slate-400">
              {r.author_name || 'Anonymous'} · {new Date(r.created_at).toLocaleString()}
            </div>
            <div className="mt-2 flex gap-2">
              <form action={approveReview}>
                <input type="hidden" name="review_id" value={r.id} />
                <input type="hidden" name="facility_id" value={r.facility_id} />
                <button className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white">Approve</button>
              </form>
              <form action={rejectReview}>
                <input type="hidden" name="review_id" value={r.id} />
                <button className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600">Reject</button>
              </form>
            </div>
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-700">Recently moderated</h2>
          {resolved.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-white px-3 py-2 text-xs text-slate-500"
            >
              <span className="min-w-0 truncate">
                {r.facilities?.name ?? 'Facility'} — &ldquo;{r.body.slice(0, 60)}&rdquo;
              </span>
              <span className={r.status === 'approved' ? 'shrink-0 text-emerald-600' : 'shrink-0 text-slate-400'}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
