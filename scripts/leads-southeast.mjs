// ClearBed provider-sales lead builder — Southeast.
//
// Turns the facilities directory into a prioritized outreach list for TWO pipelines:
//   • Exec-track   — Owner / CEO / Founder / Executive Director  (claim + buy later)
//   • BDM-track    — Admissions / Business Development / Outreach (recruit into the BDM community)
//
// It targets only facilities NOT already in your funnel (no member, no claim) and on the
// free plan, then for each one builds clickable Google search links to find the right
// LinkedIn people. With --enrich it also fetches the facility website's team/about pages
// to pull candidate names/titles + public emails. You click the links and connect yourself
// (no LinkedIn automation — that's what keeps your account safe).
//
//   node scripts/leads-southeast.mjs                      # dry pull, all SE states, search links only -> xlsx
//   node scripts/leads-southeast.mjs --states GA,SC       # just these states
//   node scripts/leads-southeast.mjs --limit 200          # cap rows
//   node scripts/leads-southeast.mjs --enrich --throttle 800   # also fetch websites for names/emails
//
// Needs (from .env.local, auto-loaded): SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// Output: ~/Downloads/clearbed-leads-<states>-<date>.xlsx  (tabs: Facilities, Contacts)

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

function loadEnv(file = '.env.local') {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv();

const flag = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  if (i === -1) return d;
  const nx = process.argv[i + 1];
  return !nx || nx.startsWith('--') ? 'true' : nx;
};
const ENRICH = process.argv.includes('--enrich');
const RESOLVE = process.argv.includes('--resolve'); // also look up the live LinkedIn profile URL
const RESOLVE_ALL = process.argv.includes('--resolve-all'); // resolve every tier, not just A/B
const LIMIT = Number(flag('limit', '2000'));
const OFFSET = Number(flag('offset', '0')); // for 100/day pagination: day N uses --offset (N-1)*100
const THROTTLE = Number(flag('throttle', '900'));
const SEARCH_THROTTLE = Number(flag('search-throttle', '1400'));
let SEARCHES_LEFT = Number(flag('max-searches', '120')); // global query budget (protects free quotas)
const SE_DEFAULT = ['GA', 'SC', 'NC', 'FL', 'AL', 'TN', 'MS', 'LA', 'KY', 'VA'];
const STATES = (flag('states', '') || '')
  .toUpperCase()
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const TARGET_STATES = STATES.length ? STATES : SE_DEFAULT;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('  ✗ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── role targeting ────────────────────────────────────────────────────────────
// Title vocabulary, bucketed by sales priority. First match wins, so the highest-value
// buckets are listed first. Deliberately broad — capture anyone with a real title; you
// never know which rung gets you to the decision-maker.
const TITLE_BUCKETS = [
  // A-list: the people who can claim/buy
  ['Exec', /\b(chief\s+\w+\s+officer|chief\s+\w+|c[eofact]o|cxo|cmo|cno|president|vice\s+president|vp\b|executive\s+director|exec\.?\s+director|founder|co-?founder|owner|principal|proprietor|administrator|administrative\s+director|managing\s+director|partner|board\s+president)\b/i],
  // A-list: the people who feed referrals / buy visibility
  ['BDM', /\b(admissions|admission|business\s+development|bus\.?\s+dev|biz\s+dev|community\s+(outreach|relations|liaison|engagement)|outreach|liaison|marketing|brand|growth|alumni|intake|referral|account\s+(executive|manager)|sales|public\s+relations|communications)\b/i],
  // Clinical leadership — often the real influencer
  ['Clinical', /\b(clinical\s+director|medical\s+director|program\s+director|director\s+of\s+(nursing|clinical|operations|quality|utilization)|chief\s+of|psychiatrist|medical\s+officer|director\s+of\s+nursing)\b/i],
  // Governance
  ['Board', /\b(board\s+(member|of\s+directors|chair|director)|chair(man|woman|person)?|vice\s+chair|treasurer|secretary|trustee)\b/i],
  // Everyone else with an actual job title — your "start anywhere" tier
  ['Staff', /\b(director|manager|coordinator|supervisor|officer|lead|head\s+of|specialist|counsel(or|ing)|therapist|clinician|social\s+worker|case\s+manager|nurse|rn\b|lpn\b|lcsw|lpc|lmft|cadc|psychologist|psychiatric|technician|tech\b|assistant|associate|advocate|peer\s+(support|specialist)|recovery\s+coach|navigator|receptionist|front\s+desk|office\s+manager|billing|housing|residential|behavioral|wellness|prevention|educator|chaplain|dietitian|practitioner|np\b|pa-?c)\b/i],
];
function classifyTitle(t) {
  for (const [bucket, re] of TITLE_BUCKETS) if (re.test(t)) return bucket;
  return null;
}
const PRIORITY = { Exec: 'A', BDM: 'A', Clinical: 'B', Board: 'C', Staff: 'C', Other: 'C' };
// A line that reads like a person's name (allows Dr./Judge/Captain prefixes + trailing credentials).
const NAME_RE = /^((?:Dr|Mr|Mrs|Ms|Judge|Capt|Captain|Rev|Hon|Sgt|Lt)\.?\s+)?[A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+){1,3}$/;
// Words that disqualify a line from being a person's NAME — includes org words AND
// title words, so a title line ("Chief Executive Officer", "Vice Chair") is never
// mistaken for a name and used to skip the real person above it.
const NAME_STOP = /\b(services?|county|department|center|centre|program|health|board|team|our|the|welcome|contact|home|menu|locations?|careers?|clinic|hospital|inc|llc|chief|president|vice|chair|treasurer|secretary|trustee|director|manager|officer|coordinator|supervisor|counsel(or)?|therapist|specialist|admissions|outreach|founder|owner|administrator)\b/i;
function cleanName(line) {
  const base = line.split(',')[0].trim(); // drop trailing credentials: "Jane Doe, LCSW" -> "Jane Doe"
  if (!base || base.split(/\s+/).length > 5) return null;
  if (NAME_STOP.test(base) || !NAME_RE.test(base)) return null;
  return base;
}

const g = (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q.replace(/\s+/g, ' ').trim());
// Reduce a facility name to loose org keywords (drop branch suffixes, DBA, legal suffixes)
// so it matches as keywords, not an exact phrase.
function facilityKeywords(name) {
  return (name || '')
    .replace(/\s*[-–—]\s*d\.?b\.?a\.?\b.*$/i, '') // "- DBA Foo"
    .replace(/\s*[-–—]\s.*$/, '') // branch/location after a dash
    .replace(/\b(inc|llc|l\.l\.c|lp|pllc|p\.?c|ltd|co|corp)\b\.?/gi, '')
    .replace(/[",]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
// CRITICAL: quote ONLY the person's name. Quoting the org/title/city makes the dork
// demand a verbatim match that LinkedIn headlines almost never have → zero results.
const companyLink = (f) => g(`site:linkedin.com/company ${facilityKeywords(f.name)} ${f.state}`);
const roleLink = (f, role) => g(`site:linkedin.com/in "${role}" ${facilityKeywords(f.name)} ${f.state}`);
const personLink = (f, name) => g(`site:linkedin.com/in "${name}" ${facilityKeywords(f.name)}`);
const personLinkBroad = (f, name) => g(`site:linkedin.com/in "${name}" ${f.city || ''} ${f.state}`);

// ── live LinkedIn URL resolution (pluggable search provider) ─────────────────────
const SERPER_KEY = process.env.SERPER_API_KEY;
const CSE_KEY = process.env.GOOGLE_CSE_KEY;
const CSE_CX = process.env.GOOGLE_CSE_CX;
const SEARCH_PROVIDER = SERPER_KEY ? 'serper' : CSE_KEY && CSE_CX ? 'google_cse' : 'duckduckgo';

async function searchLinks(q) {
  if (SEARCHES_LEFT <= 0) return [];
  SEARCHES_LEFT--;
  try {
    if (SEARCH_PROVIDER === 'serper') {
      const r = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, num: 10 }),
      });
      if (!r.ok) return [];
      const j = await r.json();
      return (j.organic || []).map((o) => o.link).filter(Boolean);
    }
    if (SEARCH_PROVIDER === 'google_cse') {
      const r = await fetch(`https://www.googleapis.com/customsearch/v1?key=${CSE_KEY}&cx=${CSE_CX}&q=${encodeURIComponent(q)}`);
      if (!r.ok) return [];
      const j = await r.json();
      return (j.items || []).map((i) => i.link).filter(Boolean);
    }
    // Keyless DuckDuckGo HTML — best effort; may rate-limit.
    const r = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out = [];
    let m;
    const re = /href="([^"]+)"/g;
    while ((m = re.exec(html))) {
      let u = m[1];
      const dd = u.match(/uddg=([^&]+)/);
      if (dd) u = decodeURIComponent(dd[1]);
      if (/^https?:\/\/([a-z]+\.)?linkedin\.com\//i.test(u)) out.push(u.split('?')[0]);
    }
    return out;
  } catch {
    return [];
  }
}

