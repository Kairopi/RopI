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
  const entries = [...byId.entries()];
  const fmt = (list: [string, Chunk][]) => list.map(([id, c]) => `[${id}]${c.page ? ` (page ${c.page})` : ''}\n${c.content}`).join('\n\n');

  // Three small calls at once (2 passages, 3 questions each, the best 2 kept) instead of one big
  // one: ~15 s -> ~6 s. Every quote is still checked against its passage.
  // A short document: the same passages, three different angles, so the calls don't repeat each other
  const ANGLES = ['the main facts and definitions it states', 'how the things it describes work or apply in practice', 'the details people are most likely to mix up'];
  const groups: [string, Chunk][][] = entries.length >= 3 ? [0, 1, 2].map((g) => entries.filter((_, i) => i % 3 === g)) : [entries, entries, entries];
  const perGroup = 3;
  let call = 0;
  const ask = (list: [string, Chunk][]) => `Write a multiple-choice quiz using ONLY the passages below from the user's own document "${source.title}".
${focusConcept ? `Every question must test "${focusConcept.slice(0, 120)}".` : entries.length >= 3 ? 'Cover the most important concept in these passages.' : `Ask only about ${ANGLES[call++ % 3]}.`}

Rules:
- ${perGroup} questions, 4 options each, exactly one correct.
- The correct answer must be stated in the passage. Do not use outside knowledge.
- For each question give "passage" (e.g. "P2") and "quote": 8-30 words copied EXACTLY, character for character, from that passage, that prove the correct answer.
- Wrong options must be plausible.
- concept: a 2-5 word name; questions on the same idea use the same name.
- explanation: one sentence on why the answer is right.

Return ONLY JSON:
{"title": "", "questions": [{"question": "", "options": ["", "", "", ""], "correctAnswerIndex": 0, "concept": "", "difficulty": "easy|medium|hard", "explanation": "", "passage": "P1", "quote": ""}]}

PASSAGES:
${fmt(list)}`;

  const t0 = performance.now();
  const results = await Promise.all(
    groups.map((g) =>
      callMuse(ask(g), { model: MUSE_MODELS.fast, reasoningEffort: 'minimal', json: true, maxTokens: 4000, timeoutMs: 60000 })
        .then((raw) => JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw))
        .catch(() => null)
    )
  );
  const parsed: any = results.find((r) => r?.title) ?? results.find(Boolean);
  if (!parsed) throw new Error('The quiz came back in a shape Ropi couldn’t read. Try again.');
  // Interleave the groups, so the 6 kept cover every part of the document
  const lists: any[][] = results.map((r) => (Array.isArray(r?.questions) ? r.questions : []));
  const candidates: any[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) for (const l of lists) if (l[i]) candidates.push(l[i]);
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

  console.info(`[quiz] document quiz written in ${Math.round(performance.now() - t0)} ms: ${questions.length} kept, ${dropped} dropped (quote not found)`);
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
