#!/usr/bin/env node
// Mine social-video HOOKS from the "Lead Generator" Supabase dataset.
//
// The spoken hook of a short-form video is its opening line. ~79.6k videos have a
// transcript but no parsed hook_sentence, so we widen the pool by extracting +
// cleaning the first line of every transcript, scoring each by REAL performance
// (engagement rate × reach — not the junk AI hook_score), deduping, and writing a
// ranked CSV/JSON you can then adapt for Clear Bed.
//
// ── Run it (watch it mine) ───────────────────────────────────────────────────
//   export LEADGEN_SERVICE_ROLE_KEY=<service_role key from Supabase dashboard>
//   # Supabase → project "Lead Generator" → Settings → API → service_role (secret)
//   node scripts/mine-hooks.mjs
//
// Options (flags or env):
//   --floor   <int>   min views to consider           (default 50000, env MIN_VIEWS)
//   --min-eng <num>   min engagement %% to keep        (default 0,     env MIN_ENG_PCT)
//   --top     <int>   size of the "best of" shortlist  (default 1500,  env TOP_N)
//   --out     <dir>   output directory                 (default docs/marketing)
//
// Output: <out>/mined-hooks.csv (full ranked pool), mined-hooks.top.csv (shortlist),
//         mined-hooks.json. Re-run anytime; it overwrites.

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

// ── config ───────────────────────────────────────────────────────────────────
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const URL = process.env.LEADGEN_SUPABASE_URL || 'https://xjltsyviygqisleutgua.supabase.co';
const KEY = process.env.LEADGEN_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const FLOOR = Number(arg('floor', process.env.MIN_VIEWS || 50000));
const MIN_ENG = Number(arg('min-eng', process.env.MIN_ENG_PCT || 0));
const TOP_N = Number(arg('top', process.env.TOP_N || 1500));
const OUT = arg('out', 'docs/marketing');
const PAGE = 1000;

