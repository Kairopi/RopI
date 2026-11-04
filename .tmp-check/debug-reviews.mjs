// Focused debug: quiz -> results -> reviews, logging DOM state over time
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('console', (m) => {
  const t = m.text();
  if (/Loaded|review|Review|error|Error|Failed/i.test(t)) console.log('  [console]', t.slice(0, 200));
});
page.on('framenavigated', (f) => f === page.mainFrame() && console.log('  [nav]', f.url().replace(BASE, '')));

const state = async (label) => {
  const s = await page.evaluate(() => ({
    url: location.pathname,
    showAnswer: [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Show Answer').length,
    loading: !!document.body.textContent.includes('Loading your review cards'),
    h2: [...document.querySelectorAll('main h2')].map((h) => h.textContent.slice(0, 50)),
    done: document.body.textContent.includes('All reviews complete') || document.body.textContent.includes('Nothing due'),
  }));
  console.log(`${label.padEnd(28)} ${JSON.stringify(s)}`);
};

await page.goto(BASE + '/login');
await page.getByRole('button', { name: 'Start' }).click();
await page.waitForURL('**/dashboard');

// All wrong except Q1 -> 5 review cards
await page.goto(BASE + '/quiz/quiz-1');
for (let i = 0; i < 6; i++) {
  await page.waitForFunction((n) => document.querySelector('main p.text-sm')?.textContent?.startsWith(`Question ${n}`), i + 1);
  await page.waitForFunction(() => document.querySelectorAll('main h2').length === 1);
  await page.locator('main button').filter({ has: page.locator('span.text-sm') }).nth(i === 0 ? 2 : 0).click();
  if (i < 5) await page.getByRole('button', { name: /^Next/ }).click();
}
await page.getByRole('button', { name: /Submit Quiz/ }).click();
await page.getByText(/cards? added/).waitFor({ timeout: 30000 });
await state('results ready');

await page.getByRole('button', { name: /Review \d+ now/ }).click();
for (let t = 0; t < 8; t++) {
  await page.waitForTimeout(500);
  await state(`reviews t=${t * 0.5}s`);
}

for (let r = 0; r < 3; r++) {
  await page.getByRole('button', { name: 'Show Answer' }).first().click();
  await page.getByRole('button', { name: /^Good/ }).first().click();
  for (let t = 0; t < 4; t++) {
    await page.waitForTimeout(400);
    await state(`after rating ${r + 1}, t=${t * 0.4}s`);
  }
}
await browser.close();