// Resolve one person to a live linkedin.com/in URL. Returns {url, conf}.
async function resolveLinkedIn(name, f) {
  const queries = [
    `site:linkedin.com/in "${name}" ${facilityKeywords(f.name)}`.replace(/\s+/g, ' ').trim(),
    `site:linkedin.com/in "${name}" ${f.city || ''} ${f.state}`.replace(/\s+/g, ' ').trim(),
  ];
  for (const q of queries) {
    const links = (await searchLinks(q)).filter((u) => /linkedin\.com\/in\//i.test(u));
    if (links.length) {
      const url = links[0].replace(/\/+$/, '');
      const slug = url.toLowerCase();
      const [first, ...rest] = name.toLowerCase().replace(/^(dr|mr|mrs|ms|judge|capt|captain|rev|hon|sgt|lt)\.?\s+/i, '').split(/\s+/);
      const last = rest.pop() || '';
      const conf = (last && slug.includes(last)) || (first && slug.includes(first)) ? 'high' : 'medium';
      return { url, conf };
    }
    if (SEARCHES_LEFT <= 0) break;
    await sleep(SEARCH_THROTTLE);
  }
  return { url: '', conf: '' };
}

// ── website enrichment (best-effort) ────────────────────────────────────────────
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JUNK = /\.(png|jpe?g|gif|svg|webp|css|js)$|sentry|wixpress|example\.|yourdomain|domain\.com|email\.com|@2x/i;

function normalize(site) {
  let s = (site || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    return new URL(s).origin;
  } catch {
    return null;
  }
}
async function fetchText(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'ClearBedRecovery-DirectoryBot/1.0 (+https://clearbedrecovery.com)' },
    });
    if (!res.ok) return '';
    return (await res.text()).slice(0, 600_000);
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}
function emails(html) {
  return [...new Set((html.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))].filter((e) => !JUNK.test(e));
}
// Break HTML into clean text lines, preserving block boundaries so a name and its
// title land on separate, adjacent lines (how staff/board pages are actually built).
function htmlToLines(html) {
  return html
    .replace(/<(script|style|nav|footer)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|td|tr|section|article|span)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&#0?38;|&amp;/g, '&')
    .replace(/&#8217;|&#8216;|&#039;|&rsquo;|&lsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// Extract (name, title, track) by pairing a name line with the next line as its title.
// On board pages, a name followed by a "<X> County"/location line = a general board member.
function extractPeople(html, isBoardPage) {
  const lines = htmlToLines(html);
  const out = [];
  const seen = new Set();
  for (let i = 0; i < lines.length - 1 && out.length < 60; i++) {
    const name = cleanName(lines[i]);
    if (!name) continue;
    const next = lines[i + 1];
    if (!next || next.split(/\s+/).length > 8) continue;
    if (cleanName(next)) continue; // next line is itself a name, not a title

    let title = null;
    let track = classifyTitle(next);
    if (track) {
      title = next.split(',')[0].trim(); // "Chair, Oglethorpe County" -> "Chair"
    } else if (isBoardPage && /\b(county|district|city|ward)\b/i.test(next)) {
      title = 'Board Member';
      track = 'Board';
    }
    if (!title || !track) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, title, track, detail: next });
  }
  return out;
}

