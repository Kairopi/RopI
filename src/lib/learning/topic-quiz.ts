/**
 * Generate a quiz for any topic with Meta Muse.
 *
 * Same shape as the built-in quizzes: 3 concepts x 2 questions, so the skill
 * tracker can detect weak spots after one attempt. With focusConcept, every
 * question targets that one weak spot (used by "Practice" on a weak spot).
 */

import { callMuse, MUSE_MODELS } from '@/lib/api/muse';
import type { Quiz, QuizQuestion } from './quiz-generator';

export async function generateTopicQuiz(topic: string, focusConcept?: string): Promise<Quiz> {
  const cleanTopic = topic.trim().slice(0, 120);
  if (!cleanTopic) throw new Error('Please enter a topic');

  const scope = focusConcept
    ? `All 6 questions must test the single concept "${focusConcept.slice(0, 120)}" from different angles (definition, application, common mistake, edge case). Use "${focusConcept}" as the concept for every question.`
    : `Pick the 3 most important concepts of the topic. Write exactly 2 questions per concept (6 total). Give each concept a short name (2-5 words) and use exactly the same name on both of its questions.`;

  const prompt = `You are an expert instructor writing a multiple-choice quiz on "${cleanTopic}" for a working professional.

${scope}

Rules:
- 4 options per question, exactly one correct.
- Mix difficulty: easy, medium and hard.
- Wrong options must be plausible, not silly.
- Explanations: 1-2 sentences saying why the correct answer is right.
- Only include facts you are confident are accurate.

Return ONLY a JSON object:
{"title": "short quiz title", "questions": [{"question": "", "options": ["", "", "", ""], "correctAnswerIndex": 0, "concept": "", "difficulty": "easy|medium|hard", "explanation": ""}]}`;

  const raw = await callMuse(prompt, {
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
    throw new Error('Meta Muse returned a quiz in an unexpected format. Please try again.');
  }

  // Validate every question; drop broken ones rather than show them
  const questions: QuizQuestion[] = (Array.isArray(parsed?.questions) ? parsed.questions : [])
    .filter(
      (q: any) =>
        typeof q?.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every((o: unknown) => typeof o === 'string' && o.trim()) &&
        Number.isInteger(q.correctAnswerIndex) &&
        q.correctAnswerIndex >= 0 &&
        q.correctAnswerIndex < 4
    )
    .slice(0, 6)
    .map((q: any, i: number) => ({
      id: `g${i + 1}`,
      question: q.question.trim(),
      options: q.options.map((o: string) => o.trim()),
      correctAnswerIndex: q.correctAnswerIndex,
      concept: (focusConcept || q.concept || cleanTopic).toString().trim().slice(0, 80),
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
    }));

  if (questions.length < 3) {
    throw new Error('Meta Muse did not return enough valid questions. Please try again.');
  }

  return {
    id: 'generated',
    userId: '',
    topic: cleanTopic,
    title:
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim().slice(0, 80)
        : focusConcept
          ? `Practice: ${focusConcept}`
          : `${cleanTopic} Quiz`,
    difficulty: 'medium',
    timeLimit: 10,
    questions,
    generatedFromSources: ['meta-muse'],
    createdAt: new Date(),
  };
}
