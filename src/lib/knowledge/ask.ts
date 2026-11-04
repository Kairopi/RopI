/**
 * Ask Ropi: answers from YOUR history and YOUR notes, with citations.
 *
 * Khoj's core idea (github.com/khoj-ai/khoj): your knowledge should be an
 * active resource, and answers should come from it, not generic AI. Ropi
 * retrieves evidence first, then Meta Muse answers using only that evidence:
 *
 *   H  quiz history per concept      (concept_stats: "Lambda cold starts 0/2")
 *   Q  recent quiz attempts          (quiz_attempts)
 *   C  your review cards             (concept_cards: the questions you missed)
 *   N  passages from your documents  (source_chunks, Postgres full-text search)
 *   P  your plan this week           (passed in: next blocks, at-risk tasks)
 *
 * Every citation in the answer must point at evidence we actually retrieved.
 * Unknown ids are stripped, so the UI never shows a citation that isn't real.
 */

import { supabase } from '@/lib/supabase';
import { callMuse, isMuseConfigured, MUSE_MODELS } from '@/lib/api/muse';
import { sourcesMissing, markSourcesMissing } from '@/lib/documents/sources';

export type EvidenceKind = 'history' | 'attempt' | 'card' | 'note' | 'plan';

export interface Evidence {
  id: string; // H1, Q1, C1, N1, P1
  kind: EvidenceKind;
  title: string;
  text: string;
  meta?: string;
  /** Concept/topic this is about, for follow-up actions */
  topic?: string;
  concept?: string;
  sourceId?: string;
  page?: number | null;
}

export interface PlanContext {
  goal?: string | null;
  upcoming: { title: string; when: string; minutes: number }[];
  atRisk: { title: string; reason: string }[];
}

export interface Answer {
  text: string;
  /** Evidence actually cited, in order of first mention */
  cited: Evidence[];
  /** Everything retrieved (shown when nothing was cited) */
  retrieved: Evidence[];
  /** One useful next step, derived from the cited evidence (not invented) */
  action: { label: string; href: string } | null;
  answeredBy: 'muse' | 'ropi';
  ms: number;
}

const STOP = new Set(
  'a an and are as at be but by can did do does for from had has have how i in is it its me my of on or so that the this to was what when where which who why will with you your about should tonight today week'.split(' ')
);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

/** Share of query words found in the text (0-1), with a light prefix match for plurals */
export function overlap(query: string[], text: string): number {
  if (!query.length) return 0;
  const words = new Set(tokens(text));
  const hits = query.filter((q) => words.has(q) || [...words].some((w) => w.length > 3 && (w.startsWith(q) || q.startsWith(w))));
  return hits.length / query.length;
}

const STRUGGLE = /\b(struggl|weak|wrong|miss|bad at|hard|difficult|gap|forget|forgot)/i;
const PLAN = /\b(tonight|today|tomorrow|week|plan|schedule|next|should i|do now|time)\b/i;

