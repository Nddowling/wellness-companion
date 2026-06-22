'use client';

import { useEffect } from 'react';

import { recordViewAction } from '@/app/(app)/partners/actions';

/** Fire-and-forget: records that the signed-in partner opened this facility. */
export function RecordView({ facilityId }: { facilityId: string }) {
  useEffect(() => {
    recordViewAction(facilityId).catch(() => {});
  }, [facilityId]);
  return null;
}
