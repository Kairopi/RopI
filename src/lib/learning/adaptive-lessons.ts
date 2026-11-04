/**
 * Adaptive Lesson Generator
 *
 * Based on research from:
 * - arXiv 2601.15551v1: Adaptive Learner Intelligence (target the weakest concept)
 * - PrepScholar: targeted weak-spot lessons with memory aids and practice
 * - EdisonOS: personalized learning paths
 *
 * Generates ONE focused lesson for the learner's weakest concept, grounded in
 * the exact questions they just got wrong. Uses Meta Muse (muse-spark-1.3).
 */

import { callMuse, MUSE_MODELS } from '@/lib/api/muse';
import type { SkillLevel, ConceptStats } from './skill-tracker';

// ===== TYPES =====

export interface AdaptiveLesson {
  topic: string;
  targetConcept: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  /** Why ROPI chose this lesson, e.g. "0% on Lambda cold starts (0 of 2)" */
  reason: string;

  title: string;
  explanation: string;
  memoryTricks: string[];
  examples: LessonExample[];
  keyTakeaways: string[];
  practiceExercises: PracticeExercise[];

  estimatedMinutes: number;
  generatedAt: Date;
}

export interface LessonExample {
  title: string;
  description: string;
  explanation: string;
}

export interface PracticeExercise {
  question: string;
  hint: string;
  answer: string;
  explanation: string;
}

/** A question the learner just missed (grounds the lesson in their real mistake) */
export interface MissedQuestion {
  question: string;
  chosen?: string;
  correct: string;
}

// ===== LESSON GENERATION =====

/**
 * Generate the next lesson for the weakest concept.
 * Returns null when there are no weak spots. Throws if Muse fails, so the UI
 * can show an honest error with a retry instead of a fake lesson.
 */
export async function generateNextLesson(
  topic: string,
  skillLevel: SkillLevel,
  conceptStats: ConceptStats[] = [],
  missed: MissedQuestion[] = [],
  targetOverride?: string
): Promise<AdaptiveLesson | null> {
  const targetConcept = targetOverride ?? skillLevel.weakSpots[0];
  if (!targetConcept) return null;

  const stat = conceptStats.find((c) => c.concept === targetConcept);
  const accuracy = stat?.accuracy ?? 0;
  const difficulty = determineDifficulty(skillLevel.confidence);
  const reason = stat
    ? `${Math.round(accuracy)}% on ${targetConcept} (${stat.correct} of ${stat.attempts} correct)`
    : `You missed questions on ${targetConcept}`;

  const raw = await callMuse(buildLessonPrompt(topic, targetConcept, difficulty, accuracy, missed), {
    model: MUSE_MODELS.fast,
    reasoningEffort: 'low',
    json: true,
    maxTokens: 8000,
    timeoutMs: 90000,
  });

  let parsed: any;
  try {
    parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
  } catch {
    throw new Error('Meta Muse returned the lesson in an unexpected format.');
  }

  // The UI shows plain text, so drop markdown emphasis (*word*, **word**, _word_, `code`)
  const plain = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1$2').replace(/`([^`]+)`/g, '$1').replace(/(^|\s)_(\S.*?)_(?=\s|[.,;:!?]|$)/g, '$1$2');
  const str = (v: unknown) => (typeof v === 'string' ? plain(v.trim()) : '');
  const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

  const lesson: AdaptiveLesson = {
    topic,
    targetConcept,
    difficulty,
    reason,
    title: str(parsed.title) || `Understanding ${targetConcept}`,
    explanation: str(parsed.explanation),
    memoryTricks: strList(parsed.memoryTricks),
    examples: (Array.isArray(parsed.examples) ? parsed.examples : [])
      .map((e: any) => ({ title: str(e?.title), description: str(e?.description), explanation: str(e?.explanation) }))
      .filter((e: LessonExample) => e.title || e.explanation),
    keyTakeaways: strList(parsed.keyTakeaways),
    practiceExercises: (Array.isArray(parsed.practiceExercises) ? parsed.practiceExercises : [])
      .map((p: any) => ({ question: str(p?.question), hint: str(p?.hint), answer: str(p?.answer), explanation: str(p?.explanation) }))
      .filter((p: PracticeExercise) => p.question && p.answer),
    estimatedMinutes: Number.isFinite(parsed.estimatedMinutes)
      ? Math.min(30, Math.max(3, Math.round(parsed.estimatedMinutes)))
      : 10,
    generatedAt: new Date(),
  };

  if (!lesson.explanation) {
    throw new Error('Meta Muse returned an empty lesson.');
  }
  return lesson;
}

/** Lower confidence = simpler lesson */
function determineDifficulty(confidence: number): 'beginner' | 'intermediate' | 'advanced' {
  if (confidence < 40) return 'beginner';
  if (confidence < 70) return 'intermediate';
  return 'advanced';
}

function buildLessonPrompt(
  topic: string,
  targetConcept: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced',
  currentAccuracy: number,
  missed: MissedQuestion[]
): string {
  const mistakes = missed.length
    ? `\nQUESTIONS THE STUDENT JUST GOT WRONG (address these misconceptions directly):\n${missed
        .slice(0, 4)
        .map(
          (m, i) =>
            `${i + 1}. "${m.question}"\n   Student chose: ${m.chosen ?? 'no answer'}\n   Correct answer: ${m.correct}`
        )
        .join('\n')}\n`
    : '';

  return `You are an expert tutor writing a short, focused lesson for one student.

SUBJECT: ${topic}
WEAK CONCEPT: ${targetConcept}
CURRENT ACCURACY ON THIS CONCEPT: ${Math.round(currentAccuracy)}%
LEVEL: ${difficulty}
${mistakes}
Write a lesson that fixes this specific gap. Be accurate; do not invent facts.
- explanation: 2 short paragraphs in plain language. Start from the misconception above if there is one.
- memoryTricks: 2-3 memorable mnemonics or rules of thumb.
- examples: 2 concrete, realistic examples.
- keyTakeaways: 3-4 one-line points.
- practiceExercises: 3 short questions (not copies of the ones above), each with a hint, answer and one-line explanation.

Return ONLY a JSON object:
{"title": "", "explanation": "", "memoryTricks": [""], "examples": [{"title": "", "description": "", "explanation": ""}], "keyTakeaways": [""], "practiceExercises": [{"question": "", "hint": "", "answer": "", "explanation": ""}], "estimatedMinutes": 10}`;
}
