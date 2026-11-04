import { generateInterviewQuestions, evaluateInterviewResponse } from '/src/lib/jobs/interview-coach.ts';

export default async function () {
  const t0 = Date.now();
  const qs = await generateInterviewQuestions(
    'Product Manager',
    'Monzo',
    'Own the savings product roadmap. Work with engineering and design. Use data to prioritise. Experience with fintech a plus.',
    ''
  );
  console.log(`questions: ${qs.length} in ${Date.now() - t0}ms`);
  qs.slice(0, 3).forEach((q) => console.log(`  [${q.category}/${q.difficulty}] ${q.question}`));
  if (!qs.length || !qs[0].question) throw new Error('no questions');

  const t1 = Date.now();
  const ev = await evaluateInterviewResponse(
    qs[0].question,
    qs[0].category,
    'At my last job our onboarding drop-off was 40%. I interviewed 12 users, found the ID check step confused people, and we redesigned it with engineering. Drop-off fell to 22% in six weeks.',
    'Product Manager',
    ''
  );
  console.log(`evaluation in ${Date.now() - t1}ms: score=${ev.score} strengths=${ev.strengths?.length} improvements=${ev.improvements?.length}`);
  if (typeof ev.score !== 'number') throw new Error('no score');
  console.log('PASS interview coach works through Meta Muse');
}
