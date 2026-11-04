// Browser check (needs the 20261104 migration): upload a real PDF on Learn, see Muse summary + tags,
// then take a document quiz whose questions show the quoted line they came from.
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

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 200)}`));

// Make a real PDF with Chromium's own PDF printer
const pdfPage = await context.newPage();
await pdfPage.setContent(`<html><body style="font-family:Arial;font-size:13px;line-height:1.5">
<h1>AWS Lambda limits and behaviour</h1>
<p>The maximum timeout for a single Lambda invocation is 900 seconds, which is 15 minutes. Jobs that need longer should use Step Functions, ECS or AWS Batch.</p>
<p>Memory can be set from 128 MB to 10,240 MB. Lambda allocates CPU power in proportion to the memory you configure, so raising memory also makes a function faster.</p>
<p>A cold start happens when Lambda has to create a new execution environment: it downloads your code, starts the runtime and runs your initialisation code before handling the request.</p>
<p>Provisioned concurrency keeps a number of execution environments initialised ahead of time, so requests routed to them do not suffer cold starts. Reserved concurrency only caps or guarantees capacity and does not pre-warm anything.</p>
<p>Standard Lambda pricing has two parts: a charge per request and a charge for duration, measured in GB-seconds. A function with 1 GB of memory that runs for 2 seconds uses 2 GB-seconds.</p>
</body></html>`);
const pdf = await pdfPage.pdf({ format: 'A4' });
await pdfPage.close();

await step('sign in + sample week', async () => {
  await page.goto(BASE + '/login');
  await page.getByLabel(/call you/).fill('Upload test');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForURL('**/setup', { timeout: 15000 });
  await page.getByText('Load a sample week').click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
});

await step('upload a PDF: saved as a source', async () => {
  await page.goto(BASE + '/learning');
  await page.locator('input[type="file"]').setInputFiles({ name: 'Lambda limits.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByRole('button', { name: /Quiz me on it/ }).and(page.locator(':not([disabled])')).waitFor({ timeout: 60000 });
});

await step('Your documents shows Muse summary and #tags', async () => {
  await page.getByText('Your documents').waitFor({ timeout: 30000 });
  const row = page.locator('li', { hasText: 'Lambda limits' }).first();
  await row.locator('text=/^#/').first().waitFor({ timeout: 30000 });
  console.log('      ' + (await row.innerText()).replace(/\s+/g, ' ').slice(0, 220));
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'u1-documents.png') });
});

await step('document quiz shows the quoted line', async () => {
  await page.getByRole('button', { name: /Quiz me on it/ }).click();
  await page.waitForURL('**/quiz/**', { timeout: 15000 });
  await page.getByText(/Written from your document "Lambda limits"/).waitFor({ timeout: 90000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'u2-doc-quiz.png') });
});

await step('finish it: results quote the PDF word for word', async () => {
  let prev = '';
  for (let i = 0; i < 20; i++) {
    await page.waitForFunction(
      (p) => {
        const h2s = [...document.querySelectorAll('main h2')];
        return h2s.length === 1 && h2s[0].textContent !== p && document.querySelectorAll('main button[data-option]').length >= 2;
      },
      prev,
      { timeout: 10000 }
    );
    prev = await page.locator('main h2').first().innerText();
    await page.locator('main button[data-option]').first().click();
    const submit = page.getByRole('button', { name: /Submit Quiz/ });
    if (await submit.isVisible()) {
      await submit.click();
      break;
    }
    await page.getByRole('button', { name: /^Next/ }).click();
  }
  await page.waitForURL('**/quiz/results/**', { timeout: 15000 });
  // Missed answers open by default; if everything was right, open the first one
  if (!(await page.locator('blockquote').count())) await page.locator('[data-panel="quiz-answers"] li button').first().click();
  const quote = page.locator('blockquote').first();
  await quote.waitFor({ timeout: 20000 });
  await page.getByText(/quote verified word for word/).first().waitFor();
  console.log('      ' + (await quote.innerText()).slice(0, 160));
  await quote.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'u3-doc-results.png') });
});

await browser.close();
console.log(`\n${pass}/${pass + fail} upload steps passed`);
console.log(`Browser errors (${errors.length}):`);
for (const e of [...new Set(errors)]) console.log('  ' + e);
if (fail) process.exitCode = 1;
