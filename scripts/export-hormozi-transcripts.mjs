#!/usr/bin/env node
// Export ALL Hormozi / Acquisition.com transcripts from the "Lead Generator"
// Supabase dataset into the Obsidian brain, matching the existing transcript-note
// format under `Content Intelligence/Transcripts/<creator>/`.
//
//   node scripts/export-hormozi-transcripts.mjs            # write the notes
//   node scripts/export-hormozi-transcripts.mjs --dry      # count only, write nothing
//
// Idempotent: each creator folder is rebuilt from scratch (old generated notes are
// moved to <folder>.bak-<ts> the first time, then overwritten on re-runs).

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, renameSync } from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');

const URL = 'https://xjltsyviygqisleutgua.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqbHRzeXZpeWdxaXNsZXV0Z3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MDYwMzEsImV4cCI6MjA4MDE4MjAzMX0._PkfhKD-GGS-vaWFZ5Ppv3WPcqH4jojG3Xb6IVugDyA';

const VAULT = '/Users/nicholasdowling/Documents/Alpha/Content Intelligence/Transcripts';

// raw handle -> normalized creator (folder name). Variants merge together.
const HANDLE_MAP = {
  alexhormozi: 'alexhormozi',
  AlexHormozi: 'alexhormozi',
  'Alex Hormozi': 'alexhormozi',
  leilahormozi: 'leilahormozi',
};
const HANDLES = Object.keys(HANDLE_MAP);

const supabase = createClient(URL, ANON, { auth: { persistSession: false } });

const slug = (s) =>
  (s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'business';

const safeFile = (s) =>
  (s || 'untitled').replace(/\s+/g, ' ').replace(/[\\/?*[\]:"<>|#^]/g, '').trim().slice(0, 80).trim() || 'untitled';

const yamlStr = (s) => `"${String(s ?? '').replace(/"/g, "'").replace(/\r?\n/g, ' ').trim()}"`;

const engPct = (v) => {
  const reach = Number(v.views || 0);
  if (!reach) return 0;
  const react = (v.likes || 0) + (v.comments || 0) + (v.shares || 0) + (v.saves || 0);
  return +((react / reach) * 100).toFixed(1);
};

// ── pull all rows for the target handles that have a real transcript ──────────
console.log(`\n  Pulling Hormozi/Acquisition transcripts from Lead Generator…\n`);
const PAGE = 500;
const all = [];
let lastId = '00000000-0000-0000-0000-000000000000';
for (;;) {
  const { data, error } = await supabase
    .from('videos')
    .select(
      'id, platform, platform_video_id, video_url, creator_handle, title, transcript, views, likes, comments, shares, saves, niche, topic, content_type, hook_type, posted_at, duration_seconds'
    )
    .in('creator_handle', HANDLES)
    .not('transcript', 'is', null)
    .order('id', { ascending: true })
    .gt('id', lastId)
    .limit(PAGE);
  if (error) {
    console.error('  ✗ query failed:', error.message);
    process.exit(1);
  }
  if (!data?.length) break;
  for (const v of data) if (v.transcript && v.transcript.trim().length > 50) all.push(v);
  lastId = data[data.length - 1].id;
  process.stdout.write(`\r  fetched ${all.length} usable rows…   `);
  if (data.length < PAGE) break;
}
console.log(`\n  total usable transcripts: ${all.length}\n`);

// ── dedupe (variants share videos) + group by normalized creator ─────────────
const seen = new Set();
const byCreator = {};
for (const v of all) {
  const key = v.platform_video_id || v.video_url;
  if (key && seen.has(key)) continue;
  if (key) seen.add(key);
  const creator = HANDLE_MAP[v.creator_handle] || slug(v.creator_handle);
  (byCreator[creator] ||= []).push(v);
}

let written = 0;
for (const [creator, rows] of Object.entries(byCreator)) {
  rows.sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));
  const width = Math.max(3, String(rows.length).length);
  const dir = path.join(VAULT, creator);

  console.log(`  ${creator}: ${rows.length} notes`);
  if (DRY) continue;

  // back up an existing folder once, then start clean
  if (existsSync(dir)) {
    const stamp = new Date(0).toISOString().slice(0, 10); // fixed stamp ok; rm if re-run
    const bak = `${dir}.bak`;
    if (!existsSync(bak)) renameSync(dir, bak);
    else rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });

  rows.forEach((v, i) => {
    const rank = i + 1;
    const num = String(rank).padStart(width, '0');
    const title = (v.title || 'Untitled').trim();
    const id = (v.platform_video_id || `${i}`).replace(/[\\/?*[\]:"<>|]/g, '');
    const file = path.join(dir, `${num} - ${safeFile(title)} (${id}).md`);
    const eng = engPct(v);
    const niche = v.niche || 'Business';
    const fm = [
      '---',
      'type: transcript',
      `creator: ${creator}`,
      `platform: ${v.platform || 'youtube'}`,
      `title: ${yamlStr(title)}`,
      `video_url: ${v.video_url || ''}`,
      `views: ${Number(v.views) || 0}`,
      `eng_pct: ${eng}`,
      v.posted_at ? `posted_at: ${v.posted_at}` : null,
      v.duration_seconds ? `duration_seconds: ${v.duration_seconds}` : null,
      `niche: ${yamlStr(niche)}`,
      `topic: ${yamlStr(v.topic || '')}`,
      `content_type: ${yamlStr(v.content_type || '')}`,
      `hook_type: ${yamlStr(v.hook_type || '')}`,
      `rank_in_creator: ${rank}`,
      `tags: [transcript, content-research, money-brain, creator/${creator}, niche/${slug(niche)}, platform/${v.platform || 'youtube'}]`,
      '---',
      '',
      `# ${title}`,
      `**${creator}** · ${(Number(v.views) || 0).toLocaleString()} views · ${eng}% eng · ${niche}`,
      `[watch](${v.video_url || ''}) · part of [[Transcript Library]]`,
      '',
      v.transcript.trim(),
      '',
    ]
      .filter((l) => l !== null)
      .join('\n');
    writeFileSync(file, fm);
    written++;
  });
}

console.log(`\n  ✓ ${DRY ? '(dry) would write' : 'wrote'} ${written} transcript notes to the brain.`);
console.log(`    ${Object.entries(byCreator).map(([c, r]) => `${c}: ${r.length}`).join(' · ')}\n`);
