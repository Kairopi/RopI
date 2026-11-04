import { parseConstraint, parseConstraintWithRules } from '@/lib/scheduling/parse-constraint';
import { generateTopicQuiz } from '@/lib/learning/topic-quiz';
import { generateNextLesson } from '@/lib/learning/adaptive-lessons';
import { getMuseStatus } from '@/lib/api/muse';
import { buildPlan, changedTaskIds } from '@/lib/scheduling/plan';
import { EXAMPLE_CONSTRAINTS } from '@/lib/mock/schedule-data';

const t = () => performance.now();
const fmt = (c: any) =>
  c
    ? `${c.type} via ${c.parsedBy} ${JSON.stringify({ date: c.date, min: c.availableMinutes, due: c.urgentDeadline && new Date(c.urgentDeadline).toLocaleString(), shift: c.conflictingShift && [new Date(c.conflictingShift.start).toLocaleTimeString(), new Date(c.conflictingShift.end).toLocaleTimeString()] })}`
    : 'NULL';

export default async function () {
  console.log('Muse status:', JSON.stringify(await getMuseStatus()));

  console.log('\n== LifeShift: rules parser (offline fallback)');
  for (const s of [...EXAMPLE_CONSTRAINTS, 'busy with a client call 3-5pm tomorrow', 'just 1 hour tonight']) {
    console.log(`  "${s}" -> ${fmt(parseConstraintWithRules(s))}`);
  }

  console.log('\n== LifeShift: Meta Muse parser + full replan');
  const before = buildPlan([]);
  for (const s of [...EXAMPLE_CONSTRAINTS, 'my kid is sick, I only have 45 minutes tomorrow evening']) {
    const t0 = t();
    const c = await parseConstraint(s);
    const ms = Math.round(t() - t0);
    const after = c ? buildPlan([c]) : null;
    console.log(`  "${s}" (${ms}ms) -> ${fmt(c)}`);
    if (after) console.log(`     replanned in ${after.schedule.calculationTime}ms, moved ${changedTaskIds(before.schedule, after.schedule).length} task(s), at risk ${after.schedule.atRiskTasks.length}`);
  }

  console.log('\n== Generated quiz (topic)');
  let t0 = t();
  const quiz = await generateTopicQuiz('Kubernetes basics');
  console.log(`  ${Math.round(t() - t0)}ms | "${quiz.title}" | ${quiz.questions.length} questions | concepts:`, [...new Set(quiz.questions.map((q) => q.concept))].join(' / '));
  console.log('  Q1:', quiz.questions[0].question, '| options', quiz.questions[0].options.length, '| answer', quiz.questions[0].correctAnswerIndex);

  console.log('\n== Generated quiz (focused practice)');
  t0 = t();
  const focus = await generateTopicQuiz('AWS Lambda', 'Lambda cold starts');
  console.log(`  ${Math.round(t() - t0)}ms | ${focus.questions.length} questions | all on focus concept: ${focus.questions.every((q) => q.concept === 'Lambda cold starts')}`);

  console.log('\n== Adaptive lesson for a weak spot');
  t0 = t();
  const lesson = await generateNextLesson(
    'AWS Lambda',
    { user_id: 'x', topic: 'AWS Lambda', confidence: 33, quizzesTaken: 1, correctAnswers: 2, totalAnswers: 6, accuracy: 33, weakSpots: ['Lambda cold starts'], strongSpots: [], lastQuizAt: new Date() },
    [{ concept: 'Lambda cold starts', attempts: 2, correct: 0, accuracy: 0, lastAttempt: new Date(), trend: 'stable' }],
    [{ question: 'What causes a Lambda cold start?', chosen: 'Network latency between regions', correct: 'Lambda creating and initializing a new execution environment' }]
  );
  console.log(`  ${Math.round(t() - t0)}ms | "${lesson?.title}" | ${lesson?.difficulty} | why: ${lesson?.reason}`);
  console.log(`  tricks ${lesson?.memoryTricks.length} | examples ${lesson?.examples.length} | takeaways ${lesson?.keyTakeaways.length} | exercises ${lesson?.practiceExercises.length}`);
  console.log('  explanation starts:', lesson?.explanation.slice(0, 160).replace(/\s+/g, ' '));
}
