// Ask Ropi live: real account, real quiz history, Meta Muse answer, citations verified
import { supabase } from '/src/lib/supabase.ts';
import { processQuizAttempt } from '/src/lib/learning/process-quiz.ts';
import { buildQuizResult } from '/src/lib/learning/quiz-result.ts';
import { BUILT_IN_QUIZZES } from '/src/lib/mock/quizzes.ts';
import { askRopi, verifyCitations, overlap } from '/src/lib/knowledge/ask.ts';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + JSON.stringify(got)?.slice(0, 400)}`);
};

export default async function () {
  // Pure checks
  const ev = [{ id: 'H1', kind: 'history', title: 'x', text: 'y' }, { id: 'N2', kind: 'note', title: 'a', text: 'b' }] as any;
  const v = verifyCitations('You missed cold starts [H1]. Also see [N2, Z9] and [Q7].', ev);
  check('unknown citation ids are stripped', v.text === 'You missed cold starts [H1]. Also see [N2] and.' || (!v.text.includes('Z9') && !v.text.includes('Q7')), v.text);
  check('cited list only has real evidence', v.cited.map((e) => e.id).join() === 'H1,N2', v.cited);
  check('overlap matches plurals', overlap(['cold', 'starts'], 'Lambda cold start') >= 0.5);

  // Live
  const { data, error } = await supabase.auth.signInAnonymously({ options: { data: { display_name: 'Ask test' } } });
  if (error || !data.session) throw new Error('sign-in failed: ' + error?.message);

  const quiz = BUILT_IN_QUIZZES['quiz-1'];
  const wrongIds = new Set(['l3', 'l4']); // both cold-start questions
  const answers = Object.fromEntries(quiz.questions.map((q) => [q.id, wrongIds.has(q.id) ? (q.correctAnswerIndex + 1) % 4 : q.correctAnswerIndex]));
  const p = await processQuizAttempt(buildQuizResult(quiz, 'quiz-1', answers, 80, 'text', '/quiz/quiz-1'));
  check('quiz processed', !p.skillError && p.cardsCreated === 2, p);

  const plan = { goal: 'Pass AWS Solutions Architect', upcoming: [{ title: 'Practice: Lambda cold starts', when: 'Today 7:00 PM', minutes: 15 }], atRisk: [] };

  const a1 = await askRopi('What have I been getting wrong?', plan);
  console.log(`      [${a1.answeredBy}, ${a1.ms} ms] ${a1.text}`);
  console.log(`      cited: ${a1.cited.map((e) => `${e.id} ${e.title}`).join(' | ')}`);
  console.log(`      action: ${a1.action?.label} -> ${a1.action?.href}`);
  check('answer mentions cold starts', /cold start/i.test(a1.text), a1.text);
  check('answer cites at least one piece of evidence', a1.cited.length >= 1, a1.cited);
  check('every cited id was retrieved', a1.cited.every((c) => a1.retrieved.some((r) => r.id === c.id)));
  check('next step is practising the weak spot', !!a1.action?.href.includes('focus=Lambda%20cold%20starts'), a1.action);

  const a2 = await askRopi('What should I do tonight?', plan);
  console.log(`      [${a2.answeredBy}] ${a2.text}`);
  check('plan question cites the plan', a2.cited.some((e) => e.kind === 'plan'), a2.cited.map((e) => e.id));

  const a3 = await askRopi('What is the capital of France?', plan);
  console.log(`      [${a3.answeredBy}] ${a3.text}`);
  check('off-topic question is not answered from outside knowledge', !/paris/i.test(a3.text), a3.text);

  console.log(`\n${pass}/${pass + fail} ask checks pass`);
  if (fail) process.exitCode = 1;
}