// Find people-pages by following the site's own internal nav links (no slug guessing).
const PEOPLE_LINK = /(board|leadership|our-?team|meet|staff|about|who-we-are|management|executive|director|provider|clinician|people)/i;
function discoverPaths(homeHtml, origin) {
  const paths = new Set(['']); // home first
  const re = /href=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(homeHtml))) {
    try {
      const u = new URL(m[1], origin);
      if (u.origin === origin && PEOPLE_LINK.test(u.pathname) && u.pathname.length < 60) {
        paths.add(u.pathname);
      }
    } catch {
      /* skip bad hrefs */
    }
  }
  return [...paths].slice(0, 9);
}

// ── pull the funnel-exclusion sets (claimed / member facilities) ────────────────
async function excludedFacilityIds() {
  const ex = new Set();
  for (const [tbl, filter] of [
    ['facility_members', null],
    ['facility_claims', ['pending', 'approved']],
  ]) {
    try {
      let q = supabase.from(tbl).select('facility_id');
      if (filter) q = q.in('status', filter);
      const { data, error } = await q;
      if (error) {
        console.log(`  · note: couldn't read ${tbl} (${error.message}) — not excluding it`);
        continue;
      }
      for (const r of data || []) if (r.facility_id) ex.add(r.facility_id);
    } catch (e) {
      console.log(`  · note: ${tbl} skipped (${e.message})`);
    }
  }
  return ex;
}

