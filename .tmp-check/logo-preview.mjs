// Render the vector logo candidates to PNG for visual comparison with the supplied artwork
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outfit = fs.readFileSync('node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2').toString('base64');
const mark = fs.readFileSync('src/components/brand/ropi-mark.svg', 'utf8');

const html = `<!doctype html><html><head><style>
@font-face { font-family: 'Outfit Variable'; src: url(data:font/woff2;base64,${outfit}) format('woff2'); font-weight: 100 900; }
body { margin: 0; background: #fff; font-family: 'Outfit Variable'; }
.row { display: flex; align-items: center; gap: 28px; padding: 40px 56px; }
.row svg { height: 210px; width: auto; color: #1F45F5; }
.word { font-weight: 700; font-size: 168px; letter-spacing: -0.035em; color: #1F45F5; line-height: 1; }
.dark { background: #0E1015; }
.dark svg, .dark .word { color: #fff; }
.small { gap: 8px; padding: 16px 24px; }
.small svg { height: 22px; } .small .word { font-size: 19px; }
</style></head><body>
<div class="row">${mark}<span class="word">Ropi</span></div>
<div class="row dark small">${mark}<span class="word">Ropi</span></div>
<div class="row small">${mark}<span class="word">Ropi</span></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 460 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: path.resolve('.tmp-check/design/logo-preview.png') });
await browser.close();
console.log('rendered');
