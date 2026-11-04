// History shows records from before receipts existed: a quiz attempt saved 3 days ago (no receipt)
// appears under that date, once; the phone calendar shows one day with a date strip.
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
    console.log(`FAIL  ${name}: ${String(e.message).split('\n')[0]}`);
  }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 200)}`));

await page.goto(BASE + '/login');
await page.getByLabel(/call you/).fill('History test');
await page.getByRole('button', { name: 'Start' }).click();
await page.waitForURL('**/setup', { timeout: 15000 });
await page.getByText('Load a sample week').click();
await page.waitForURL('**/dashboard', { timeout: 15000 });

const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
threeDaysAgo.setHours(19, 30, 0, 0);
await step('older quiz attempt is saved (no receipt)', async () => {
  const err = await page.evaluate(async (at) => {
    const { supabase } = await import('/src/lib/supabase.ts');
    const { data } = await supabase.auth.getSession();
    const { error } = await supabase.from('quiz_attempts').insert({
      user_id: data.session.user.id,
      topic: 'Kubernetes basics',
      score: 67,
      total_questions: 6,
      correct_answers: 4,
      weak_spots: [],
      time_taken_seconds: 140,
      quiz_mode: 'text',
      created_at: at,
    });
    return error?.message ?? null;
  }, threeDaysAgo.toISOString());
  if (err) throw new Error(err);
});

await step('History shows it under its own date, once', async () => {
  await page.goto(BASE + '/history');
  const heading = threeDaysAgo.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  await page.getByRole('heading', { name: heading, exact: true }).waitFor({ timeout: 10000 });
  const n = await page.getByText('Kubernetes basics quiz: 67%').count();
  if (n !== 1) throw new Error(`shown ${n} times`);
  await page.getByText('4/6 correct · from your saved quiz attempts').waitFor();
  await page.getByText('7:30 PM').first().waitFor();
  await page.screenshot({ path: path.join(OUT, 'h1-history-backfill.png') });
});

await step('phone: calendar shows one day, pick another from the date strip', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/dashboard');
  const panel = page.locator('[data-panel="today-week"]');
  await panel.getByRole('tablist', { name: 'Day' }).waitFor({ timeout: 10000 });
  if ((await panel.locator('[data-day]').count()) !== 1) throw new Error('more than one day column on a phone');
  const tomorrow = new Date(Date.now() + 86_400_000);
  const label = tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  await panel.getByRole('tab', { name: label }).click();
  const shown = await panel.locator('[data-day]').getAttribute('data-day');
  const want = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  if (shown !== want) throw new Error(`showing ${shown}, wanted ${want}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error('page scrolls sideways on a phone');
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'h2-phone-calendar.png') });
});

await browser.close();
console.log(`\n${pass}/${pass + fail} history steps passed`);
console.log(`Browser errors (${errors.length}):`);
for (const e of [...new Set(errors)]) console.log('  ' + e);
if (fail) process.exitCode = 1;
