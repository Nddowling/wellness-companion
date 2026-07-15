// Crop baked-in whitespace from carrier logo SVGs.
//
// Some sourced logos ship a padded canvas (e.g. a wordmark centered in a 200x200 square).
// Inside a fixed-height tile that padding scales with the image, so the actual mark renders
// tiny. This measures each SVG's true ink bounds in a real browser (getBBox) and rewrites
// the viewBox to fit, so every logo fills its tile consistently.
//
//   node scripts/crop-logo-svgs.mjs           # report only
//   node scripts/crop-logo-svgs.mjs --write   # rewrite padded viewBoxes
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const WRITE = process.argv.includes('--write');
const DIR = 'public/images/insurance';
const files = readdirSync(DIR).filter((f) => f.endsWith('.svg')).sort();

const browser = await chromium.launch();
const page = await browser.newPage();

for (const f of files) {
  const p = path.join(DIR, f);
  const svg = readFileSync(p, 'utf8');
  const res = await page.evaluate((markup) => {
    document.body.innerHTML = markup;
    const el = document.body.querySelector('svg');
    if (!el) return null;
    let b;
    try { b = el.getBBox(); } catch { return null; }
    return { vb: el.getAttribute('viewBox'), x: b.x, y: b.y, w: b.width, h: b.height };
  }, svg);
  if (!res || !res.w || !res.h) { console.log(`  skip  ${f}`); continue; }

  const cur = (res.vb || '').split(/[\s,]+/).filter(Boolean).map(Number);
  const curW = cur[2] || res.w, curH = cur[3] || res.h;
  const fill = Math.min(res.w / curW, res.h / curH);
  const padded = fill < 0.7;
  console.log(
    `  ${padded ? 'CROP' : 'ok  '}  ${f.padEnd(28)} canvas=${curW.toFixed(0)}x${curH.toFixed(0)}  ink=${res.w.toFixed(0)}x${res.h.toFixed(0)}  fill=${(fill * 100).toFixed(0)}%`
  );
  if (!padded || !WRITE) continue;

  const pad = Math.max(res.w, res.h) * 0.02;
  const nvb = `${(res.x - pad).toFixed(2)} ${(res.y - pad).toFixed(2)} ${(res.w + pad * 2).toFixed(2)} ${(res.h + pad * 2).toFixed(2)}`;
  let out = svg.replace(/viewBox="[^"]*"/, `viewBox="${nvb}"`);
  // Strip fixed width/height on the root <svg> so the viewBox governs scaling in the tile.
  out = out.replace(/<svg\b[^>]*>/i, (tag) => tag.replace(/\s(width|height)="[^"]*"/gi, ''));
  writeFileSync(p, out);
}
await browser.close();
