'use client';

import { useActionState } from 'react';

import { approveClaim, type ApproveResult } from '../actions';

// Approve a facility claim, then show the result inline. Because the email can fail
// to deliver (no SMTP / unverified domain), we surface the single-use set-password
// link here so the admin can always hand it off directly.
export function ApproveClaim({ claimId }: { claimId: string }) {
  const [state, action, pending] = useActionState<ApproveResult, FormData>(approveClaim, null);

  if (state?.ok) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">
        <div className="font-semibold">Approved{state.email ? ` — ${state.email}` : ''}</div>
        {state.setPasswordUrl ? (
          <div className="mt-1">
            Set-password link (single-use):{' '}
            <a
              href={state.setPasswordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-[11px] text-teal-700 underline"
            >
              {state.setPasswordUrl}
            </a>
            <div className="mt-0.5 text-[11px] text-slate-600">
              They click it, choose a password, and they&apos;re in. Share it directly if the email doesn&apos;t arrive.
            </div>
          </div>
        ) : (
          <div className="mt-1 text-amber-700">
            ⚠ Couldn’t generate a set-password link — check the Supabase Site URL / redirect settings.
          </div>
        )}
        {state.email && !state.mailSent && (
          <div className="mt-1 font-medium text-amber-700">
            ⚠ The email didn’t send — share the link above with them directly.
          </div>
        )}
        {!state.facilityLinked && (
          <div className="mt-1 text-amber-700">
            ⚠ No facility linked yet — link it on the facility page to grant dashboard access.
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="claim_id" value={claimId} />
      <button
        disabled={pending}
        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Approving…' : 'Approve'}
      </button>
      {state && !state.ok && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
