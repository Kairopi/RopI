/**
 * The one shape every quiz (text or voice) hands to the results page.
 * QuizResults turns it into skill updates, FSRS cards and a quiz_attempts row.
 */

import type { Quiz, QuestionSource } from './quiz-generator';

export interface AnsweredQuestion {
  questionId: string;
  question: string;
  concept: string;
  options: string[];
  correctAnswerIndex: number;
  /** -1 when not answered */
  selectedIndex: number;
  correct: boolean;
  explanation: string;
  /** What the speech recognizer heard (voice mode only) */
  voiceInput?: string;
  /** The passage from your notes this question was written from */
  source?: QuestionSource;
}

export interface QuizResultState {
  /** Unique per attempt: lets the results page process each attempt exactly once */
  attemptId: string;
  quizId: string;
  quizTitle: string;
  topic: string;
  mode: 'text' | 'voice';
  timeElapsed: number;
  answers: AnsweredQuestion[];
  /** Route that restarts this same quiz (keeps ?topic=&focus= for generated quizzes) */
  retakePath: string;
  /** Set when every question came from one of your documents */
  sourceId?: string;
}

export function buildQuizResult(
  quiz: Quiz,
  quizId: string,
  selected: Map<string, number> | Record<string, number>,
  timeElapsed: number,
  mode: 'text' | 'voice',
  retakePath: string,
  voiceInputs: Record<string, string> = {}
): QuizResultState {
  const pick = (id: string) =>
    selected instanceof Map ? selected.get(id) : (selected as Record<string, number>)[id];

  return {
    attemptId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    quizId,
    quizTitle: quiz.title,
    topic: quiz.topic,
    mode,
    timeElapsed,
    retakePath,
    sourceId: quiz.questions.length && quiz.questions.every((q) => q.source) ? quiz.questions[0].source!.sourceId : undefined,
    answers: quiz.questions.map((q) => {
      const selectedIndex = pick(q.id) ?? -1;
      return {
        questionId: q.id,
        question: q.question,
        concept: q.concept || quiz.topic,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
        selectedIndex,
        correct: selectedIndex === q.correctAnswerIndex,
        explanation: q.explanation,
        voiceInput: voiceInputs[q.id],
        source: q.source,
      };
    }),
  };
}
