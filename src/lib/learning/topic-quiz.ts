/**
 * A quiz on any topic, written by Muse, fast.
 *
 * Same shape as the built-in quizzes: 3 concepts x 2 questions, so the skill
 * tracker can find weak spots after one attempt. With focusConcept, all 6
 * questions test that one concept from different angles.
 *
 * Speed (measured 2026-11-04, muse-spark-1.3): one call for 6 questions took
 * ~10 s at "low" reasoning, ~7.5 s at "minimal". So: name the 3 concepts first
 * (~2 s), then write each concept's 2 questions in parallel, and hand the quiz
 * over as soon as the first 2 are ready (~5 s) while the rest arrive.
 * Typing a topic on Learn starts this early (prefetch), so it's often ready
 * by the time you press Quiz me.
 */

import { callMuse, MUSE_MODELS } from '@/lib/api/muse';
import type { Quiz, QuizQuestion } from './quiz-generator';

const RULES = `Rules:
- Ask through short real situations where you can ("Your team is about to launch...", "A customer says..."), so it feels like work, not trivia.
- Plain words. One idea per question. Keep each question under 30 words and each option under 12.
- 4 options, exactly one correct; wrong options plausible, not silly.
- Explanation: 1-2 sentences in plain words saying why the right answer is right.
- Only facts you are confident are accurate.`;

const SHAPE = `Return ONLY a JSON object: {"concept": "short name of the concept (2-5 words)", "questions": [{"question": "", "options": ["", "", "", ""], "correctAnswerIndex": 0, "difficulty": "easy|medium|hard", "explanation": ""}]}`;

// Three different angles, so parallel calls don't write the same questions
const ANGLES = [
  'the core idea: what it is and why it matters at work.',
  'using it: a realistic situation where someone has to apply it.',
  'a common mistake or misunderstanding people have about it, and how to avoid it.',
];

function valid(raw: string, concept: string, start: number): QuizQuestion[] {
  let parsed: any;
  try {
    parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
  } catch {
    return [];
  }
  const named = concept || (typeof parsed?.concept === 'string' && parsed.concept.trim()) || 'Key ideas';
  return (Array.isArray(parsed?.questions) ? parsed.questions : [])
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
    .map((q: any, i: number) => ({
      id: `g${start + i + 1}`,
      question: q.question.trim(),
      options: q.options.map((o: string) => o.trim()),
      correctAnswerIndex: q.correctAnswerIndex,
      concept: named.trim().slice(0, 80),
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
    }));
}

const write = (topic: string, concept: string, ask: string, start: number) =>
  callMuse(`Write a multiple-choice quiz for a busy professional learning "${topic}".\n${ask}\n\n${RULES}\n\n${SHAPE}`, {
    model: MUSE_MODELS.fast,
    reasoningEffort: 'minimal',
    json: true,
    maxTokens: 2500,
    timeoutMs: 45000,
  }).then((raw) => valid(raw, concept, start));

async function concepts(topic: string): Promise<string[]> {
  try {
    const raw = await callMuse(
      `Name the 3 most important concepts for a busy professional learning "${topic}". Short names (2-5 words), distinct from each other. Return ONLY JSON {"concepts": ["", "", ""]}`,
      { model: MUSE_MODELS.fast, reasoningEffort: 'minimal', json: true, maxTokens: 600, timeoutMs: 20000 }
    );
    const list = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw).concepts;
    const clean = (Array.isArray(list) ? list : []).map((c: unknown) => String(c ?? '').trim()).filter(Boolean).slice(0, 3);
    if (clean.length === 3) return clean;
  } catch {
    // fall through
  }
  return [`${topic} basics`, `Using ${topic} at work`, `Common ${topic} mistakes`];
}

// ---------- jobs: one generation per topic, shared by prefetch and the quiz page ----------

export interface QuizJob {
  quiz: Quiz | null;
  expected: number;
  done: boolean;
  error: string | null;
  subscribe: (fn: () => void) => () => void;
}

const jobs = new Map<string, QuizJob & { startedAt: number; taken: boolean }>();
const keyOf = (topic: string, focus?: string) => `${topic.trim().toLowerCase()}|${(focus ?? '').trim().toLowerCase()}`;

