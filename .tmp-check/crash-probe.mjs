// Which page throws "destroy is not a function"? Visit each and print page errors with stack.
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(`${page.url()} :: ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 6).join('\n')}`));
page.on('console', (m) => m.type() === 'error' && /useEffect|destroy/.test(m.text()) && errs.push(`${page.url()} :: console ${m.text().slice(0, 400)}`));
await page.goto(BASE + '/login');
await page.getByLabel(/call you/).fill('Crash probe');
await page.getByRole('button', { name: 'Start' }).click();
await page.waitForURL('**/setup', { timeout: 15000 });
await page.getByText('Load a sample week').click();
await page.waitForURL('**/dashboard', { timeout: 15000 });
for (const p of ['/dashboard', '/talk', '/learning', '/history', '/tasks', '/schedule']) {
  const before = errs.length;
  await page.goto(BASE + p);
  await page.waitForTimeout(2500);
  console.log(p, errs.length - before ? 'ERRORS' : 'ok');
}
console.log(errs.join('\n\n'));
await browser.close();
