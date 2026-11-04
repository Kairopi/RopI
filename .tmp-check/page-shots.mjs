// Screenshot every page at desktop (1440) and mobile (390) for visual QA
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = 'http://localhost:5173';
const OUT = path.resolve('.tmp-check/pages');
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`${page.url()} pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`${page.url()} console: ${m.text().slice(0, 200)}`));

await page.goto(BASE + '/login');
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, 'd-login.png') });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: path.join(OUT, 'm-login.png'), fullPage: true });
await page.setViewportSize({ width: 1440, height: 900 });
await page.getByLabel(/call you/).fill('Demo');
await page.getByRole('button', { name: 'Start' }).click();
await page.waitForURL('**/setup', { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'd-setup.png') });
await page.getByRole('button', { name: /Continue|Skip/ }).click();
await page.getByRole('button', { name: /Weeknights/ }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, 'd-setup-free.png') });
await page.getByRole('button', { name: 'Back' }).click();
await page.getByText('Load a sample week').click();
await page.waitForURL('**/dashboard', { timeout: 15000 });

const pages = [
  ['dashboard', '/dashboard'],
  ['lifeshift', '/schedule'],
  ['learning', '/learning'],
  ['quiz', '/quiz/quiz-1'],
  ['reviews', '/reviews'],
  ['voice', '/voice-quiz'],
  ['hub', '/learning-hub'],
  ['jobs', '/jobs'],
  ['kanban', '/jobs/kanban'],
  ['tasks', '/tasks'],
  ['activity', '/activity'],
];
const only = process.argv[2]?.split(',');
for (const [name, url] of pages) {
  if (only && !only.includes(name)) continue;
  for (const [tag, w, h] of [['d', 1440, 900], ['m', 390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(BASE + url);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`), fullPage: true });
    // Horizontal overflow check on mobile
    if (tag === 'm') {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) errors.push(`${url} mobile horizontal overflow: ${overflow}px`);
    }
  }
}

// Font check: are the brand fonts actually used?
const fonts = await page.evaluate(async () => {
  await document.fonts.ready;
  const h1 = document.querySelector('h1');
  return {
    h1: h1 ? getComputedStyle(h1).fontFamily : null,
    body: getComputedStyle(document.body).fontFamily,
    loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
  };
});
console.log('Fonts:', JSON.stringify(fonts));

await browser.close();
console.log('Errors:', errors.length ? '\n  ' + [...new Set(errors)].join('\n  ') : 'none');
