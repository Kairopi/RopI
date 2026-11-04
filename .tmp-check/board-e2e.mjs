// Board: six stages, "Move to" button, drag into Applied asks first and is recorded as self-reported
import { chromium } from 'playwright';
import path from 'node:path';

const BASE = 'http://localhost:5173';
const OUT = path.resolve('.tmp-check/shots');
const errors = [];
let pass = 0;
let fail = 0;
const step = async (name, fn) => {
  try {
    await fn();
    pass++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    fail++;
    console.log(`FAIL  ${name}: ${String(e.message).split('\n').slice(0, 6).join(' | ')}`);
    await page.screenshot({ path: path.join(OUT, `b-fail-${pass + fail}.png`) }).catch(() => undefined);
  }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 200)}`));
const col = (id) => page.locator(`[data-column="${id}"]`);

await page.goto(BASE + '/login');
await page.getByLabel(/call you/).fill('Board test');
await page.getByRole('button', { name: 'Start' }).click();
await page.waitForURL('**/setup', { timeout: 15000 });
await page.getByText('Load a sample week').click();
await page.waitForURL('**/dashboard', { timeout: 15000 });

await step('add two jobs on the board', async () => {
  await page.goto(BASE + '/jobs/kanban');
  await page.getByRole('heading', { name: 'Board' }).waitFor();
  for (const [title, company] of [['Product Manager', 'Monzo'], ['Product Owner', 'Wise']]) {
    await page.getByRole('button', { name: 'Add a job' }).first().click();
    await page.getByLabel(/Job Title/).fill(title);
    await page.getByLabel(/Company/).fill(company);
    await page.getByLabel(/Job Description/).fill(`${title} role at ${company}. Own the roadmap, run user research and work with engineering.`);
    await page.getByRole('button', { name: 'Add Job' }).click();
    await col('saved').getByText(company).waitFor({ timeout: 10000 });
  }
  const headers = await page.locator('[data-column] h2').allInnerTexts();
  if (headers.join('|') !== 'Saved|Ready to apply|Applied|Interviewing|Offer|Closed') throw new Error(headers.join('|'));
});

await step('"Move to" puts a job in the next stage', async () => {
  const card = col('saved').locator('article', { hasText: 'Wise' });
  await card.hover();
  await card.getByRole('button', { name: 'Move to Ready to apply' }).click();
  await col('ready').getByText('Wise').waitFor({ timeout: 10000 });
});

await step('drag into Applied asks first, then records it', async () => {
  const handle = col('saved').getByRole('button', { name: /Drag Product Manager at Monzo/ });
  const from = await handle.boundingBox();
  const to = await col('applied').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 });
  await page.mouse.up();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('heading', { name: 'Did you apply to Monzo?' }).waitFor({ timeout: 5000 });
  await dialog.getByLabel('Confirmation number or email subject (optional)').fill('MZ-77');
  await page.screenshot({ path: path.join(OUT, 'b1-confirm.png') });
  await dialog.getByRole('button', { name: 'Yes, I applied' }).click();
  await col('applied').getByText('Monzo').waitFor({ timeout: 10000 });
  await col('applied').getByText(/Applied [A-Z][a-z]{2} \d+/).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'b2-board.png') });
});

await step('History: applied, self-reported, with confirmation', async () => {
  await page.goto(BASE + '/history');
  await page.getByText('You applied to Monzo, Product Manager').waitFor({ timeout: 10000 });
  await page.getByText('Confirmation: MZ-77').waitFor();
  await page.getByText('You reported').first().waitFor();
});

await browser.close();
console.log(`\n${pass}/${pass + fail} board steps passed`);
console.log(`Browser errors (${errors.length}):`);
for (const e of [...new Set(errors)]) console.log('  ' + e);
if (fail) process.exitCode = 1;
