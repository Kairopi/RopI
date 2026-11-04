// Rules router (used when Muse is unavailable): the everyday phrasings land on the right intent
import { routeWithRules, speakable } from '/src/lib/coach/brain.ts';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + JSON.stringify(got)}`);
};

export default async function () {
  const cases: [string, string, Record<string, unknown>?][] = [
    ["I'm lost, what does a project charter mean?", 'explain'],
    ['Explain scope creep', 'explain'],
    ['Quiz me on AWS Lambda', 'quiz', { topic: 'AWS Lambda' }],
    ['What is the latest news on project management?', 'news', { topic: 'project management' }],
    ['Recommend a podcast about product management', 'podcast', { topic: 'product management' }],
    ['What should I do today?', 'plan'],
    ['What have I been getting wrong?', 'plan'],
    ['Remind me to read chapter 4 tomorrow', 'add'],
    ['Find me product manager jobs in London', 'jobs', { role: 'product manager', location: 'London' }],
    ['Can you tailor my CV for this job', 'cv'],
    ['Help me answer why do you want to work here', 'form'],
    ['Please apply for me', 'apply'],
    ['Thanks Ropi, feeling a bit tired today', 'chat'],
    ["What's the plan for today?", 'plan'],
    ['Hello', 'chat'],
  ];
  for (const [text, intent, extra] of cases) {
    const r = routeWithRules(text);
    const okExtra = Object.entries(extra ?? {}).every(([k, v]) => String((r as any)[k] ?? '').toLowerCase() === String(v).toLowerCase());
    check(`"${text}" -> ${intent}`, r.intent === intent && okExtra, r);
  }
  const s = speakable('You got **0 of 2** [H1] right. More at https://x.y/z');
  check('speakable strips citations, markdown and links', s === 'You got 0 of 2 right. More at', s);
  console.log(`\n${pass}/${pass + fail} coach routing checks pass`);
  if (fail) process.exitCode = 1;
}
