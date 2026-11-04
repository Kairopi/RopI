// Real-browser walkthrough of ROPI with Playwright (Chromium).
// Usage: node .tmp-check/e2e-browser.mjs   (dev server must be running on :5173)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:5173';
const SHOTS = path.resolve('.tmp-check/shots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const consoleErrors = [];
const step = async (name, fn) => {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`PASS  ${name} (${Date.now() - t0}ms)`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message.split('\n').slice(0, 6).join(' | ') });
    console.log(`FAIL  ${name}: ${e.message.split('\n').slice(0, 6).join(' | ')}`);
    await page.screenshot({ path: path.join(SHOTS, `FAIL-${name.replace(/\W+/g, '-')}.png`), fullPage: true }).catch(() => {});
  }
};
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`[console] ${page.url().replace(BASE, '')} :: ${msg.text().slice(0, 300)}`);
});
page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${page.url().replace(BASE, '')} :: ${err.message.slice(0, 300)}`));
page.on('response', (res) => {
  if (res.status() >= 400 && !res.url().includes('/@vite')) consoleErrors.push(`[http ${res.status()}] ${res.request().method()} ${res.url().slice(0, 160)}`);
});

// 1. Login
await step('login page renders', async () => {
  await page.goto(BASE + '/login');
  await page.getByRole('heading', { name: 'Start your week' }).waitFor();
  await shot('01-login');
});
await step('sign in (anonymous)', async () => {
  await page.getByLabel(/call you/).fill('Demo');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForURL('**/setup', { timeout: 15000 });
});
await step('first run: goal, free time, a task', async () => {
  await page.getByRole('heading', { name: 'What are you working toward?' }).waitFor();
  await page.getByLabel('Your goal').fill('Pass AWS Solutions Architect');
  await shot('02a-setup-goal');
  await page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByRole('heading', { name: 'When are you usually free?' }).waitFor();
  await page.getByLabel('Describe when you are free').fill('every day 7am to 11pm');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByText('112 h a week').waitFor({ timeout: 20000 });
  console.log('      ' + (await page.getByText(/Read by (Meta Muse|built-in rules)/).innerText()));
  await shot('02b-setup-free-time');
  await page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByLabel('Add a task').fill('Call the recruiter 20m @tomorrow #career');
  await page.getByText('20 min').first().waitFor();
  await page.keyboard.press('Enter');
  await page.getByText('Call the recruiter').waitFor();
  await shot('02c-setup-task');
  await page.getByRole('button', { name: /Plan my week/ }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.getByText(/Good (morning|afternoon|evening), Demo/).waitFor();
  await page.getByText('Working toward').waitFor();
  await page.getByText('Call the recruiter').first().waitFor();
  await page.waitForTimeout(1200);
  await shot('02-dashboard-first-run');
});

// 2. Quiz: miss both cold-start questions (indexes 2,3) and the GB-seconds question (5)
const wrong = new Set([2, 3, 5]);
await step('take AWS Lambda quiz', async () => {
  await page.getByRole('link', { name: /Learn/ }).or(page.getByRole('button', { name: 'Learn' })).first().click();
  await page.waitForURL('**/learning');
  await page.waitForTimeout(1000);
  await shot('03-learning');
  await page.getByRole('button', { name: /AWS Lambda Fundamentals/ }).click();
  await page.waitForURL('**/quiz/quiz-1');
  let prevText = '';
  for (let i = 0; i < 6; i++) {
    // Wait until the previous question has finished animating out and the new one is the only one on screen
    await page.waitForFunction(
      (prev) => {
        const h2s = [...document.querySelectorAll('main h2')];
        return h2s.length === 1 && h2s[0].textContent !== prev;
      },
      prevText,
      { timeout: 10000 }
    );
    const opts = page.locator('main button[data-option]');
    await page.waitForFunction(() => document.querySelectorAll('main button[data-option]').length === 4);
    if (i === 0) await shot('04-quiz-question');
    // Read correct answer index from the built-in quiz by matching text
    const qText = await page.locator('main h2').first().innerText();
    prevText = qText;
    const correctIdx = await page.evaluate(async (q) => {
      const mod = await import('/src/lib/mock/quizzes.ts');
      return mod.BUILT_IN_QUIZZES['quiz-1'].questions.find((x) => x.question === q)?.correctAnswerIndex;
    }, qText);
    if (correctIdx === undefined) throw new Error(`question not found: ${qText}`);
    const pick = wrong.has(i) ? (correctIdx + 1) % 4 : correctIdx;
    await opts.nth(pick).click();
    if (i < 5) await page.getByRole('button', { name: /^Next/ }).click();
  }
  await page.getByRole('button', { name: /Submit Quiz/ }).click();
  await page.waitForURL('**/quiz/results/quiz-1');
});

// 3. Results: skill update, weak spot, lesson, review cards
await step('results: score 50% + skill update', async () => {
  await page.locator('[data-score]', { hasText: '50%' }).waitFor({ timeout: 10000 });
  await page.getByText('What this quiz showed').waitFor({ timeout: 20000 });
});
await step('results: weak spot detected', async () => {
  await page.getByText('Weak spot', { exact: true }).first().waitFor({ timeout: 10000 });
  await page.getByText('Lambda cold starts', { exact: true }).first().waitFor();
  await page.getByRole('heading', { name: /cold starts/ }).first().waitFor(); // the verdict names it
});
await step('results: 3 review cards created', async () => {
  await page.getByText(/3 cards added/).waitFor({ timeout: 20000 });
});
await step('results: Meta Muse lesson generated', async () => {
  await page.getByRole('button', { name: /Start lesson/ }).waitFor({ timeout: 60000 });
  await shot('05-results');
  await page.getByRole('button', { name: /Start lesson/ }).click();
  await page.getByRole('heading', { name: 'Memory tricks' }).waitFor();
  const first = page.getByRole('button', { name: 'Show answer' }).first();
  if (await first.count()) await first.click();
  await shot('06-lesson-expanded');
});

// 4. Daily reviews
await step('daily reviews: rate 3 cards', async () => {
  await page.getByRole('button', { name: /Review 3 now/ }).click();
  await page.waitForURL('**/reviews');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Show Answer', exact: true }).waitFor({ timeout: 15000 });
    if (i === 0) await shot('07-review-card');
    await page.getByRole('button', { name: 'Show Answer', exact: true }).click();
    await page.getByRole('button', { name: /^Good/ }).click();
    await page.waitForTimeout(600);
  }
  await page.getByText('All reviews complete').waitFor({ timeout: 15000 });
  await shot('08-reviews-done');
});

// 5. LifeShift
await step('lifeshift: parse + replan', async () => {
  await page.goto(BASE + '/schedule');
  await page.getByRole('heading', { name: 'Say what changed.' }).waitFor();
  await page.waitForTimeout(800);
  await shot('09-lifeshift-before');
  await page.getByRole('button', { name: /only 20min tonight/ }).click();
  await page.getByRole('button', { name: 'Replan my week' }).waitFor({ timeout: 20000 });
  const parsedBy = await page.getByText(/Parsed by (Meta Muse|rules)/).innerText();
  console.log('      ' + parsedBy);
  await page.getByRole('button', { name: 'Replan my week' }).click();
  await page.getByText(/Replanned in/).waitFor({ timeout: 10000 });
  await page.getByText(/what I did and why|No changes needed/).waitFor({ timeout: 5000 });
  await page.waitForTimeout(800);
  await shot('10-lifeshift-after');
});

// 6. Dashboard with real data
await step('dashboard shows real activity', async () => {
  await page.goto(BASE + '/dashboard');
  // Last 7 days is computed from real records (1 quiz + 3 reviews today)
  await page.getByText('Last 7 days').waitFor({ timeout: 15000 });
  await page.getByText(/Active 1 of 7 days/).waitFor({ timeout: 15000 });
  // The loop: the weak spot from the quiz is now a scheduled practice block
  await page.getByText('Practice: Lambda cold starts').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await shot('11-dashboard-after');
});

// 6b. Ask Ropi: answers from your own history, with citations
await step('ask ropi: cites your quiz history', async () => {
  await page.keyboard.press('Control+k');
  await page.getByRole('button', { name: 'What have I been getting wrong?' }).click();
  await page.getByText(/^Sources$|^What Ropi found$/).waitFor({ timeout: 45000 });
  const answer = await page.locator('[role="dialog"] p.text-\\[15px\\]').innerText();
  console.log('      ' + answer.replace(/\s+/g, ' ').slice(0, 220));
  if (!/cold start/i.test(answer)) throw new Error('answer did not mention the weak spot');
  await shot('11b-ask-ropi');
  await page.keyboard.press('Escape');
});

// 6c. Check-in: once a planned block has ended, Today asks how it went
await step('check-in after a planned block', async () => {
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('ropi-week-v1'));
    const task = raw.state.tasks.find((t) => t.title === 'Call the recruiter');
    raw.state.slots[task.id] = { start: new Date(Date.now() - 50 * 60000).toISOString(), end: new Date(Date.now() - 30 * 60000).toISOString() };
    localStorage.setItem('ropi-week-v1', JSON.stringify(raw));
  });
  await page.reload();
  await page.getByText('How did "Call the recruiter" go?').waitFor({ timeout: 10000 });
  await shot('11c-check-in');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: /30 min/ }).click();
  await page.getByText('How did "Call the recruiter" go?').waitFor({ state: 'detached', timeout: 5000 });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ropi-week-v1')).state.tasks.find((t) => t.title === 'Call the recruiter'));
  if (!stored.doneAt || stored.actualMinutes !== 30) throw new Error('check-in not recorded: ' + JSON.stringify(stored));
  // The receipt is written in the background; a full reload right away can cancel it
  await page.waitForLoadState('networkidle');
});

// 6d. Activity: every action above left a receipt in the database
await step('history: quiz, reviews, replan, check-in', async () => {
  await page.goto(BASE + '/activity');
  await page.getByRole('heading', { name: 'What you’ve done' }).waitFor();
  for (const text of [/AWS Lambda quiz: 50%/, /Reviewed 3 cards/, /Week replanned/, /Done: Call the recruiter/]) {
    await page.getByText(text).first().waitFor({ timeout: 10000 });
  }
  // The receipt and the saved attempt are the same quiz: shown once, not twice
  await page.waitForTimeout(800);
  for (const text of [/AWS Lambda quiz: 50%/, /Reviewed 3 cards/]) {
    const n = await page.getByText(text).count();
    if (n !== 1) throw new Error(`${text} shown ${n} times`);
  }
  await page.waitForTimeout(600);
  await shot('11d-activity');
});

// 7. Other pages load without crashing
for (const [name, url, text] of [
  ['voice quiz page', '/voice-quiz', 'Start voice quiz'],
  ['learning hub', '/learning-hub', 'Learning Hub'],
  ['jobs', '/jobs', 'Your job search'],
  ['tasks', '/tasks', ''],
]) {
  await step(`${name} loads`, async () => {
    await page.goto(BASE + url);
    if (text) await page.getByText(text).first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    await shot(`12-${name.replace(/\W+/g, '-')}`);
  });
}

// 8. Mobile layout of the results-heavy page
await step('mobile dashboard', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/dashboard');
  await page.waitForTimeout(1500);
  await shot('13-mobile-dashboard');
});

await browser.close();

console.log('\n==== SUMMARY ====');
console.log(`${results.filter((r) => r.ok).length}/${results.length} steps passed`);
results.filter((r) => !r.ok).forEach((r) => console.log(`  FAILED: ${r.name} -> ${r.error}`));
console.log(`\nBrowser errors (${consoleErrors.length}):`);
const grouped = {};
consoleErrors.forEach((e) => { const k = e.replace(/\?.*$/, '').replace(/ :: .*/, ''); grouped[k] = (grouped[k] || 0) + 1; });
Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, n]) => console.log(`  ${n}x ${k}`));
