// Build an 8-tab Excel (one tab per creator, top 100 videos each) from a saved
// MCP execute_sql result file. Usage: node scripts/build-creator-tabs.mjs <result.txt>
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const SRC = process.argv[2];
if (!SRC) { console.error('pass the saved result file path'); process.exit(1); }

const wrapper = JSON.parse(readFileSync(SRC, 'utf8'));     // { result: "...text + array..." }
const text = wrapper.result;
const rows = JSON.parse(text.slice(text.indexOf('[{'), text.lastIndexOf('}]') + 2));

const byCreator = {};
for (const r of rows) (byCreator[r.creator_handle] ||= []).push(r);

const order = ['simonsquibb', 'valuetainment', 'alexhormozi', 'garyvee', 'grantcardone', 'officialandyelliott', 'jasoncapital', 'CodieSanchezCT'];
const safe = (s) => s.slice(0, 31).replace(/[\\/?*[\]:]/g, '');

const wb = XLSX.utils.book_new();
let total = 0;
for (const c of order) {
  const list = (byCreator[c] || []).sort((a, b) => (a.rn || 0) - (b.rn || 0))
    .map((r) => ({ '#': r.rn, Title: r.title, Views: r.views, 'Eng %': r.eng_pct, URL: r.video_url }));
  total += list.length;
  const ws = XLSX.utils.json_to_sheet(list, { header: ['#', 'Title', 'Views', 'Eng %', 'URL'] });
  ws['!cols'] = [{ wch: 5 }, { wch: 72 }, { wch: 12 }, { wch: 8 }, { wch: 46 }];
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: list.length, c: 4 } }) };
  XLSX.utils.book_append_sheet(wb, ws, safe(c));
}
const out = path.join(homedir(), 'Downloads', 'Top 100 Videos per Creator.xlsx');
XLSX.writeFile(wb, out);
console.log(`✓ ${total} rows across ${order.length} tabs → ${out}`);
