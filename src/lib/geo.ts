// US state code ↔ name ↔ URL-slug helpers for the programmatic SEO landing pages
// (/treatment/[state] etc). facilities.state stores 2-letter codes.

export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'Washington, D.C.',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "GA" → "georgia" (slug uses full state name for keyword-rich URLs). */
export function stateSlug(code: string): string {
  const name = US_STATES[code.toUpperCase()];
  return name ? slugify(name) : code.toLowerCase();
}

/** "georgia" → "GA" (null if not a known state). */
export function codeFromStateSlug(slug: string): string | null {
  const target = slug.toLowerCase();
  for (const [code, name] of Object.entries(US_STATES)) {
    if (slugify(name) === target) return code;
  }
  return null;
}

export function stateName(code: string): string {
  return US_STATES[code.toUpperCase()] ?? code;
}
