// Talk to Ropi (typed, since headless Chrome has no mic): explain, news with live sources,
// a podcast to play, add a task, find jobs; the conversation lands in History with times,
// and news/podcasts are filed in the topic's folder.
import { chromium } from 'playwright';
import path from 'node:path';

const BASE = 'http://localhost:5173';
const OUT = path.resolve('.tmp-check/shots');
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
    await page.screenshot({ path: path.join(OUT, `t-fail-${pass + fail}.png`) }).catch(() => undefined);
  }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text().slice(0, 200)}`));

// No speakers in CI: make speech output finish instantly so the loop continues
await context.addInitScript(() => {
  const synth = window.speechSynthesis;
  if (synth) {
    synth.speak = (u) => setTimeout(() => u.onend && u.onend(new Event('end')), 30);
  }
});

const ropiTurns = () => page.locator('.rounded-bl-md');
async function say(text, timeout = 90000) {
  const before = await ropiTurns().count();
  await page.getByLabel('Type to Ropi').fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForFunction((n) => document.querySelectorAll('.rounded-bl-md').length > n, before, { timeout });
  const reply = (await ropiTurns().last().innerText()).replace(/\s+/g, ' ');
  console.log(`      you: ${text}\n      ropi: ${reply.slice(0, 220)}`);
  return reply;
}

await page.goto(BASE + '/login');
await page.getByLabel(/call you/).fill('Talk test');
await page.getByRole('button', { name: 'Start' }).click();
await page.waitForURL('**/setup', { timeout: 15000 });
await page.getByText('Load a sample week').click();
await page.waitForURL('**/dashboard', { timeout: 15000 });

await step('Talk is in the nav and opens', async () => {
  await page.getByRole('button', { name: 'Talk', exact: true }).click();
  await page.waitForURL('**/talk');
  await page.getByRole('heading', { name: 'What do you need right now?' }).waitFor();
  // Hands-free off for the test (no mic): reply, then wait
  await page.getByRole('button', { name: 'Voice', exact: true }).click();
  await page.getByLabel('Keep listening').uncheck();
  await page.getByRole('button', { name: 'Voice', exact: true }).click();
});

await step('explain: "I\'m lost, what does a project charter mean?"', async () => {
  const r = await say("I'm lost, what does a project charter mean?");
  if (!/charter/i.test(r) || r.length < 80) throw new Error('weak explanation');
});

await step('news: live web search with dated, linked sources', async () => {
  const r = await say('What is the latest news on project management certifications?');
  if (r.length < 60) throw new Error('no news text');
  const links = await ropiTurns().last().locator('xpath=../..').locator('a[href^="http"]').count();
  console.log(`      ${links} source links`);
  if (links < 1) throw new Error('no source links');
});

await step('podcast: picks with a playable latest episode', async () => {
  await say('Recommend a podcast about product management for my commute');
  const play = page.getByRole('button', { name: /^Play / }).first();
  await play.waitFor({ timeout: 10000 });
  await play.click();
  await page.locator('audio').first().waitFor({ timeout: 5000 });
  await page.screenshot({ path: path.join(OUT, 't1-talk.png') });
});

await step('add: "remind me to..." puts a task in the week', async () => {
  const r = await say('Remind me to review the project charter template for 25 minutes tomorrow');
  await page.getByText('Added to your week').last().waitFor({ timeout: 5000 });
  const task = await page.evaluate(() => JSON.parse(localStorage.getItem('ropi-week-v1')).state.tasks.find((t) => /charter/i.test(t.title)));
  if (!task || task.duration !== 25) throw new Error('task wrong: ' + JSON.stringify(task));
  console.log(`      task: ${task.title}, ${task.duration} min, due ${task.deadline}`);
  if (!/25 minutes/.test(r)) throw new Error('reply did not confirm');
});

await step('jobs: search across job sites from a sentence', async () => {
  await say('Find product manager jobs in London');
  const saveBtns = ropiTurns().last().locator('xpath=../..').getByRole('button', { name: 'Save' });
  if ((await saveBtns.count()) < 1) throw new Error('no job results');
});

await step('apply: says plainly it will not submit for you', async () => {
  const r = await say('Can you apply for me?');
  if (!/won.?t submit/i.test(r)) throw new Error('did not refuse auto-apply: ' + r);
});

await step('History shows the conversation with times', async () => {
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'History' }).first().click();
  await page.waitForURL('**/history');
  const row = page.getByText(/Talked with Ropi: I'm lost/);
  await row.waitFor({ timeout: 10000 });
  await row.click();
  await page.getByText(/Ropi:/).first().waitFor();
  await page.getByRole('heading', { name: 'Last 5 weeks' }).waitFor();
  await page.screenshot({ path: path.join(OUT, 't2-history.png') });
});

await step('Learn shows topic folders; the news topic folder has saved links', async () => {
  await page.getByRole('button', { name: 'Learn' }).first().click();
  await page.waitForURL('**/learning');
  await page.locator('[data-panel="learn-folders"] li').first().waitFor({ timeout: 10000 });
  const names = await page.locator('[data-panel="learn-folders"] li').allInnerTexts();
  console.log('      folders: ' + names.map((n) => n.split('\n')[0]).join(' | '));
  const folder = page.locator('[data-panel="learn-folders"] li', { hasText: /product management|certification/i }).first();
  await folder.click();
  await page.waitForURL('**/learn/topic/**');
  await page.getByText(/saved by Ropi/).first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(OUT, 't3-topic.png'), fullPage: true });
});

await browser.close();
console.log(`\n${pass}/${pass + fail} talk steps passed`);
console.log(`Browser errors (${errors.length}):`);
for (const e of [...new Set(errors)]) console.log('  ' + e);
if (fail) process.exitCode = 1;
