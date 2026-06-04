import { freshnessTone } from '@/lib/constants';
import type { FacilitySummary } from '@/lib/email/templates';

// Turns a facility row (with embedded capacity + payers) into the compact summary
// the email templates render. Shared by /api/handoff and the weekly-reminder cron.

export type FacilityRowForSummary = {
  name: string;
  city: string | null;
  state: string | null;
  levels_of_care: string[];
  referral_contact: unknown;
  facility_capacity?: { beds_available: number; last_updated: string }[] | null;
  facility_payers?: { payer_type: string }[] | null;
};

export function toFacilitySummary(f: FacilityRowForSummary | null | undefined): FacilitySummary | null {
  if (!f) return null;
  const caps = f.facility_capacity ?? [];
  const oldest = caps.length
    ? caps.reduce((o, c) => (c.last_updated < o ? c.last_updated : o), caps[0].last_updated)
    : null;
  const tone = freshnessTone(oldest);
  const beds = caps.reduce((s, c) => s + (c.beds_available || 0), 0);
  return {
    name: f.name,
    city: f.city,
    state: f.state,
    levels: f.levels_of_care ?? [],
    payers: (f.facility_payers ?? []).map((p) => p.payer_type),
    beds,
    freshnessLabel:
      tone === 'green'
        ? 'Beds confirmed recently'
        : tone === 'amber'
          ? 'Availability updated this week'
          : 'Call to confirm current availability',
    contact: (f.referral_contact ?? null) as FacilitySummary['contact'],
  };
}