// ── main ────────────────────────────────────────────────────────────────────────
console.log(`\n  🎯 ClearBed lead pull — ${TARGET_STATES.join(', ')}${ENRICH ? '  (+website enrich)' : ''}${RESOLVE ? `  (+linkedin resolve via ${SEARCH_PROVIDER}, budget ${SEARCHES_LEFT})` : ''}\n`);

const excluded = await excludedFacilityIds();
console.log(`  · ${excluded.size} facilities already in funnel (member/claim) — excluded\n`);

const { data, error } = await supabase
  .from('facilities')
  .select('id, name, city, state, website, main_phone, plan, referral_contact')
  .eq('is_published', true)
  .in('state', TARGET_STATES)
  .or('plan.is.null,plan.eq.free')
  .order('state')
  .order('name')
  .range(OFFSET, OFFSET + LIMIT - 1);
if (error) {
  console.error('  ✗ query failed:', error.message);
  process.exit(1);
}
const targets = (data ?? []).filter((f) => !excluded.has(f.id));

// state breakdown
const byState = {};
for (const f of targets) byState[f.state] = (byState[f.state] || 0) + 1;
console.log('  Unclaimed free-plan targets by state:');
for (const s of TARGET_STATES) console.log(`    ${s}: ${byState[s] || 0}`);
console.log(`    ── total: ${targets.length}\n`);

const facRows = [];
const contactRows = [];
const siteCache = new Map(); // origin -> { people, emails } so a shared website is done once

