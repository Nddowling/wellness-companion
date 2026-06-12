'use client';

import { useActionState, useEffect, useRef } from 'react';

import { addReview, type ReviewResult } from '../actions';

// Public "share your experience" form with pending + success/error feedback.
export function ReviewForm({ facilityId }: { facilityId: string }) {
  const [state, action, pending] = useActionState<ReviewResult, FormData>(addReview, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-medium text-slate-700">Share your experience</h3>
      <input type="hidden" name="facility_id" value={facilityId} />
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
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {pending ? 'Posting…' : 'Post comment'}
      </button>
      {state?.ok && (
        <p className="text-xs font-medium text-emerald-700">Thanks — your comment will appear after a quick review.</p>
      )}
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
      <p className="text-xs text-slate-400">
        Please be respectful and don&apos;t include anyone&apos;s private health details.
      </p>
    </form>
  );
}
