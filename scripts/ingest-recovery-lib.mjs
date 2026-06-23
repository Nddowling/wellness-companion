#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Recovery Library ingest → Obsidian brain   (with live progress bar + logging)
//
//   node scripts/ingest-recovery-lib.mjs           # extract + write notes
//   node scripts/ingest-recovery-lib.mjs --dry     # plan only (categorize, no write)
//
// Reads PDFs from WeTalk-Lib, extracts text with pdftotext (poppler), and writes
// categorized, searchable reference notes into the vault. Idempotent — safe to re-run
// (e.g. after dropping new PDFs into the source folder). Scanned PDFs with no text
// layer are flagged needs_ocr rather than skipped.
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const OCR_ON = process.argv.includes('--ocr'); // convert scanned PDFs (slow: pdftoppm→tesseract)
const SRC = '/Users/nicholasdowling/Downloads/WeTalk-Lib';
const VAULT = '/Users/nicholasdowling/Documents/Alpha/Content Intelligence/Recovery Library';

const DENY = [/^24-Sales/i, /^How-to-/i, /Negotiation/i, /Cold-?Emails/i, /Following-?Up/i, /Streamline/i, /ID Front/i];

const CATEGORIES = {
  addiction: 'Addiction & Recovery',
  trauma: 'Trauma, PTSD & Military',
  grief: 'Grief & Loss',
  family: 'Family, Couples & Group',
  clinical: 'Clinical & Therapy',
  faith: 'Faith-Based Healing',
};
const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function categorize(title) {
  const t = title.toLowerCase();
  if (/alcoholics|relapse|breathing under water|twelve steps|\baddiction\b/.test(t)) return 'addiction';
  if (/ptsd|post-traumatic|military|veteran|fire ?fighter|warrior|bulletproof|first responder/.test(t)) return 'trauma';
  if (/grief|grace disguised|good grief|\blament\b|forgiveness/.test(t)) return 'grief';
  if (/family|couple|marriage|love and respect|keep your love|\bgroup\b|groups|gottman|emotionally focused|seven principles/.test(t)) return 'family';
  if (/dialectical|\bdbt\b|cognitive|mind over mood|mindfulness|motivational interviewing|solution-focused|interviewing for solutions|psychodynamic|object relations|\bdsm\b|diagnostic and statistical|crisis intervention|psychological first aid|online counseling|play therapy|psychotherapy|group dynamics/.test(t)) return 'clinical';
  return 'faith';
}

function parseName(file) {
  const base = file.replace(/\.pdf$/i, '');
  const parts = base.split(' -- ');
  let title = (parts[0] || base).replace(/_/g, ':').replace(/\s+/g, ' ').trim();
  let author = (parts[1] || '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  if (!parts[1]) { title = base.replace(/-/g, ' ').trim(); author = ''; }
  return { title, author };
}
const safeFile = (s) => s.replace(/[\\/?*[\]:"<>|#^]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90).trim();

// ── progress bar ──────────────────────────────────────────────────────────────
const BARW = 32;
const C = { dim: '\x1b[2m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', rst: '\x1b[0m', clr: '\x1b[K' };
function drawBar(done, total, label) {
  const pct = total ? done / total : 0;
  const filled = Math.round(pct * BARW);
  const bar = '█'.repeat(filled) + '░'.repeat(BARW - filled);
  process.stdout.write(`\r${C.clr}  [${C.cyn}${bar}${C.rst}] ${done}/${total} ${String(Math.round(pct * 100)).padStart(3)}%  ${C.dim}${label.slice(0, 38)}${C.rst}`);
}
const logLine = (s) => { process.stdout.write(`\r${C.clr}${s}\n`); };
const cleanText = (t) => (t || '').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();

// OCR a scanned PDF: rasterize pages (pdftoppm) → read each (tesseract). Slow but uses
// only tools already installed. onPage(p, total) reports per-page progress.
function ocrPdf(pdfPath, onPage) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'reclib-ocr-'));
  try {
    execFileSync('pdftoppm', ['-png', '-r', '150', pdfPath, path.join(tmp, 'pg')],
      { stdio: ['ignore', 'ignore', 'ignore'], timeout: 1800000 });
    const pages = readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
    let out = '';
    pages.forEach((pg, i) => {
      onPage(i + 1, pages.length);
      const base = path.join(tmp, pg.replace(/\.png$/, ''));
      try {
        execFileSync('tesseract', [path.join(tmp, pg), base, '--psm', '1'],
          { stdio: ['ignore', 'ignore', 'ignore'], timeout: 120000 });
        out += readFileSync(`${base}.txt`, 'utf8') + '\n';
      } catch { /* skip unreadable page */ }
    });
    return out;
  } catch { return ''; }
  finally { try { rmSync(tmp, { recursive: true, force: true }); } catch {} }
}

// ── go ────────────────────────────────────────────────────────────────────────
const files = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.pdf') && !DENY.some((re) => re.test(f)));
const items = files.map((f) => { const { title, author } = parseName(f); return { file: f, title, author, cat: categorize(title) }; });
const byCat = {};
for (const it of items) (byCat[it.cat] ||= []).push(it);