for (const [i, f] of targets.entries()) {
  const tag = `${String(i + 1).padStart(4)}/${targets.length}  ${f.state}  ${f.name}`;
  let people = [];
  let uniqEmails = [];

  if (ENRICH) {
    const origin = normalize(f.website);
    if (!origin) {
      console.log(`  ?  ${tag}  — no website`);
    } else if (siteCache.has(origin)) {
      const c = siteCache.get(origin);
      people = c.people;
      uniqEmails = c.emails;
      console.log(`  ↺  ${tag}  — same site, cached (${people.length} ppl)`);
    } else {
      const harvested = [];
      const home = await fetchText(origin);
      harvested.push(...emails(home));
      // Follow the site's own nav links to people-pages; fall back to common slugs if thin.
      let paths = home ? discoverPaths(home, origin) : [];
      if (paths.length <= 1) {
        paths = ['', '/leadership', '/board', '/boardofdirectors', '/our-team', '/team', '/staff', '/about', '/about-us'];
      }
      for (const p of paths) {
        const html = p === '' ? home : await fetchText(origin + p);
        if (!html) continue;
        harvested.push(...emails(html));
        people.push(...extractPeople(html, /board/i.test(p)));
        if (p !== '') await sleep(Math.min(THROTTLE, 350));
      }
      people = people.filter((p, idx, a) => a.findIndex((x) => x.name === p.name) === idx);
      uniqEmails = [...new Set(harvested)];

      let resolved = 0;
      if (RESOLVE && SEARCHES_LEFT > 0) {
        const toResolve = RESOLVE_ALL ? people : people.filter((p) => PRIORITY[p.track] === 'A' || PRIORITY[p.track] === 'B');
        for (const p of toResolve) {
          if (SEARCHES_LEFT <= 0) break;
          const { url, conf } = await resolveLinkedIn(p.name, f);
          p.url = url;
          p.urlConf = conf;
          if (url) resolved++;
          await sleep(SEARCH_THROTTLE);
        }
      }

      siteCache.set(origin, { people, emails: uniqEmails });
      const byTrack = people.reduce((m, p) => ((m[p.track] = (m[p.track] || 0) + 1), m), {});
      const summary = Object.entries(byTrack).map(([k, v]) => `${v} ${k}`).join(', ') || '0';
      console.log(`  ${people.length || uniqEmails.length ? '✓' : '–'} ${tag}  — ${summary}; ${uniqEmails.length} email${RESOLVE ? `; ${resolved} li-url (${SEARCHES_LEFT} q left)` : ''}`);
      await sleep(THROTTLE);
    }
  } else {
    console.log(`     ${tag}`);
  }

  const existingEmail = f.referral_contact?.email || '';

  facRows.push({
    facility: f.name,
    city: f.city || '',
    state: f.state,
    website: f.website || '',
    phone: f.main_phone || '',
    plan: f.plan || 'free',
    company_linkedin_search: companyLink(f),
    exec_search: roleLink(f, 'Executive Director'),
    ceo_owner_search: roleLink(f, 'Owner'),
    admissions_search: roleLink(f, 'Director of Admissions'),
    business_dev_search: roleLink(f, 'Business Development'),
    outreach_search: roleLink(f, 'Community Outreach'),
    harvested_emails: uniqEmails.join('; '),
    known_email: existingEmail,
    candidate_count: people.length,
  });

  for (const p of people) {
    contactRows.push({
      priority: PRIORITY[p.track] || 'C',
      track: p.track,
      facility: f.name,
      city: f.city || '',
      state: f.state,
      candidate_name: p.name,
      candidate_title: p.title,
      linkedin_url: p.url || '', // live profile URL (when --resolve found one)
      linkedin_confidence: p.urlConf || '',
      linkedin_search: personLink(f, p.name), // "Name" + loose org keywords
      linkedin_search_broad: personLinkBroad(f, p.name), // "Name" + city/state fallback
      page_detail: p.detail || '',
      website: f.website || '',
      review: 'needs_review',
    });
  }
}

// Dedup people across facility rows that share a website (multi-location orgs).
// Key on bare host so www/non-www/path variants of the same org collapse together.
const hostKey = (url) => (url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
const seenContact = new Set();
const contactsOut = contactRows.filter((c) => {
  const k = `${c.candidate_name.toLowerCase()}|${hostKey(c.website)}`;
  if (seenContact.has(k)) return false;
  seenContact.add(k);
  return true;
});

// ── write xlsx to ~/Downloads ───────────────────────────────────────────────────
const d = new Date();
const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const stateTag = STATES.length ? STATES.join('-') : 'SE';
const outPath = path.join(homedir(), 'Downloads', `clearbed-leads-${stateTag}-${stamp}.xlsx`);

// json_to_sheet writes URLs as plain text — turn any http(s) cell into a real
// clickable Excel hyperlink so the search/profile links actually work.
function sheetWithLinks(rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (!ws['!ref']) return ws;
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && typeof cell.v === 'string' && /^https?:\/\//.test(cell.v)) {
        cell.l = { Target: cell.v, Tooltip: 'Open' };
      }
    }
  }
  return ws;
}

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheetWithLinks(facRows), 'Facilities');
XLSX.utils.book_append_sheet(
  wb,
  sheetWithLinks(contactsOut.length ? contactsOut : [{ note: 'run with --enrich to extract candidate contacts' }]),
  'Contacts'
);
XLSX.writeFile(wb, outPath);

console.log(`\n  ✅ Wrote ${facRows.length} facilities + ${contactsOut.length} candidate contacts`);
console.log(`     → ${outPath}\n`);
if (!ENRICH) console.log('  Tip: add --enrich to also pull names/titles/emails from facility websites.\n');
