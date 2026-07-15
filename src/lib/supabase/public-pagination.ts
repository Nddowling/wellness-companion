import 'server-only';

import { throwOnPublicReadError } from '@/lib/public-read-error';

const PAGE_SIZE = 1_000;
const MAX_PAGES = 100;

type PageResult<T> = {
  data: T[] | null;
  error: { code?: string | null } | null;
};

/** Collect a stable, ordered PostgREST query without silently stopping at max_rows. */
export async function collectPublicRows<T>(
  context: string,
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const from = index * PAGE_SIZE;
    const result = await page(from, from + PAGE_SIZE - 1);
    throwOnPublicReadError(context, result.error);
    const batch = result.data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new Error('Public directory query exceeded its safe pagination bound.');
}
