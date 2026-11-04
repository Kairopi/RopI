// Visual check of the signature "week shifts" moment, with mid-animation frames
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = 'http://localhost:5173';
const OUT = path.resolve('.tmp-check/design');
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text().slice(0, 200)));

await page.goto(BASE + '/login');
await page.screenshot({ path: path.join(OUT, '01-login.png') });
await page.getByRole('button', { name: 'Start' }).click();
await page.waitForURL('**/dashboard');
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, '02-dashboard.png'), fullPage: true });

await page.goto(BASE + '/schedule');
await page.getByText('Your next 7 days').waitFor();
await page.waitForTimeout(1200);
const canvas = page.locator('main .grid').first();
await page.screenshot({ path: path.join(OUT, '03-week-before.png'), fullPage: true });

// Record where each block sits before the change
const positions = () =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('main button[title*="·"]')].map((b) => {
        const r = b.getBoundingClientRect();
        return [b.getAttribute('title').split(' · ')[0], { x: Math.round(r.x), y: Math.round(r.y) }];
      })
    )
  );
const before = await positions();

await page.getByRole('button', { name: /only 20min tonight/ }).click();
await page.getByRole('button', { name: 'Replan my week' }).waitFor({ timeout: 20000 });
await page.getByRole('button', { name: 'Replan my week' }).click();

// Frames during the motion
const frames = [];
for (const ms of [300, 420, 560, 760, 1100, 1800]) {
  await page.waitForTimeout(ms - (frames.at(-1) ?? 0));
  frames.push(ms);
  await page.screenshot({ path: path.join(OUT, `04-shift-${String(ms).padStart(4, '0')}ms.png`), clip: { x: 220, y: 120, width: 1220, height: 760 } });
}
const mid = await positions();
await page.waitForTimeout(2500);
const after = await positions();
await page.screenshot({ path: path.join(OUT, '05-week-after.png'), fullPage: true });

console.log('Block positions (x,y): before -> after');
for (const name of Object.keys(after)) {
  const b = before[name], a = after[name];
  if (b && (b.x !== a.x || b.y !== a.y)) console.log(`  MOVED  ${name}: (${b.x},${b.y}) -> (${a.x},${a.y})`);
}
const inFlight = Object.keys(after).filter((n) => mid[n] && (mid[n].x !== after[n].x || mid[n].y !== after[n].y));
console.log(`Blocks still travelling at the 1.8s frame: ${inFlight.length}`);

// Results page bars
await page.goto(BASE + '/quiz/quiz-1');
for (let i = 0; i < 6; i++) {
  await page.waitForFunction((n) => document.querySelector('main p.text-sm')?.textContent?.startsWith(`Question ${n}`), i + 1);
  await page.waitForFunction(() => document.querySelectorAll('main h2').length === 1);
  await page.locator('main button').filter({ has: page.locator('span.text-sm') }).nth(i < 2 ? [2, 1][i] : 0).click();
  if (i < 5) await page.getByRole('button', { name: /^Next/ }).click();
}
await page.getByRole('button', { name: /Submit Quiz/ }).click();
await page.getByText('What this quiz showed').waitFor({ timeout: 20000 });
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(OUT, '06-results.png'), clip: { x: 220, y: 0, width: 1220, height: 1000 } });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/schedule');
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, '07-mobile-schedule.png'), fullPage: true });

await browser.close();
console.log('Errors:', errors.length ? errors : 'none');
