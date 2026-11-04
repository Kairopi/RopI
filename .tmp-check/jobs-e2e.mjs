// Browser check for Jobs: real search -> save -> paste description -> add resume -> score -> tailor (Meta Muse)
// -> approve -> I applied (self-reported, in History) -> closing date shows on the job.
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
    console.log(`FAIL  ${name}: ${String(e.message).split('\n')[0]}`);
  }
};

const RESUME = `Alex Kim
Product Manager

EXPERIENCE
Senior Product Manager, Fintech Co (2021 - 2026)
- Led a squad of 8 engineers and 2 designers shipping mobile payments features to 2M users
- Ran A/B tests and user research; grew activation 18% in two quarters
- Wrote product requirements and roadmaps, worked with data analysts using SQL

Product Analyst, Retail Ltd (2018 - 2021)
- Built dashboards in SQL and Looker, owned the weekly metrics review

EDUCATION
BSc Economics, University of Leeds (2018)

SKILLS
Product strategy, roadmapping, A/B testing, user research, SQL, agile, stakeholder management`;

const DESCRIPTION = `We are hiring a Product Manager to own our mobile payments experience.
You will set the roadmap, run discovery and user research, write clear requirements, and work with engineering and design in an agile team.
Requirements: 3+ years product management, experience with A/B testing and experimentation, SQL for analysis, strong stakeholder management, fintech or payments experience preferred.`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 200)}`));
let savedTitle = '';
// The Job Seek job we saved (the list is newest first, so don't rely on position)
const row = () => page.locator('[data-panel="jobs-list"] li', { hasText: savedTitle }).first();

await step('sign in + sample week', async () => {
  await page.goto(BASE + '/login');
  await page.getByLabel(/call you/).fill('Jobs test');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForURL('**/setup', { timeout: 15000 });
  await page.getByText('Load a sample week').click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.goto(BASE + '/jobs');
  await page.getByRole('heading', { name: 'Your job search' }).waitFor();
  await page.getByText('Add your resume once.').waitFor({ timeout: 10000 });
});

await step('real search on Job Seek and save one', async () => {
  await page.getByLabel('Job title or keywords').fill('Product Manager');
  await page.getByLabel('Location').fill('London');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByText(/Showing \d+ of [\d,]+ companies hiring/).waitFor({ timeout: 30000 });
  const first = page.locator('[data-panel="jobs-find"] li').first();
  savedTitle = (await first.locator('.font-medium').first().innerText()).trim();
  console.log('      ' + (await first.innerText()).replace(/\s+/g, ' ').slice(0, 120));
  await page.screenshot({ path: path.join(OUT, 'j1-search.png') });
  await first.getByRole('button', { name: 'Save' }).click();
  await first.getByRole('button', { name: 'Saved' }).waitFor({ timeout: 15000 });
});

await step('saved job came with its real description (no pasting)', async () => {
  await row().getByRole('button', { name: 'Score my fit' }).waitFor({ timeout: 10000 });
  await row().getByRole('button', { name: 'Show details' }).click();
  const text = await page.getByLabel('Job description').inputValue();
  console.log(`      ${text.length} chars: "${text.replace(/\s+/g, ' ').slice(0, 110)}..."`);
  if (text.length < 300 || /<[a-z]+[ >]/i.test(text)) throw new Error('description missing or still HTML');
  await row().getByRole('button', { name: 'Hide details' }).click();
});

await step('a job you add yourself is ready to score', async () => {
  await page.getByRole('button', { name: 'Add a job' }).click();
  await page.getByLabel(/Job Title/).fill('Product Manager, Payments');
  await page.getByLabel(/Company/).fill('Pay Co');
  await page.getByLabel(/Job Description/).fill(DESCRIPTION);
  await page.getByRole('button', { name: 'Add Job' }).click();
  const manual = page.locator('[data-panel="jobs-list"] li', { hasText: 'Product Manager, Payments' });
  await manual.getByRole('button', { name: 'Score my fit' }).waitFor({ timeout: 10000 });
});

await step('add resume', async () => {
  await page.getByRole('button', { name: 'Add resume' }).click();
  await page.getByPlaceholder(/Paste your resume/).fill(RESUME);
  await page.getByRole('button', { name: 'Save Resume' }).click();
  await page.getByText('Resume saved').waitFor({ timeout: 10000 });
});

await step('score my fit (ATS)', async () => {
  await row().getByRole('button', { name: 'Score my fit' }).click();
  await page.getByRole('heading', { name: 'Resume fit' }).waitFor({ timeout: 30000 });
  const fit = await row().locator('[title^="Resume fit"]').getAttribute('title');
  console.log('      ' + fit);
  await page.screenshot({ path: path.join(OUT, 'j2-score.png'), fullPage: true });
});

await step('tailor with Meta Muse, approve', async () => {
  const tailorBtn = row().getByRole('button', { name: 'Tailor resume' });
  await tailorBtn.waitFor({ timeout: 10000 });
  await tailorBtn.click();
  await page.getByText('Tailored resume', { exact: true }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'Approve' }).click();
  await row().getByRole('button', { name: 'I applied' }).waitFor({ timeout: 10000 });
});

await step('I applied: self-reported, shows in History', async () => {
  await row().getByRole('button', { name: 'I applied' }).click();
  await page.getByLabel('Confirmation number or email subject (optional)').fill('APP-12345');
  await page.getByRole('button', { name: 'Mark as applied' }).click();
  await row().getByText(/Applied [A-Z][a-z]{2}, [A-Z][a-z]{2} \d+/).waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'j3-applied.png') });
  await page.goto(BASE + '/history');
  await page.getByText(/You applied to /).waitFor({ timeout: 10000 });
  await page.getByText('Confirmation: APP-12345').waitFor();
  await page.getByText('You reported').first().waitFor();
});

await browser.close();
console.log(`\n${pass}/${pass + fail} jobs steps passed`);
console.log(`Browser errors (${errors.length}):`);
for (const e of [...new Set(errors)]) console.log('  ' + e);
if (fail) process.exitCode = 1;