console.log(`\n════════════════════════════════════════════════════════════════`);
console.log(`  📚 Recovery Library ingest  →  the brain`);
console.log(`  ${items.length} PDFs · ${Object.keys(byCat).length} categories${DRY ? '   (DRY RUN)' : ''}${OCR_ON ? `   ${C.ylw}(OCR ON — scanned books converted, slow)${C.rst}` : ''}`);
console.log(`════════════════════════════════════════════════════════════════`);
for (const [c, list] of Object.entries(byCat)) console.log(`  ${C.dim}•${C.rst} ${CATEGORIES[c].padEnd(26)} ${list.length}`);
console.log('');
if (DRY) { console.log('  (dry run — no files written)\n'); process.exit(0); }

const t0 = Date.now();
let done = 0, written = 0, scanned = 0;
for (const [cat, list] of Object.entries(byCat)) {
  const dir = path.join(VAULT, CATEGORIES[cat]);
  mkdirSync(dir, { recursive: true });
  list.sort((a, b) => a.title.localeCompare(b.title));
  list.forEach((it, i) => {
    drawBar(done, items.length, it.title);
    let text = '';
    try {
      text = execFileSync('pdftotext', ['-enc', 'UTF-8', '-nopgbrk', path.join(SRC, it.file), '-'],
        { maxBuffer: 1024 * 1024 * 512, timeout: 180000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch { text = ''; }
    text = text.replace(/ /g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
    // OCR fallback for scanned PDFs (no text layer), only when --ocr is passed.
    if (text.length < 2000 && OCR_ON) {
      const ocrText = cleanText(ocrPdf(path.join(SRC, it.file),
        (p, tot) => drawBar(done, items.length, `OCR ${it.title.slice(0, 20)} pg ${p}/${tot}`)));
      if (ocrText.length > text.length) text = ocrText;
    }
    const wc = text.split(/\s+/).filter(Boolean).length;
    const isScanned = text.length < 2000;
    if (isScanned) scanned++;

    const num = String(i + 1).padStart(2, '0');
    const body = [
      '---', 'type: reference', `category: ${CATEGORIES[cat]}`, 'source: WeTalk-Lib',
      `title: "${it.title.replace(/"/g, "'")}"`, `author: "${it.author.replace(/"/g, "'")}"`,
      `word_count: ${wc}`, isScanned ? 'needs_ocr: true' : null,
      `tags: [recovery-brain, reference, recovery-library, category/${slug(CATEGORIES[cat])}]`,
      '---', '', `# ${it.title}`,
      `**${it.author || 'Unknown author'}** · ${CATEGORIES[cat]} · part of [[Recovery Library]]`, '',
      isScanned ? '> ⚠️ No text layer (scanned PDF). Needs OCR for full text; title/author indexed.' : text, '',
    ].filter((l) => l !== null).join('\n');
    writeFileSync(path.join(dir, `${num} - ${safeFile(it.title)}.md`), body);
    written++; done++;

    const icon = isScanned ? `${C.ylw}⚠ OCR${C.rst}` : `${C.grn}✓${C.rst}`;
    logLine(`  ${icon}  ${C.dim}${CATEGORIES[cat].slice(0, 20).padEnd(20)}${C.rst} ${it.title.slice(0, 44).padEnd(44)} ${isScanned ? '' : `${(wc / 1000).toFixed(0)}k words`}`);
    drawBar(done, items.length, list[i + 1]?.title || 'done');
  });
}

// index note
const idx = [
  '---', 'type: index', 'tags: [recovery-brain, recovery-library, index]', '---', '',
  '# 📚 Recovery Library',
  'Clinical, recovery, counseling, trauma/veteran, grief, and faith-based references for the',
  'brain. Clear Bed Recovery carries a Christian-faith underpinning — connection to care,',
  'through Christ. Research references only; original AI-synthesized content is our own IP.',
  '',
  '## Counts by category',
  '```dataview', 'TABLE length(rows) AS books, sum(rows.word_count) AS words',
  'FROM #recovery-library', 'WHERE type = "reference"', 'GROUP BY category', 'SORT length(rows) DESC', '```', '',
  '## All references',
  '```dataview', 'TABLE author, category, word_count', 'FROM #recovery-library',
  'WHERE type = "reference"', 'SORT category ASC, title ASC', '```', '',
].join('\n');
writeFileSync(path.join(VAULT, 'Recovery Library.md'), idx);

drawBar(items.length, items.length, 'complete');
console.log(`\n\n════════════════════════════════════════════════════════════════`);
console.log(`  ${C.grn}✓ DONE${C.rst}  ${written} notes written · ${scanned} still need OCR · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (scanned > 0 && !OCR_ON) console.log(`  ${C.ylw}↻ ${scanned} scanned book(s) skipped — re-run with --ocr to convert them.${C.rst}`);
console.log(`  → Content Intelligence/Recovery Library/  (open [[Recovery Library]])`);
console.log(`════════════════════════════════════════════════════════════════\n`);
