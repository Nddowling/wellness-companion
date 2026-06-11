'use client';

import { useActionState } from 'react';

import { approveClaim, type ApproveResult } from '../actions';

// Approve a facility claim, then show the result inline. Because the credentials
// email can fail to deliver (Resend sandbox / unverified domain), we surface the
// temp password here so the admin can always hand it off directly.
export function ApproveClaim({ claimId }: { claimId: string }) {
  const [state, action, pending] = useActionState<ApproveResult, FormData>(approveClaim, null);

  if (state?.ok) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">
        <div className="font-semibold">Approved{state.email ? ` — ${state.email}` : ''}</div>
        {state.tempPassword ? (
          <div className="mt-1">
            Temp password:{' '}
            <code className="select-all rounded bg-white px-1 py-0.5 font-mono text-[11px] text-slate-800">
              {state.tempPassword}
            </code>{' '}
            · they sign in at <span className="font-mono">/login</span> and set a new one.
          </div>
        ) : (
          <div className="mt-1">
            This email already had an account — they sign in with their existing password (or use “Forgot password”).
          </div>
        )}
        {state.email && !state.mailSent && (
          <div className="mt-1 font-medium text-amber-700">
            ⚠ The credentials email didn’t send — share the details above with them directly.
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
