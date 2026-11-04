/**
 * A quiz written from your own document, where every question proves where it
 * came from.
 *
 * Meta Muse gets numbered passages and must return, per question, the passage
 * id and a short verbatim quote that supports the correct answer. We then check
 * the quote really is in that passage (whitespace and quote marks normalised).
 * Questions that fail the check are dropped, never shown.
 */

import { callMuse, MUSE_MODELS } from '@/lib/api/muse';
import { getSource, normalizeText, pickChunks, type Chunk } from '@/lib/documents/sources';
import type { Quiz, QuizQuestion } from './quiz-generator';

export interface SourceQuizStats {
  asked: number;
  kept: number;
  droppedUnverified: number;
}

/** The quote check, exported for tests */
export function quoteIsInChunk(quote: string, chunk: string): boolean {
  const q = normalizeText(quote).replace(/^["'.\s]+|["'.\s]+$/g, '');
  return q.split(' ').length >= 4 && normalizeText(chunk).includes(q);
}

export async function generateSourceQuiz(sourceId: string, focusConcept?: string): Promise<Quiz & { stats: SourceQuizStats }> {
  const source = await getSource(sourceId);
  if (!source) throw new Error('That document was not found. It may have been deleted.');
  const chunks = await pickChunks(sourceId, focusConcept, 6);
  if (!chunks.length) throw new Error('This document has no readable text to quiz on.');

  const byId = new Map<string, Chunk>(chunks.map((c, i) => [`P${i + 1}`, c]));
  const passages = [...byId.entries()].map(([id, c]) => `[${id}]${c.page ? ` (page ${c.page})` : ''}\n${c.content}`).join('\n\n');

  const prompt = `Write a multiple-choice quiz using ONLY the passages below from the user's own document "${source.title}".
${focusConcept ? `Every question must test "${focusConcept.slice(0, 120)}".` : 'Cover 3 different concepts from the passages, 2 questions each.'}

Rules:
- 6 questions, 4 options each, exactly one correct.
- The correct answer must be stated in the passage. Do not use outside knowledge.
- For each question give "passage" (e.g. "P2") and "quote": 8-30 words copied EXACTLY, character for character, from that passage, that prove the correct answer.
- Wrong options must be plausible.
- concept: a 2-5 word name; questions on the same idea use the same name.
- explanation: one sentence on why the answer is right.

Return ONLY JSON:
{"title": "", "questions": [{"question": "", "options": ["", "", "", ""], "correctAnswerIndex": 0, "concept": "", "difficulty": "easy|medium|hard", "explanation": "", "passage": "P1", "quote": ""}]}

PASSAGES:
${passages}`;

  const raw = await callMuse(prompt, { model: MUSE_MODELS.fast, reasoningEffort: 'low', json: true, maxTokens: 9000, timeoutMs: 90000 });
  let parsed: any;
  try {
    parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
  } catch {
    throw new Error('Meta Muse returned the quiz in an unexpected format. Please try again.');
  }

  const candidates: any[] = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const questions: QuizQuestion[] = [];
  let dropped = 0;
  for (const q of candidates) {
    const wellFormed =
      typeof q?.question === 'string' &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every((o: unknown) => typeof o === 'string' && o.trim()) &&
      Number.isInteger(q.correctAnswerIndex) &&
      q.correctAnswerIndex >= 0 &&
      q.correctAnswerIndex < 4;
    const chunk = byId.get(String(q?.passage ?? '').trim().toUpperCase());
    if (!wellFormed || !chunk || typeof q.quote !== 'string' || !quoteIsInChunk(q.quote, chunk.content)) {
      dropped++;
      continue;
    }
    questions.push({
      id: `s${questions.length + 1}`,
      question: q.question.trim(),
      options: q.options.map((o: string) => o.trim()),
      correctAnswerIndex: q.correctAnswerIndex,
      concept: (focusConcept || q.concept || source.topic || source.title).toString().trim().slice(0, 80),
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
      source: {
        sourceId,
        chunkId: chunk.id,
        title: source.title,
        page: chunk.page,
        quote: q.quote.trim().replace(/^["']|["']$/g, ''),
      },
    });
    if (questions.length === 6) break;
  }

  if (questions.length < 3) {
    throw new Error(
      `Only ${questions.length} question${questions.length === 1 ? '' : 's'} could be checked against your document (${dropped} quoted text that isn't in it). Try again, or use a longer document.`
    );
  }

  return {
    id: `source-${sourceId}`,
    userId: '',
    topic: source.topic || source.title,
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim().slice(0, 80) : `${source.title} quiz`,
    difficulty: 'medium',
    timeLimit: 10,
    questions,
    generatedFromSources: [sourceId],
    createdAt: new Date(),
    stats: { asked: candidates.length, kept: questions.length, droppedUnverified: dropped },
  };
}
