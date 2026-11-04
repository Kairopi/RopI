// Browser check for the calendar: dates on every day, add busy time (Ropi plans around it),
// add a task by clicking empty time, open a block, remove busy time, collapse a panel
// (remembered after reload), mark done from the calendar and see it in History by date.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = 'http://localhost:5173';
const OUT = path.resolve('.tmp-check/shots');
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
let pass = 0;
let fail = 0;
const step = async (name, fn) => {
  const t = Date.now();
  try {
    await fn();
    pass++;
    console.log(`PASS  ${name} (${Date.now() - t}ms)`);
  } catch (e) {
    fail++;
    console.log(`FAIL  ${name}: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
    await page.screenshot({ path: path.join(OUT, `c-fail-${pass + fail}.png`) }).catch(() => undefined);
  }
};
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date();
const tomorrow = new Date(Date.now() + 86_400_000);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 200)}`));
const week = () => page.evaluate(() => JSON.parse(localStorage.getItem('ropi-week-v1')).state);
const weekPanel = () => page.locator('[data-panel="today-week"]');

await step('sign in + sample week', async () => {
  await page.goto(BASE + '/login');
  await page.getByLabel(/call you/).fill('Calendar test');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForURL('**/setup', { timeout: 15000 });
  await page.getByText('Load a sample week').click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
});

await step('every day shows its date', async () => {
  const label = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  await weekPanel().getByLabel(label).waitFor({ timeout: 10000 });
  const header = await weekPanel().getByLabel(label).innerText();
  if (!header.includes(String(today.getDate()))) throw new Error('no date number in header: ' + header);
  const range = await weekPanel().locator('h2 + span').first().innerText();
  if (!/[A-Z][a-z]{2} \d+ – /.test(range)) throw new Error('no date range: ' + range);
  console.log(`      header "${header.replace(/\s+/g, ' ')}", range "${range}"`);
});

await step('add busy time: Ropi moves what was there', async () => {
  const before = await page.locator(`[data-day="${ymd(tomorrow)}"] button[title*="7:00 PM -"]`).count();
  await weekPanel().getByRole('button', { name: 'Add', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Busy time' }).click();
  await dialog.getByLabel('What are you busy with?').fill('Shift at work');
  await dialog.getByLabel('Day').fill(ymd(tomorrow));
  await dialog.getByLabel('From').fill('19:00');
  await dialog.getByLabel('To').fill('20:00');
  await page.screenshot({ path: path.join(OUT, 'c1-add-busy.png') });
  await dialog.getByRole('button', { name: 'Block this time' }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.locator(`[data-day="${ymd(tomorrow)}"] button[title="Shift at work (busy)"]`).waitFor({ timeout: 5000 });
  const after = await page.locator(`[data-day="${ymd(tomorrow)}"] button[title*="7:00 PM -"]`).count();
  const s = await week();
  if (!s.events.some((e) => e.title === 'Shift at work')) throw new Error('event not saved');
  if (after !== 0) throw new Error(`a block still starts at 7:00 PM tomorrow (${after}, was ${before})`);
  console.log(`      blocks at 7:00 PM tomorrow: ${before} before, ${after} after`);
});

await step('click empty time to add a task for that day', async () => {
  const last = new Date(Date.now() + 6 * 86_400_000);
  const col = page.locator(`[data-day="${ymd(last)}"]`).first();
  const box = await col.boundingBox();
  // The day scrolls inside the calendar frame: click near the top of what's visible
  const frame = await weekPanel().locator('[data-calendar-scroll]').boundingBox();
  const y = frame.y + 20;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.waitForTimeout(150);
  await page.mouse.click(box.x + box.width / 2, y);
  const dialog = page.getByRole('dialog');
  const weekday = last.toLocaleDateString('en-US', { weekday: 'long' });
  await dialog.getByRole('heading', { name: `Add to ${weekday}` }).waitFor();
  await dialog.getByLabel('What do you need to do?').fill('Call mom');
  await dialog.getByRole('button', { name: '45m' }).click();
  await page.screenshot({ path: path.join(OUT, 'c2-add-todo.png') });
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  const t = (await week()).tasks.find((x) => x.title === 'Call mom');
  if (!t || t.duration !== 45 || !t.deadline || ymd(new Date(t.deadline)) !== ymd(last)) throw new Error('task wrong: ' + JSON.stringify(t));
  await page.locator('button[title^="Call mom ·"]').first().waitFor({ timeout: 5000 });
});

await step('click a block: when, why, start', async () => {
  await page.locator('button[title^="AWS Lambda quiz ·"]').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('heading', { name: 'AWS Lambda quiz' }).waitFor();
  await dialog.getByRole('button', { name: /Start/ }).waitFor();
  const text = (await dialog.innerText()).replace(/\s+/g, ' ');
  if (!/\d{1,2}:\d{2} [AP]M to \d{1,2}:\d{2} [AP]M/.test(text)) throw new Error('no time range: ' + text);
  console.log('      ' + text.slice(0, 140));
  await page.screenshot({ path: path.join(OUT, 'c3-block.png') });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
});

await step('remove busy time', async () => {
  await page.locator('button[title="Shift at work (busy)"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove busy time' }).click();
  await page.locator('button[title="Shift at work (busy)"]').waitFor({ state: 'detached' });
  if ((await week()).events.some((e) => e.title === 'Shift at work')) throw new Error('event still saved');
});

await step('collapse a section; it stays collapsed after reload', async () => {
  const toggle = weekPanel().getByRole('button', { name: /This week/ });
  await toggle.click();
  await page.waitForFunction(() => !document.querySelector('[data-panel="today-week"] [data-day]'));
  if ((await toggle.getAttribute('aria-expanded')) !== 'false') throw new Error('not collapsed');
  await page.reload();
  await weekPanel().getByText(/planned of/).first().waitFor();
  if ((await weekPanel().locator('[data-day]').count()) !== 0) throw new Error('re-opened after reload');
  await page.screenshot({ path: path.join(OUT, 'c4-collapsed.png') });
  await weekPanel().getByRole('button', { name: /This week/ }).click();
  await weekPanel().locator('[data-day]').first().waitFor();
});

await step('mark done from the calendar shows in History by date', async () => {
  await page.locator('button[title^="Call mom ·"]').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mark done' }).click();
  await page.waitForTimeout(1200); // receipt write
  await page.getByRole('button', { name: 'History' }).first().click();
  await page.waitForURL('**/history');
  const heading = `Today · ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
  await page.getByRole('heading', { name: heading }).waitFor({ timeout: 10000 });
  await page.getByText('Done: Call mom').waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(OUT, 'c5-history.png') });
});

await browser.close();
console.log(`\n${pass}/${pass + fail} calendar steps passed`);
console.log(`Browser errors (${errors.length}):`);
for (const e of [...new Set(errors)]) console.log('  ' + e);
if (fail) process.exitCode = 1;
