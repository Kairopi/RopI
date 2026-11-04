/**
 * Receipts: an append-only record of things that actually happened.
 *
 * Pattern adapted from OpenMuse (github.com/CopilotKit/openmuse, MIT,
 * (c) 2026 OpenMuse contributors): every action writes an activity entry,
 * and the UI never claims more than the record shows. Each receipt says how we
 * know it happened:
 *   system_recorded     Ropi did it or saw it (a replan, a saved quiz attempt)
 *   self_reported       you told Ropi ("I applied")
 *   external_confirmed  proof from outside (not used yet)
 *
 * Table: supabase-migrations/20261104_receipts_and_sources.sql. If it hasn't
 * been run, writes are skipped quietly and the Activity page says so.
 */

import { supabase } from '@/lib/supabase';

export type ReceiptDomain = 'plan' | 'study' | 'job';
export type Verification = 'system_recorded' | 'self_reported' | 'external_confirmed';

export interface Receipt {
  id: string;
  user_id: string;
  domain: ReceiptDomain;
  kind: string;
  actor: 'user' | 'ropi' | 'muse';
  verification: Verification;
  outcome: 'succeeded' | 'failed' | 'outcome_unknown';
  title: string;
  detail: string | null;
  subject_id: string | null;
  evidence: Record<string, unknown>;
  occurred_at: string;
}

export type NewReceipt = Omit<Receipt, 'id' | 'user_id' | 'occurred_at' | 'outcome' | 'detail' | 'subject_id' | 'evidence'> &
  Partial<Pick<Receipt, 'outcome' | 'detail' | 'subject_id' | 'evidence'>>;

let tableMissing = false;
const isMissing = (code?: string, message?: string) => code === 'PGRST205' || code === '42P01' || /could not find the table/i.test(message ?? '');

export async function recordReceipt(receipt: NewReceipt): Promise<boolean> {
  if (tableMissing) return false;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return false;
  const { error } = await supabase.from('receipts').insert({ ...receipt, user_id: userId, evidence: receipt.evidence ?? {} });
  if (error) {
    if (isMissing(error.code, error.message)) tableMissing = true;
    else console.warn('Receipt not saved:', error.message);
    return false;
  }
  return true;
}

export async function listReceipts(limit = 100): Promise<{ receipts: Receipt[]; available: boolean }> {
  const { data, error } = await supabase.from('receipts').select('*').order('occurred_at', { ascending: false }).limit(limit);
  if (error) {
    if (isMissing(error.code, error.message)) {
      tableMissing = true;
      return { receipts: [], available: false };
    }
    throw new Error(error.message);
  }
  return { receipts: (data ?? []) as Receipt[], available: true };
}

/**
 * History from before receipts existed: quiz attempts, review sessions and
 * applications are already stored in their own tables with timestamps, so we
 * show them too (skipping anything a receipt already covers). They are marked
 * as coming from those records, not as receipts.
 */
export async function listEarlierRecords(receipts: Receipt[], userId: string): Promise<Receipt[]> {
  const covered = new Set(receipts.map((r) => r.subject_id).filter(Boolean));
  const localDay = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const reviewedDays = new Set(receipts.filter((r) => r.kind === 'study.cards_reviewed').map((r) => localDay(r.occurred_at)));
  const base = { user_id: userId, outcome: 'succeeded' as const, verification: 'system_recorded' as const };

  const [quizzes, reviews, jobs] = await Promise.all([
    supabase
      .from('quiz_attempts')
      .select('id, topic, score, correct_answers, total_questions, quiz_mode, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('review_sessions').select('created_at, rating').eq('user_id', userId).order('created_at', { ascending: false }).limit(1000),
    supabase
      .from('job_applications')
      .select('id, company, job_title, applied_at, confirmation_id')
      .eq('user_id', userId)
      .not('applied_at', 'is', null)
      .limit(200),
  ]);

  const out: Receipt[] = [];
  const quizReceipts = receipts.filter((r) => r.kind === 'study.quiz_completed');
  for (const q of quizzes.data ?? []) {
    if (covered.has(q.id)) continue;
    // Receipts written before they carried the attempt's row id: same topic and score within 2 minutes
    if (
      quizReceipts.some(
        (r) => r.evidence?.topic === q.topic && r.evidence?.score === q.score && Math.abs(new Date(r.occurred_at).getTime() - new Date(q.created_at).getTime()) < 120_000
      )
    )
      continue;
    out.push({
      ...base,
      id: `quiz-${q.id}`,
      domain: 'study',
      kind: 'study.quiz_completed',
      actor: 'user',
      title: `${q.topic} quiz: ${q.score}%${q.quiz_mode === 'voice' ? ' (voice)' : ''}`,
      detail: `${q.correct_answers}/${q.total_questions} correct · from your saved quiz attempts`,
      subject_id: q.id,
      evidence: { topic: q.topic, score: q.score, correct: q.correct_answers, total: q.total_questions },
      occurred_at: q.created_at,
    });
  }

  // Reviews: one entry per local day, unless a receipt already covers that day
  const byDay = new Map<string, { at: string; ratings: number[] }>();
  for (const r of (reviews.data ?? []) as { created_at: string; rating: number }[]) {
    const key = localDay(r.created_at);
    const g: { at: string; ratings: number[] } = byDay.get(key) ?? { at: r.created_at, ratings: [] };
    g.ratings.push(r.rating);
    byDay.set(key, g);
  }
  for (const [day, g] of byDay) {
    if (reviewedDays.has(day)) continue;
    out.push({
      ...base,
      id: `reviews-${day}`,
      domain: 'study',
      kind: 'study.cards_reviewed',
      actor: 'user',
      title: `Reviewed ${g.ratings.length} card${g.ratings.length === 1 ? '' : 's'}`,
      detail: 'From your saved review history',
      subject_id: null,
      evidence: { count: g.ratings.length },
      occurred_at: g.at,
    });
  }

  for (const j of jobs.data ?? []) {
    if (covered.has(j.id)) continue;
    out.push({
      ...base,
      verification: 'self_reported',
      id: `applied-${j.id}`,
      domain: 'job',
      kind: 'job.applied',
      actor: 'user',
      title: `You applied to ${j.company}, ${j.job_title}`,
      detail: j.confirmation_id ? `Confirmation: ${j.confirmation_id}` : 'From your job list',
      subject_id: j.id,
      evidence: { company: j.company, role: j.job_title },
      occurred_at: j.applied_at,
    });
  }
  return out;
}