function start(topic: string, focus?: string) {
  const cleanTopic = topic.trim().slice(0, 120);
  const listeners = new Set<() => void>();
  const job: QuizJob & { startedAt: number; taken: boolean } = {
    quiz: null,
    expected: 6,
    done: false,
    error: null,
    startedAt: Date.now(),
    taken: false,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const questions: QuizQuestion[] = [];
  const notify = () => listeners.forEach((l) => l());
  const add = (qs: QuizQuestion[]) => {
    if (!qs.length) return;
    // Ids stay unique and the order you see them in never changes
    for (const q of qs) questions.push({ ...q, id: `g${questions.length + 1}` });
    job.quiz = {
      id: 'generated',
      userId: '',
      topic: cleanTopic,
      title: focus ? `Practice: ${focus}` : `${cleanTopic} quiz`,
      difficulty: 'medium',
      timeLimit: 10,
      questions: [...questions],
      generatedFromSources: ['meta-muse'],
      createdAt: new Date(),
      expectedCount: job.expected,
    };
    notify();
  };

  void (async () => {
    try {
      const parts: Promise<QuizQuestion[]>[] = focus
        ? [
            write(cleanTopic, focus, `All 3 questions test "${focus}": what it is, and how it shows up in a real situation.`, 0),
            write(cleanTopic, focus, `All 3 questions test "${focus}": a common mistake people make with it, an edge case, and a "which would you do" choice.`, 3),
          ]
        : // Three angles in parallel, no planning call first: the first two questions arrive after one call
          ANGLES.map((a, i) => write(cleanTopic, '', `Write exactly 2 questions on one concept: ${a} Name that concept.`, i * 2));
      // Each part lands as soon as it's written; a part that fails just means fewer questions
      await Promise.all(
        parts.map((p) =>
          p.then(add).catch(() => {
            job.expected -= focus ? 3 : 2;
            if (job.quiz) job.quiz = { ...job.quiz, expectedCount: Math.max(job.expected, job.quiz.questions.length) };
          })
        )
      );
      if (questions.length < 2) throw new Error('Muse didn’t return enough questions. Try again in a moment.');
      job.expected = questions.length;
      if (job.quiz) job.quiz = { ...job.quiz, expectedCount: questions.length };
    } catch (e) {
      job.error = e instanceof Error ? e.message : 'Could not write the quiz';
    } finally {
      job.done = true;
      notify();
    }
  })();
  return job;
}

/** Start writing a quiz early (e.g. while you type the topic). Safe to call often. */
export function prefetchTopicQuiz(topic: string, focus?: string) {
  if (topic.trim().length < 3) return;
  const k = keyOf(topic, focus);
  const j = jobs.get(k);
  if (j && !j.taken && !j.error && Date.now() - j.startedAt < 10 * 60_000) return;
  jobs.set(k, start(topic, focus));
}

/** The quiz for this topic: the prefetched one if there is one, otherwise a fresh one. Each job is used once, so a retake gets new questions. */
export function topicQuizJob(topic: string, focus?: string): QuizJob {
  const k = keyOf(topic, focus);
  let j = jobs.get(k);
  if (!j || j.error || Date.now() - j.startedAt > 10 * 60_000 || (j.taken && Date.now() - j.startedAt > 5000)) {
    j = start(topic, focus);
    jobs.set(k, j);
  }
  // Marked as used; the page opening twice in quick succession (React dev mode) shares it
  j.taken = true;
  return j;
}

/** One-shot version (waits for all questions) */
export function generateTopicQuiz(topic: string, focusConcept?: string): Promise<Quiz> {
  if (!topic.trim()) return Promise.reject(new Error('Please enter a topic'));
  const job = topicQuizJob(topic, focusConcept);
  return new Promise((resolve, reject) => {
    const check = () => {
      if (!job.done) return;
      off();
      if (job.quiz && job.quiz.questions.length >= 2) resolve({ ...job.quiz, expectedCount: undefined });
      else reject(new Error(job.error ?? 'Could not write the quiz'));
    };
    const off = job.subscribe(check);
    check();
  });
}