if (!KEY) {
  console.error(
    '\n  ✗ Missing service-role key.\n' +
      '    Supabase → "Lead Generator" → Settings → API → copy the service_role key, then:\n' +
      '    export LEADGEN_SERVICE_ROLE_KEY=<key>   &&   node scripts/mine-hooks.mjs\n'
  );
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// ── hook extraction ──────────────────────────────────────────────────────────
const PLACEHOLDER = /no hook|no clear hook|unable to determine|no transcript|n\/a/i;
const SOUND_CUE = /^[\[(](music|applause|laughter|chatter|silence|inaudible|cheering)/i;
const LEAD_FILLER = /^(um+|uh+|er+|so|ok(ay)?|like|well|yeah|alright|right|and|but|i mean|you know)[,\s]+/i;

// Pull the first natural sentence (or first ~16 words for unpunctuated captions),
// then clean it into a usable hook. Returns null if it isn't hook-worthy.
function extractHook(transcript, caption, title) {
  for (const raw of [transcript, caption, title]) {
    if (!raw || typeof raw !== 'string') continue;
    let s = raw.replace(/\s+/g, ' ').trim();
    if (!s || SOUND_CUE.test(s) || PLACEHOLDER.test(s)) continue;

    // first sentence: stop at . ? ! or newline; else first 16 words
    const m = s.match(/^.*?[.?!](\s|$)/);
    let hook = (m ? m[0] : s.split(' ').slice(0, 16).join(' ')).trim();

    // strip a leading filler word, surrounding quotes, trailing ellipsis
    let prev;
    do {
      prev = hook;
      hook = hook.replace(LEAD_FILLER, '').trim();
    } while (hook !== prev);
    hook = hook.replace(/^["'“”]+|["'“”]+$/g, '').replace(/[.…\s]+$/, '').trim();

    const words = hook.split(' ').filter(Boolean);
    const ok =
      hook.length >= 10 &&
      hook.length <= 160 &&
      words.length >= 3 &&
      /[a-z]/i.test(hook) &&
      !PLACEHOLDER.test(hook);
    if (ok) return hook.endsWith('?') ? hook : hook; // keep '?' (questions perform)
  }
  return null;
}

const norm = (h) => h.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const engPct = (v, r) => (v > 0 ? (r / v) * 100 : 0);

// ── mine ─────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const best = new Map(); // normalized hook -> record (keep highest score)
let processed = 0;
let kept = 0;

const { count } = await supabase
  .from('videos')
  .select('*', { count: 'exact', head: true })
  .not('transcript', 'is', null)
  .gte('views', FLOOR);
const total = count || null; // null = unknown; draw() then shows a live count without a %.

console.log(
  `\n  Mining hooks from videos with views ≥ ${FLOOR.toLocaleString()}` +
    (total ? ` (${total.toLocaleString()} candidates)\n` : ` (counting as we go)\n`)
);

const draw = () => {
  const rate = Math.round(processed / Math.max(1, (Date.now() - t0) / 1000));
  const head = total
    ? `${processed.toLocaleString()}/${total.toLocaleString()} (${Math.round((processed / total) * 100)}%)`
    : `${processed.toLocaleString()} scanned`;
  process.stdout.write(`\r  ⛏  ${head}  ·  ${kept.toLocaleString()} hooks kept  ·  ${rate}/s   `);
};

let from = 0;
for (;;) {
  const { data, error } = await supabase
    .from('videos')
    .select('platform, video_url, creator_handle, creator_followers, transcript, caption, title, views, likes, comments, shares, saves')
    .not('transcript', 'is', null)
    .gte('views', FLOOR)
    .order('views', { ascending: false })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error('\n  ✗ query failed:', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;

  for (const v of data) {
    processed++;
    const hook = extractHook(v.transcript, v.caption, v.title);
    if (!hook) continue;
    const reactions = (v.likes || 0) + (v.comments || 0) + (v.shares || 0) + (v.saves || 0);
    const eng = engPct(v.views || 0, reactions);
    if (eng < MIN_ENG) continue;
    // score rewards both resonance (engagement) and reach (log views)
    const score = +(eng * Math.log10(Math.max(v.views || 0, 10))).toFixed(2);
    const k = norm(hook);
    const existing = best.get(k);
    if (!existing || score > existing.score) {
      if (!existing) kept++;
      best.set(k, {
        hook,
        views: v.views || 0,
        likes: v.likes || 0,
        comments: v.comments || 0,
        shares: v.shares || 0,
        saves: v.saves || 0,
        eng_pct: +eng.toFixed(2),
        score,
        platform: v.platform || '',
        creator: v.creator_handle || '',
        followers: v.creator_followers || 0,
        url: v.video_url || '',
      });
    }
  }
  draw();
  if (data.length < PAGE) break;
  from += PAGE;
}

// ── write output ─────────────────────────────────────────────────────────────
const rows = [...best.values()]
  .sort((a, b) => b.score - a.score)
  .map((r, i) => ({ rank: i + 1, ...r }));
mkdirSync(OUT, { recursive: true });

// Shared column order for CSV + Excel.
const COLS = ['rank', 'hook', 'views', 'likes', 'comments', 'shares', 'saves', 'eng_pct', 'score', 'platform', 'creator', 'followers', 'url'];
const csvCell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
const toCsv = (list) =>
  [COLS.join(',')].concat(list.map((r) => COLS.map((c) => csvCell(r[c])).join(','))).join('\n');

writeFileSync(path.join(OUT, 'mined-hooks.csv'), toCsv(rows));
writeFileSync(path.join(OUT, 'mined-hooks.top.csv'), toCsv(rows.slice(0, TOP_N)));
writeFileSync(path.join(OUT, 'mined-hooks.json'), JSON.stringify(rows, null, 2));

// Excel workbook: "Top N" sheet first (opens to the best), then "All hooks".
const widths = [6, 72, 12, 11, 11, 9, 8, 9, 8, 11, 24, 12, 44].map((wch) => ({ wch }));
const sheet = (list) => {
  const ws = XLSX.utils.json_to_sheet(list, { header: COLS });
  ws['!cols'] = widths;
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: list.length, c: COLS.length - 1 } }) };
  return ws;
};
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet(rows.slice(0, TOP_N)), `Top ${Math.min(TOP_N, rows.length)}`);
XLSX.utils.book_append_sheet(wb, sheet(rows), 'All hooks');
XLSX.writeFile(wb, path.join(OUT, 'mined-hooks.xlsx'));

draw();
console.log(`\n\n  ✓ Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`    ${rows.length.toLocaleString()} unique hooks`);
console.log(`    📊 Excel  →  ${path.join(OUT, 'mined-hooks.xlsx')}  (Top ${Math.min(TOP_N, rows.length)} + All hooks)`);
console.log(`       CSV    →  ${path.join(OUT, 'mined-hooks.csv')} · mined-hooks.top.csv\n`);
console.log('  Top 25 by score (engagement × reach):\n');
for (const [i, r] of rows.slice(0, 25).entries()) {
  console.log(
    `  ${String(i + 1).padStart(2)}. [${r.score}] ${r.eng_pct}% · ${r.views.toLocaleString()} views · ${r.platform}\n      ${r.hook}`
  );
}
console.log('');
