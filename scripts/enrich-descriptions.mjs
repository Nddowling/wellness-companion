// Grounded facility descriptions — the SEQ-2 enrichment.
//
// For each published facility that has a website but no description, fetch the real
// homepage, strip it to text, and have Claude draft 2–3 FACTUAL sentences grounded
// ONLY in that page. This is a YMYL health context: the model never invents clinical
// claims, payers, licensing, accreditation, or outcomes — if the page doesn't support
// a real description it returns INSUFFICIENT and we skip. Provenance (source_url,
// checked-at) is recorded so every description is auditable.
//
//   node scripts/enrich-descriptions.mjs --state GA --limit 5      # dry run, 5 facilities (~2¢)
//   node scripts/enrich-descriptions.mjs --state GA --write        # enrich all empty GA descriptions (~$1)
//   node scripts/enrich-descriptions.mjs --write                   # national (~$30, runs for hours)
//
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY (.env.local).

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const WRITE = args.includes('--write');
const STATE = flag('--state');
const LIMIT = flag('--limit') ? parseInt(flag('--limit'), 10) : null;
const CONCURRENCY = flag('--concurrency') ? parseInt(flag('--concurrency'), 10) : 4;
const MODEL = 'claude-haiku-4-5'; // cheap, correct tier for grounded summarization

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BANNED = /\b(best|leading|premier|world[- ]class|top[- ]rated|#1|number one|cutting[- ]edge|state[- ]of[- ]the[- ]art|guarantee|cure)\b/i;

async function fetchTargets() {
  // Filter to empty/null descriptions in the query itself (not client-side) so we don't
  // lose targets past the API's 1000-row default page.
  let q = sb
    .from('facilities')
    .select('id, name, city, state, website, description')
    .eq('is_published', true)
    .not('website', 'is', null)
    .or('description.is.null,description.eq.')
    .order('name');
  if (STATE) q = q.ilike('state', STATE);
  const { data, error } = await q;
  if (error) throw error;
  const targets = (data ?? []).filter(
    (f) => (f.website ?? '').trim() && !(f.description ?? '').trim()
  );
  return LIMIT ? targets.slice(0, LIMIT) : targets;
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}

async function crawl(url) {
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(u, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'ClearBedRecoveryBot/1.0 (+https://clearbedrecovery.com/about)' },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html') && !ct.includes('text')) return null;
    return htmlToText(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM = `You write factual, neutral descriptions of addiction and mental-health treatment facilities for a healthcare directory. You draft ONLY from the provided website text. This is a Your-Money-or-Your-Life health context — accuracy is critical and fabrication is unacceptable.

RULES:
- Use ONLY facts present in the provided text. NEVER invent or infer clinical claims, treatment outcomes, insurance/payer acceptance, licensing, accreditation, staff credentials, level-of-care specifics, or programs not explicitly stated on the page.
- 2–3 sentences, 40–70 words. Neutral and factual. No marketing hyperbole (no "best", "leading", "premier", "world-class", "state-of-the-art"), no superlatives, no promises or guarantees of recovery.
- Describe what the facility is and what it offers, strictly grounded in the text.
- If the text is insufficient — an error/parking/login page, or nothing about THIS facility — respond with exactly: INSUFFICIENT
- Write it as directory copy: do not mention the website, "according to their site", or that this is a description.`;

async function draft(f, pageText) {
  const user = `Facility: ${f.name} — ${f.city ?? ''}, ${f.state ?? ''}
Website text:
"""
${pageText}
"""
Write the description now (or INSUFFICIENT).`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 220,
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

// Returns { status, text? } — status in ok | insufficient | crawl_failed | rejected
async function enrichOne(f) {
  const text = await crawl(f.website);
  if (!text || text.length < 200) return { status: 'crawl_failed' };
  const out = await draft(f, text);
  if (!out || /INSUFFICIENT/i.test(out)) return { status: 'insufficient' };
  const words = out.split(/\s+/).length;
  if (words < 20 || words > 110 || BANNED.test(out)) return { status: 'rejected', text: out };
  return { status: 'ok', text: out };
}

async function persist(f, text) {
  const { error } = await sb
    .from('facilities')
    .update({
      description: text,
      source_url: /^https?:\/\//i.test(f.website) ? f.website : `https://${f.website}`,
      source_name: 'facility_website (AI-drafted, grounded, pending human audit)',
      source_last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(), // fires the ISR revalidate trigger
    })
    .eq('id', f.id);
  if (error) throw error;
}

async function pool(items, size, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
  const targets = await fetchTargets();
  console.log(
    `SEQ-2 enrich | ${STATE ?? 'ALL states'} | ${targets.length} facilities with a website + no description | ${WRITE ? 'WRITE' : 'DRY RUN'} | model ${MODEL}\n`
  );
  const tally = { ok: 0, insufficient: 0, crawl_failed: 0, rejected: 0 };
  let done = 0;

  await pool(targets, CONCURRENCY, async (f) => {
    let r;
    try {
      r = await enrichOne(f);
    } catch (e) {
      r = { status: 'crawl_failed', err: String(e.message ?? e) };
    }
    tally[r.status] = (tally[r.status] ?? 0) + 1;
    done++;
    if (r.status === 'ok') {
      if (WRITE) await persist(f, r.text);
      // Show a sample of drafts (all in dry-run; first 8 in write mode).
      if (!WRITE || tally.ok <= 8) {
        console.log(`✓ ${f.name} — ${f.city}, ${f.state}\n  ${r.text}\n  ↳ ${f.website}\n`);
      }
    } else if (r.status === 'rejected') {
      console.log(`✗ REJECTED (${f.name}): ${r.text}\n`);
    }
    if (done % 25 === 0) console.log(`  … ${done}/${targets.length}`);
  });

  console.log(
    `\nDone. ok=${tally.ok} insufficient=${tally.insufficient} crawl_failed=${tally.crawl_failed} rejected=${tally.rejected}` +
      (WRITE ? ` — ${tally.ok} descriptions written.` : ' — DRY RUN, nothing written.')
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
