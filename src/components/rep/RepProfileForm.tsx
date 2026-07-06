'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import { updateRepProfileAction, type RepProfileState } from '@/app/(app)/rep/actions';
import { useToast } from '@/components/ui';
import type { RepProfile } from '@/lib/rep/data';

const field =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-teal-400 focus:outline-none';

export function RepProfileForm({ profile, defaultName }: { profile: RepProfile | null; defaultName: string }) {
  const [state, formAction, pending] = useActionState<RepProfileState, FormData>(updateRepProfileAction, {
    ok: false,
  });
  const { toast } = useToast();
  // Fire the confirmation toast once per successful save (savedAt changes each time).
  useEffect(() => {
    if (state.ok && state.savedAt) toast('Profile Successfully Saved');
    else if (state.error) toast(state.error, 'error');
  }, [state.savedAt, state.error, state.ok, toast]);
  // Live preview: the currently-saved photo, replaced instantly when a new file is picked.
  const [preview, setPreview] = useState<string | null>(profile?.photo_url ?? null);
  const [removed, setRemoved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setPreview(URL.createObjectURL(f)); // object URL renders the local file with no upload
      setRemoved(false);
    }
  }

  function clearPhoto() {
    setPreview(null);
    setRemoved(true);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      {/* Profile photo — pick straight from the device (camera or library on phone/tablet) */}
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Profile preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl text-slate-400">
              {(profile?.display_name ?? defaultName ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <label
            htmlFor="photo"
            className="inline-block cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-teal-700 hover:border-teal-400"
          >
            {preview ? 'Change photo' : 'Choose photo'}
          </label>
          {/* accept=image/* opens the photo library / camera on iOS + Android and the file picker on desktop */}
          <input
            ref={fileRef}
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            onChange={onPick}
            className="hidden"
          />
          {preview && (
            <button
              type="button"
              onClick={clearPhoto}
              className="ml-2 text-xs text-slate-400 hover:text-red-600"
            >
              Remove
            </button>
          )}
          <p className="mt-1 text-xs text-slate-400">A clear headshot works best. JPG or PNG, up to 8MB.</p>
        </div>
        {removed && <input type="hidden" name="remove_photo" value="1" />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="display_name" className="text-sm font-medium text-slate-700">
            Name
          </label>
          <input id="display_name" name="display_name" defaultValue={profile?.display_name ?? defaultName} className={field} required />
        </div>
        <div>
          <label htmlFor="location" className="text-sm font-medium text-slate-700">
            Location
          </label>
          <input id="location" name="location" defaultValue={profile?.location ?? ''} placeholder="Atlanta, GA" className={field} />
        </div>
      </div>

      <div>
        <label htmlFor="headline" className="text-sm font-medium text-slate-700">
          Headline
        </label>
        <input
          id="headline"
          name="headline"
          defaultValue={profile?.headline ?? ''}
          placeholder="Admissions Director · 8 yrs in recovery care"
          className={field}
        />
      </div>

      <div>
        <label htmlFor="bio" className="text-sm font-medium text-slate-700">
          About
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={profile?.bio ?? ''}
          rows={4}
          placeholder="Your experience, approach, and what you’re proud of."
          className={field}
        />
      </div>

      <div>
        <label htmlFor="linkedin_url" className="text-sm font-medium text-slate-700">
          LinkedIn URL
        </label>
        <input
          id="linkedin_url"
          name="linkedin_url"
          defaultValue={profile?.linkedin_url ?? ''}
          placeholder="https://linkedin.com/in/…"
          className={field}
        />
      </div>

      <div>
        <label htmlFor="specialties" className="text-sm font-medium text-slate-700">
          Specialties <span className="text-xs text-slate-400">(comma-separated)</span>
        </label>
        <input
          id="specialties"
          name="specialties"
          defaultValue={(profile?.specialties ?? []).join(', ')}
          placeholder="Detox intake, Dual diagnosis, Veterans"
          className={field}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="is_public" defaultChecked={profile?.is_public ?? true} className="h-4 w-4 rounded border-slate-300" />
        Profile is public (shareable + can appear on facility listings)
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save profile'}
        </button>
        {state.error && !pending && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
