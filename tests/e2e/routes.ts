/**
 * Single source of truth for the route inventory the specs iterate over.
 * Kept in sync with docs/qa/QA-TEST-CATALOG.md. When you add a route, add it here
 * and the access-control matrix picks it up automatically.
 */

/** Public routes — must be 200 for everyone, no auth cookie required. §1a */
export const PUBLIC_ROUTES: { id: string; path: string }[] = [
  { id: 'AC-P1', path: '/' },
  { id: 'AC-P2', path: '/about' },
  { id: 'AC-P3', path: '/pricing' },
  { id: 'AC-P4', path: '/how-we-make-money' },
  { id: 'AC-P5', path: '/for-providers' },
  { id: 'AC-P6', path: '/for-partners' },
  { id: 'AC-P7', path: '/for-reps' },
  { id: 'AC-P8', path: '/claim' },
  { id: 'AC-P9', path: '/data' },
  { id: 'AC-P10', path: '/guides' },
  { id: 'AC-P11', path: '/library' },
  { id: 'AC-P12', path: '/resources' },
  { id: 'AC-P13', path: '/insurance' },
  { id: 'AC-P14', path: '/programs' },
  { id: 'AC-P15a', path: '/treatment' },
  { id: 'AC-P15b', path: '/contact' },
  { id: 'AC-P16a', path: '/match' },
  { id: 'AC-P16b', path: '/match/nearby' },
  { id: 'AC-P17a', path: '/privacy' },
  { id: 'AC-P17b', path: '/terms' },
  { id: 'AC-P18a', path: '/login' },
  { id: 'AC-P18b', path: '/reset' },
];

/** Authed-shell routes — anon must be redirected to /login. §1b/1c */
export const APP_ROUTES: { id: string; path: string; lane: string }[] = [
  { id: 'AC-1', path: '/me', lane: 'seeker' },
  { id: 'AC-2', path: '/conversations', lane: 'seeker' },
  { id: 'AC-4', path: '/facility', lane: 'facility' },
  { id: 'AC-8', path: '/partners', lane: 'partner' },
  { id: 'AC-9', path: '/partners/search', lane: 'partner' },
  { id: 'AC-10', path: '/partners/saved', lane: 'partner' },
  { id: 'AC-11', path: '/partners/lists', lane: 'partner' },
  { id: 'AC-12', path: '/partners/history', lane: 'partner' },
  { id: 'AC-13', path: '/partners/settings', lane: 'partner' },
  { id: 'AC-15', path: '/rep', lane: 'rep' },
  { id: 'AC-16', path: '/admin', lane: 'admin' },
  { id: 'AC-17', path: '/get-started', lane: 'any' },
];
