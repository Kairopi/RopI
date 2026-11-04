/**
 * Turn one quiz attempt into persistent learning data:
 *   1. skill_levels + concept_stats  (skill tracker)
 *   2. concept_cards                 (FSRS review card per missed question)
 *   3. quiz_attempts                 (history / evidence)
 *
 * Each attempt is processed exactly once. React StrictMode mounts effects
 * twice in development, and a browser refresh replays the router state, so
 * results are de-duplicated in memory and cached in sessionStorage.
 */

import { supabase } from '@/lib/supabase';
import { updateSkillLevel, type SkillUpdateResult } from './skill-tracker';
import { extractConceptsFromQuiz, saveCardToDatabase } from './spaced-repetition';
import { generateNextLesson, type AdaptiveLesson } from './adaptive-lessons';
import type { QuizResultState } from './quiz-result';
import { recordReceipt } from '@/lib/receipts';

export interface ProcessedQuiz {
  skill: SkillUpdateResult | null;
  skillError: string | null;
  cardsCreated: number;
  cardsError: string | null;
  attemptSaved: boolean;
}

const inFlight = new Map<string, Promise<ProcessedQuiz>>();
const lessonsInFlight = new Map<string, Promise<AdaptiveLesson | null>>();
const cacheKey = (id: string, part: string) => `ropi-quiz-${part}:${id}`;

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or disabled: processing still worked, only refresh-safety is lost
  }
}

// Supabase errors are plain objects ({ message, code }), not Error instances
const message = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as any).message) : String(e);

export function processQuizAttempt(result: QuizResultState): Promise<ProcessedQuiz> {
  const cached = readCache<ProcessedQuiz>(cacheKey(result.attemptId, 'processed'));
  if (cached) return Promise.resolve(cached);

  const existing = inFlight.get(result.attemptId);
  if (existing) return existing;

  const run = (async (): Promise<ProcessedQuiz> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      return {
        skill: null,
        skillError: 'You are not signed in, so results could not be saved.',
        cardsCreated: 0,
        cardsError: null,
        attemptSaved: false,
      };
    }

    const out: ProcessedQuiz = { skill: null, skillError: null, cardsCreated: 0, cardsError: null, attemptSaved: false };

    // 1. Skill tracking (every answer, with its concept)
    try {
      out.skill = await updateSkillLevel(
        userId,
        result.topic,
        result.answers.map((a) => ({ concept: a.concept, correct: a.correct }))
      );
    } catch (e) {
      out.skillError = message(e);
    }

    // 2. FSRS review cards for missed questions
    const wrong = result.answers.filter((a) => !a.correct);
    if (wrong.length > 0) {
      try {
        const cards = await extractConceptsFromQuiz(
          result.topic,
          wrong.map((a) => ({
            question: a.question,
            correctAnswer: a.options[a.correctAnswerIndex],
            // A question written from your notes keeps the exact passage it came from
            explanation: a.source
              ? `${a.explanation ?? ''}\n\nFrom your notes (${a.source.title}${a.source.page ? `, p. ${a.source.page}` : ''}): "${a.source.quote}"`.trim()
              : a.explanation,
            isCorrect: false,
            options: a.options,
            correctAnswerIndex: a.correctAnswerIndex,
          }))
        );
        cards.forEach((card, i) => {
          card.subtopic = wrong[i].concept;
          card.sourceLesson = result.quizTitle;
        });
        await Promise.all(cards.map((card) => saveCardToDatabase(card, userId)));
        out.cardsCreated = cards.length;
      } catch (e) {
        out.cardsError = message(e);
      }
    }

    // 3. Attempt history
    const correct = result.answers.filter((a) => a.correct).length;
    const { data: attemptRow, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        user_id: userId,
        topic: result.topic,
        score: Math.round((correct / result.answers.length) * 100),
        total_questions: result.answers.length,
        correct_answers: correct,
        weak_spots: out.skill?.updated.weakSpots ?? [],
        time_taken_seconds: result.timeElapsed,
        quiz_mode: result.mode,
      })
      .select('id')
      .single();
    out.attemptSaved = !attemptError;
    if (attemptError) console.warn('Could not save quiz attempt:', attemptError.message);
    else {
      const score = Math.round((correct / result.answers.length) * 100);
      const sourced = result.answers.filter((a) => a.source).length;
      void recordReceipt({
        domain: 'study',
        kind: 'study.quiz_completed',
        actor: 'user',
        verification: 'system_recorded',
        title: `${result.topic} quiz: ${score}%${result.mode === 'voice' ? ' (voice)' : ''}`,
        detail: `${correct}/${result.answers.length} correct${out.cardsCreated ? `, ${out.cardsCreated} review cards made` : ''}${sourced ? `, ${sourced} questions quoted from your notes` : ''}`,
        // The saved attempt row, so History can tell this receipt and the attempt are the same quiz
        subject_id: attemptRow?.id ?? result.attemptId,
        evidence: {
          topic: result.topic,
          score,
          correct,
          total: result.answers.length,
          weakSpots: out.skill?.updated.weakSpots ?? [],
          cardsCreated: out.cardsCreated,
          mode: result.mode,
          sourceId: result.sourceId ?? null,
        },
      });
    }

    // Only cache full successes; failures can be retried by reloading
    if (!out.skillError && !out.cardsError) {
      writeCache(cacheKey(result.attemptId, 'processed'), out);
    }
    return out;
  })();

  inFlight.set(result.attemptId, run);
  run.finally(() => inFlight.delete(result.attemptId));
  return run;
}

/** Generate (once) the lesson for this attempt's weakest concept */
export function lessonForAttempt(
  result: QuizResultState,
  skill: SkillUpdateResult,
  targetConcept?: string
): Promise<AdaptiveLesson | null> {
  const target = targetConcept ?? skill.updated.weakSpots[0];
  if (!target) return Promise.resolve(null);

  const key = cacheKey(`${result.attemptId}:${target}`, 'lesson');
  const cached = readCache<AdaptiveLesson>(key);
  if (cached) return Promise.resolve(cached);

  const existing = lessonsInFlight.get(key);
  if (existing) return existing;

  const missed = result.answers
    .filter((a) => !a.correct && a.concept === target)
    .map((a) => ({
      question: a.question,
      chosen: a.selectedIndex >= 0 ? a.options[a.selectedIndex] : undefined,
      correct: a.options[a.correctAnswerIndex],
    }));

  const run = generateNextLesson(result.topic, skill.updated, skill.concepts, missed, target).then((lesson) => {
    if (lesson) writeCache(key, lesson);
    return lesson;
  });

  lessonsInFlight.set(key, run);
  run.finally(() => lessonsInFlight.delete(key));
  return run;
}
