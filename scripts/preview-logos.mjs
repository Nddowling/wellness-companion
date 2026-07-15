// Render the carrier logos in real tile geometry and screenshot, so we can SEE how the
// carousel actually looks (same box + max-h/max-w constraints as LogoCarousel's Tile).
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';

const DIR = 'public/images/insurance';
const files = readdirSync(DIR).filter((f) => /\.(svg|png)$/i.test(f)).sort();
const dataUri = (f) => {
  const buf = readFileSync(`${DIR}/${f}`);
  const mime = f.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
};
const tiles = files
  .map((f) => `<div class="wrap"><div class="tile"><img src="${dataUri(f)}" alt="${f}"/></div><div class="cap">${f}</div></div>`)
  .join('');

const html = `<!doctype html><html><head><style>
  body{margin:0;padding:24px;background:#fff;font-family:system-ui,sans-serif}
  h1{font-size:22px;color:#1e293b;margin:0 0 18px}
  .row{display:flex;flex-wrap:wrap;gap:16px}
  .wrap{display:flex;flex-direction:column;align-items:center;gap:6px}
  .tile{display:flex;align-items:center;justify-content:center;height:112px;width:176px;
        border-radius:16px;background:#f8fafc;box-shadow:inset 0 0 0 1px rgba(203,213,225,.7)}
  .tile img{max-height:56px;max-width:88%;object-fit:contain}
  .cap{font-size:10px;color:#94a3b8}
</style></head><body><h1>Centers by Accepted Insurance — tile preview</h1>
<div class="row">${tiles}</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 700 } });
await page.setContent(html);
await page.waitForTimeout(500);
await page.screenshot({ path: 'logo-preview.png', fullPage: true });
await browser.close();
console.log('wrote logo-preview.png');
