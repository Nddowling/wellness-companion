// Amazon Associates config. AMAZON_TAG is the store's tracking ID (format
// "yourstore-20"); appended to every product link so qualifying purchases are
// credited. Affiliate tags are public (they ride in the URL), so this is not a
// secret. TODO: swap the placeholder for the real Associates tag.
export const AMAZON_TAG = 'clearbed-placeholder-20';

/** Amazon search link for a category/title, tagged for affiliate credit. */
export function amazonSearch(query: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${AMAZON_TAG}`;
}
