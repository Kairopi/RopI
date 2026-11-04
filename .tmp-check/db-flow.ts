/**
 * End-to-end database test with a real anonymous Supabase user.
 * Runs the same functions the browser runs after a quiz.
 */
import { supabase } from '@/lib/supabase';
import { processQuizAttempt } from '@/lib/learning/process-quiz';
import { buildQuizResult } from '@/lib/learning/quiz-result';
import { BUILT_IN_QUIZZES } from '@/lib/mock/quizzes';
import { getDueCardsFromDatabase, reviewCardComplete, Rating } from '@/lib/learning/spaced-repetition';
import { saveStudyGuide, fetchStudyGuides, saveFlashcards } from '@/lib/learning/study-materials-db';
import { createJobApplication, getJobStats } from '@/lib/jobs/job-service';
import { saveReplanLog } from '@/lib/api/supabase';

export default async function () {
  const { data, error } = await supabase.auth.signInAnonymously({ options: { data: { display_name: 'E2E test' } } });
  if (error) {
    console.log('BLOCKED: anonymous sign-in failed ->', error.message);
    return;
  }
  const userId = data.user!.id;
  console.log('Signed in as anonymous user', userId.slice(0, 8) + '...');

  const quiz = BUILT_IN_QUIZZES['quiz-1'];
  // Quiz 1: miss both cold-start questions and one pricing question
  const wrongIds = new Set(['l3', 'l4', 'l6']);
  const answers = Object.fromEntries(quiz.questions.map((q) => [q.id, wrongIds.has(q.id) ? (q.correctAnswerIndex + 1) % 4 : q.correctAnswerIndex]));
  const attempt1 = buildQuizResult(quiz, 'quiz-1', answers, 95, 'text', '/quiz/quiz-1');

  const [p1, p1dup] = await Promise.all([processQuizAttempt(attempt1), processQuizAttempt(attempt1)]); // StrictMode-style double call
  console.log('\nQuiz 1 ->', p1.skillError ?? 'skill OK', '|', p1.cardsError ?? `${p1.cardsCreated} cards`, '| attempt saved:', p1.attemptSaved);
  console.log('  double call returned same promise:', p1 === p1dup);
  if (p1.skill) {
    const s = p1.skill.updated;
    console.log(`  confidence ${p1.skill.previous.confidence} -> ${s.confidence} | quizzes ${s.quizzesTaken} | ${s.correctAnswers}/${s.totalAnswers}`);
    console.log('  weak spots:', s.weakSpots, '| changes:', p1.skill.changes.map((c) => `${c.concept} ${c.before ?? 'new'}->${c.after}`).join('; '));
  }

  // Quiz 2: all correct
  const allRight = Object.fromEntries(quiz.questions.map((q) => [q.id, q.correctAnswerIndex]));
  const p2 = await processQuizAttempt(buildQuizResult(quiz, 'quiz-1', allRight, 60, 'voice', '/voice-quiz'));
  if (p2.skill) {
    const s = p2.skill.updated;
    console.log(`\nQuiz 2 -> confidence ${p2.skill.previous.confidence} -> ${s.confidence} (want 85 = 0.7x100 + 0.3x50) | weak spots: ${JSON.stringify(s.weakSpots)}`);
    console.log('  changes:', p2.skill.changes.map((c) => `${c.concept} ${c.before}->${c.after}`).join('; '));
  } else console.log('\nQuiz 2 ->', p2.skillError);

  // FSRS: due cards, review one (DB round trip)
  const due = await getDueCardsFromDatabase(userId, 20);
  console.log(`\nFSRS: ${due.length} due cards (want 3)`);
  if (due[0]) {
    const r = await reviewCardComplete(due[0], Rating.Good, userId, 12);
    console.log(`  reviewed Good -> next review in ${r.intervalDays} day(s), state ${r.state}`);
    const after = await getDueCardsFromDatabase(userId, 20);
    console.log(`  due after review: ${after.length} (want 2)`);
  }

  // Study guides (needs the 20261103 policy migration)
  try {
    const id = await saveStudyGuide(
      { topic: 'Test', title: 'E2E guide', summary: 's', keyPoints: ['k'], prerequisites: [], learningObjectives: [], difficulty: 'beginner', estimatedStudyTimeMinutes: 5, sourceDocuments: [] } as any,
      userId
    );
    await saveFlashcards([{ front: 'Q', back: 'A', topic: 'Test' }], id, userId);
    const guides = await fetchStudyGuides(userId);
    console.log(`\nStudy guides: saved + read back ${guides.length} (want 1)`);
  } catch (e: any) {
    console.log('\nStudy guides: FAILED ->', e?.message ?? e);
  }

  // Jobs + replan log
  try {
    await createJobApplication(userId, { job_title: 'PM', company: 'Monzo', description: 'Product role' });
    console.log('Jobs: pipeline count', (await getJobStats(userId)).total, '(want 1)');
  } catch (e: any) {
    console.log('Jobs: FAILED ->', e?.message ?? e);
  }
  const log = await saveReplanLog({ userId, trigger: 'only 20min tonight', beforeSchedule: {}, afterSchedule: {}, durationMs: 1, changesSummary: 'test' });
  console.log('Replan log saved:', !!log);

  await supabase.auth.signOut();
}