export async function retrieve(question: string, plan: PlanContext | null): Promise<Evidence[]> {
  const q = tokens(question);
  const wantsStruggles = STRUGGLE.test(question);
  const wantsPlan = PLAN.test(question);

  const [stats, attempts, cards, chunks] = await Promise.all([
    supabase.from('concept_stats').select('topic, concept, attempts, correct, accuracy, last_attempt_at').limit(300),
    supabase.from('quiz_attempts').select('topic, score, correct_answers, total_questions, weak_spots, quiz_mode, created_at').order('created_at', { ascending: false }).limit(12),
    supabase.from('concept_cards').select('topic, subtopic, question, answer, due_date').limit(200),
    q.length && !sourcesMissing
      ? supabase.rpc('search_chunks', { q: q.join(' OR '), p_source_id: null, k: 5 }).then((r) => (markSourcesMissing(r.error), r))
      : Promise.resolve({ data: [], error: null }),
  ]);

  const out: Evidence[] = [];

  // H: concept history. Struggle questions get the weakest concepts even without word overlap.
  const statRows = (stats.data ?? []) as any[];
  const rankedStats = statRows
    .map((r) => ({ r, s: overlap(q, `${r.topic} ${r.concept}`) + (wantsStruggles ? (100 - r.accuracy) / 200 : 0) }))
    .filter((x) => x.s > 0.15)
    .sort((a, b) => b.s - a.s || a.r.accuracy - b.r.accuracy)
    .slice(0, 5);
  rankedStats.forEach(({ r }, i) =>
    out.push({
      id: `H${i + 1}`,
      kind: 'history',
      title: `${r.concept} (${r.topic})`,
      text: `${r.correct} of ${r.attempts} correct across your quizzes (${Math.round(r.accuracy)}%).${r.accuracy < 50 && r.attempts >= 2 ? ' This is a weak spot.' : ''}`,
      meta: r.last_attempt_at ? `last tested ${new Date(r.last_attempt_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : undefined,
      topic: r.topic,
      concept: r.concept,
    })
  );

  // Q: recent attempts on matching topics (or all, for struggle questions)
  const attemptRows = (attempts.data ?? []) as any[];
  attemptRows
    .filter((a) => wantsStruggles || overlap(q, a.topic) > 0.3)
    .slice(0, 3)
    .forEach((a, i) =>
      out.push({
        id: `Q${i + 1}`,
        kind: 'attempt',
        title: `${a.topic} quiz${a.quiz_mode === 'voice' ? ' (voice)' : ''}`,
        text: `Scored ${a.score}% (${a.correct_answers}/${a.total_questions}).${a.weak_spots?.length ? ` Weak spots then: ${a.weak_spots.join(', ')}.` : ''}`,
        meta: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        topic: a.topic,
      })
    );

  // C: review cards made from questions you missed
  const cardRows = (cards.data ?? []) as any[];
  cardRows
    .map((c) => ({ c, s: overlap(q, `${c.topic} ${c.subtopic ?? ''} ${c.question} ${c.answer}`) }))
    .filter((x) => x.s >= 0.34)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .forEach(({ c }, i) =>
      out.push({
        id: `C${i + 1}`,
        kind: 'card',
        title: c.subtopic || c.topic,
        text: `You missed: "${c.question}" Answer: ${String(c.answer).slice(0, 400)}`,
        meta: new Date(c.due_date) <= new Date() ? 'review due now' : `next review ${new Date(c.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        topic: c.topic,
        concept: c.subtopic ?? undefined,
      })
    );

  // N: passages from your documents (needs the sources migration; quietly skipped otherwise)
  const chunkRows = (!chunks.error ? chunks.data ?? [] : []) as any[];
  if (chunkRows.length) {
    const ids = [...new Set(chunkRows.map((c) => c.source_id))];
    const { data: srcs } = await supabase.from('sources').select('id, title, topic').in('id', ids);
    const byId = new Map((srcs ?? []).map((s: any) => [s.id, s]));
    chunkRows.slice(0, 4).forEach((c, i) => {
      const s = byId.get(c.source_id);
      out.push({
        id: `N${i + 1}`,
        kind: 'note',
        title: s?.title ?? 'Your document',
        text: String(c.content).slice(0, 900),
        meta: c.page ? `page ${c.page}` : undefined,
        topic: s?.topic ?? s?.title,
        sourceId: c.source_id,
        page: c.page,
      });
    });
  }

  // P: the plan, when the question is about time
  if (plan && (wantsPlan || !out.length)) {
    if (plan.goal) out.push({ id: 'P1', kind: 'plan', title: 'Your goal', text: plan.goal });
    if (plan.upcoming.length)
      out.push({
        id: `P${out.filter((e) => e.kind === 'plan').length + 1}`,
        kind: 'plan',
        title: 'Coming up in your plan',
        text: plan.upcoming.map((u) => `${u.when}: ${u.title} (${u.minutes} min)`).join('; '),
      });
    if (plan.atRisk.length)
      out.push({
        id: `P${out.filter((e) => e.kind === 'plan').length + 1}`,
        kind: 'plan',
        title: "Doesn't fit this week",
        text: plan.atRisk.map((r) => `${r.title}: ${r.reason}`).join('; '),
      });
  }

  return out;
}

/** Keep only citations to evidence we retrieved; drop the rest from the text */
export function verifyCitations(text: string, evidence: Evidence[]): { text: string; cited: Evidence[] } {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const cited: Evidence[] = [];
  const clean = text.replace(/\[([A-Z]\d{1,2}(?:\s*,\s*[A-Z]\d{1,2})*)\]/g, (_, group: string) => {
    const ids = group.split(/\s*,\s*/).filter((id) => byId.has(id));
    ids.forEach((id) => !cited.includes(byId.get(id)!) && cited.push(byId.get(id)!));
    return ids.length ? `[${ids.join(', ')}]` : '';
  });
  return { text: clean.replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim(), cited };
}

function nextStep(cited: Evidence[], retrieved: Evidence[]): Answer['action'] {
  const pool = cited.length ? cited : retrieved;
  const weak = pool.find((e) => (e.kind === 'history' || e.kind === 'card') && e.concept && e.topic);
  if (weak) return { label: `Practice ${weak.concept}`, href: `/quiz/new?topic=${encodeURIComponent(weak.topic!)}&focus=${encodeURIComponent(weak.concept!)}` };
  const note = pool.find((e) => e.kind === 'note' && e.sourceId);
  if (note) return { label: `Quiz me on "${note.title}"`, href: `/quiz/new?source=${note.sourceId}` };
  if (pool.some((e) => e.kind === 'card' && e.meta === 'review due now')) return { label: 'Review due cards', href: '/reviews' };
  return null;
}

/** Plain answer without Muse: lists the strongest evidence, honestly */
function fallbackAnswer(evidence: Evidence[]): string {
  if (!evidence.length) return '';
  return evidence
    .slice(0, 3)
    .map((e) => `${e.title}: ${e.text.slice(0, 160)} [${e.id}]`)
    .join(' ');
}

export async function askRopi(question: string, plan: PlanContext | null): Promise<Answer> {
  const t0 = performance.now();
  const evidence = await retrieve(question, plan);

  if (!evidence.length) {
    return {
      text: "I don't have anything of yours on that yet. Take a quiz on it or upload your notes, and I'll answer from them.",
      cited: [],
      retrieved: [],
      action: null,
      answeredBy: 'ropi',
      ms: Math.round(performance.now() - t0),
    };
  }

  let raw = '';
  let answeredBy: Answer['answeredBy'] = 'muse';
  if (isMuseConfigured()) {
    try {
      const block = evidence.map((e) => `[${e.id}] ${e.title}${e.meta ? ` (${e.meta})` : ''}: ${e.text}`).join('\n');
      const out = await callMuse(
        `Answer the user's question using ONLY the evidence below. It is their own quiz history, review cards, notes and plan.

Rules:
- Cite every claim with the evidence id in square brackets, e.g. [H1] or [N2, C1].
- If the evidence doesn't answer it, say so in one sentence. Never use outside facts.
- Talk to them directly ("you"). Be specific: name concepts, numbers and dates from the evidence.
- At most 90 words. Plain text, no markdown, no lists.

Return ONLY JSON: {"answer": "..."}

EVIDENCE:
${block}

QUESTION: ${question.slice(0, 400)}`,
        { model: MUSE_MODELS.fast, reasoningEffort: 'low', json: true, maxTokens: 3000, timeoutMs: 30000 }
      );
      raw = String(JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? out).answer ?? '');
    } catch (e) {
      console.warn('Ask Ropi: Muse failed, using evidence directly', e);
    }
  }
  if (!raw.trim()) {
    raw = fallbackAnswer(evidence);
    answeredBy = 'ropi';
  }

  const { text, cited } = verifyCitations(raw, evidence);
  return { text, cited, retrieved: evidence, action: nextStep(cited, evidence), answeredBy, ms: Math.round(performance.now() - t0) };
}
