import { availabilityStale, freshnessTone, isBedBased } from '@/lib/constants';
import type { FacilitySummary } from '@/lib/email/templates';

// Turns a facility row (with embedded capacity + payers) into the compact summary
// the one-time, explicitly requested match email renders.

export type FacilityRowForSummary = {
  name: string;
  city: string | null;
  state: string | null;
  levels_of_care: string[];
  referral_contact: unknown;
  facility_capacity?: { level_of_care: string; beds_available: number; last_updated: string }[] | null;
  facility_payers?: { payer_type: string }[] | null;
};

export function toFacilitySummary(f: FacilityRowForSummary | null | undefined): FacilitySummary | null {
  if (!f) return null;
  const hasBedBasedLevel = (f.levels_of_care ?? []).some(isBedBased);
  const hasSettingUnknownDetox = (f.levels_of_care ?? []).includes('detox');
  const freshOpenCaps = (f.facility_capacity ?? []).filter(
    (cap) => isBedBased(cap.level_of_care) && cap.beds_available > 0 && !availabilityStale(cap.last_updated),
  );
  const oldest = freshOpenCaps.length
    ? freshOpenCaps.reduce((o, c) => (c.last_updated < o ? c.last_updated : o), freshOpenCaps[0].last_updated)
    : null;
  const tone = freshnessTone(oldest);
  const beds = freshOpenCaps.length ? freshOpenCaps.reduce((sum, cap) => sum + cap.beds_available, 0) : null;
  return {
    name: f.name,
    city: f.city,
    state: f.state,
    levels: f.levels_of_care ?? [],
    payers: (f.facility_payers ?? []).map((p) => p.payer_type),
    beds,
    freshnessLabel: !hasBedBasedLevel && hasSettingUnknownDetox
      ? 'Detox setting and availability not confirmed — call directly'
      : !hasBedBasedLevel
        ? 'Outpatient scheduling — call to confirm'
      : tone === 'green'
        ? 'Beds reported recently — call to confirm'
        : tone === 'amber'
          ? 'Bed report updated this week — call to confirm'
          : 'Call to confirm current availability',
    contact: (f.referral_contact ?? null) as FacilitySummary['contact'],
  };
}
