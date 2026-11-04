/**
 * Skill Tracking System
 *
 * Based on research from:
 * - Adaptive Learner Intelligence (arXiv 2601.15551v1): concept-level proficiency
 * - PrepScholar weak spot tracking
 * - EdisonOS skill-level analytics
 *
 * Tracks concept-level mastery and identifies weak spots.
 *
 * Rules:
 * - Confidence = 70% this quiz + 30% previous confidence (first quiz: just this quiz)
 * - Weak spot   = concept accuracy < 50% with at least 2 attempts
 * - Strong spot = concept accuracy > 85% with at least 3 attempts
 * Built-in quizzes ask 2 questions per concept, so one quiz can confirm a weak spot.
 */

import { supabase } from '@/lib/supabase';

// ===== TYPES =====

export interface SkillLevel {
  id?: string;
  user_id: string;
  topic: string;

  confidence: number; // 0-100
  quizzesTaken: number;
  correctAnswers: number;
  totalAnswers: number;
  accuracy: number; // overall %

  weakSpots: string[]; // weakest first
  strongSpots: string[];

  lastQuizAt: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface ConceptStats {
  concept: string;
  attempts: number;
  correct: number;
  accuracy: number; // %
  lastAttempt: Date | null;
  trend: 'improving' | 'stable' | 'declining';
}

/** How one concept moved because of this quiz (the evidence shown to the user) */
export interface ConceptChange {
  concept: string;
  before: number | null; // accuracy before this quiz (null = first time)
  after: number;
  thisQuiz: { correct: number; total: number };
}

export interface SkillUpdateResult {
  previous: SkillLevel;
  updated: SkillLevel;
  concepts: ConceptStats[];
  changes: ConceptChange[];
}

export const WEAK_SPOT_MAX_ACCURACY = 50;
export const WEAK_SPOT_MIN_ATTEMPTS = 2;
export const STRONG_SPOT_MIN_ACCURACY = 85;
export const STRONG_SPOT_MIN_ATTEMPTS = 3;

export const RECENT_WEIGHT = 0.7;
export const HISTORY_WEIGHT = 0.3;

// ===== PURE CALCULATIONS (unit-testable, no database) =====

export function calculateWeightedConfidence(
  recentScore: number,
  previousConfidence: number,
  previousQuizzes: number
): number {
  if (previousQuizzes === 0) return Math.round(recentScore);
  return Math.round(recentScore * RECENT_WEIGHT + previousConfidence * HISTORY_WEIGHT);
}

export function classifyConcepts(stats: ConceptStats[]): { weakSpots: string[]; strongSpots: string[] } {
  const sorted = [...stats].sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
  return {
    weakSpots: sorted
      .filter((c) => c.accuracy < WEAK_SPOT_MAX_ACCURACY && c.attempts >= WEAK_SPOT_MIN_ATTEMPTS)
      .map((c) => c.concept),
    strongSpots: sorted
      .filter((c) => c.accuracy > STRONG_SPOT_MIN_ACCURACY && c.attempts >= STRONG_SPOT_MIN_ATTEMPTS)
      .map((c) => c.concept)
      .reverse(),
  };
}

function emptySkill(userId: string, topic: string): SkillLevel {
  return {
    user_id: userId,
    topic,
    confidence: 0,
    quizzesTaken: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    accuracy: 0,
    weakSpots: [],
    strongSpots: [],
    lastQuizAt: null,
  };
}

function rowToSkill(row: any): SkillLevel {
  return {
    id: row.id,
    user_id: row.user_id,
    topic: row.topic,
    confidence: row.confidence,
    quizzesTaken: row.quizzes_taken,
    correctAnswers: row.correct_answers,
    totalAnswers: row.total_answers,
    accuracy: row.accuracy,
    weakSpots: row.weak_spots || [],
    strongSpots: row.strong_spots || [],
    lastQuizAt: row.last_quiz_at ? new Date(row.last_quiz_at) : null,
    created_at: row.created_at ? new Date(row.created_at) : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

function rowToConcept(row: any, trend: ConceptStats['trend'] = 'stable'): ConceptStats {
  return {
    concept: row.concept,
    attempts: row.attempts,
    correct: row.correct,
    accuracy: row.accuracy,
    lastAttempt: row.last_attempt_at ? new Date(row.last_attempt_at) : null,
    trend,
  };
}

// ===== MAIN UPDATE =====

/**
 * Update skill level from one quiz attempt.
 * Throws if the database rejects a write (so the UI can show a real error).
 */
export async function updateSkillLevel(
  userId: string,
  topic: string,
  quizResults: Array<{ concept: string; correct: boolean }>
): Promise<SkillUpdateResult> {
  if (quizResults.length === 0) throw new Error('No answers to score');

  const previous = await getSkillLevel(userId, topic);
  const now = new Date().toISOString();

  // 1. Tally this quiz per concept
  const tally = new Map<string, { correct: number; total: number }>();
  for (const r of quizResults) {
    const concept = (r.concept || topic).trim();
    const t = tally.get(concept) ?? { correct: 0, total: 0 };
    t.total++;
    if (r.correct) t.correct++;
    tally.set(concept, t);
  }

  // 2. Merge with stored concept stats (one read, one batched upsert)
  const { data: existingRows, error: readError } = await supabase
    .from('concept_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('topic', topic);
  if (readError) throw new Error(`Could not read concept stats: ${readError.message}`);

  const existing = new Map((existingRows ?? []).map((r: any) => [r.concept, r]));
  const changes: ConceptChange[] = [];
  const upserts = Array.from(tally.entries()).map(([concept, t]) => {
    const old = existing.get(concept);
    const attempts = (old?.attempts ?? 0) + t.total;
    const correct = (old?.correct ?? 0) + t.correct;
    const accuracy = Math.round((correct / attempts) * 1000) / 10;
    changes.push({
      concept,
      before: old ? old.accuracy : null,
      after: accuracy,
      thisQuiz: { correct: t.correct, total: t.total },
    });
    return {
      user_id: userId,
      topic,
      concept,
      attempts,
      correct,
      accuracy,
      last_attempt_at: now,
      updated_at: now,
    };
  });

  const { error: upsertError } = await supabase
    .from('concept_stats')
    .upsert(upserts, { onConflict: 'user_id,topic,concept' });
  if (upsertError) throw new Error(`Could not save concept stats: ${upsertError.message}`);

  // 3. Full concept list after the update (untouched concepts keep their stats)
  const changeByConcept = new Map(changes.map((c) => [c.concept, c]));
  const concepts: ConceptStats[] = [
    ...upserts.map((u) => {
      const ch = changeByConcept.get(u.concept)!;
      const trend: ConceptStats['trend'] =
        ch.before === null ? 'stable' : ch.after > ch.before ? 'improving' : ch.after < ch.before ? 'declining' : 'stable';
      return rowToConcept(u, trend);
    }),
    ...(existingRows ?? []).filter((r: any) => !tally.has(r.concept)).map((r: any) => rowToConcept(r)),
  ].sort((a, b) => a.accuracy - b.accuracy);

  // 4. Weak/strong spots and weighted confidence
  const { weakSpots, strongSpots } = classifyConcepts(concepts);
  const correctCount = quizResults.filter((r) => r.correct).length;
  const recentScore = (correctCount / quizResults.length) * 100;
  const totalAnswers = previous.totalAnswers + quizResults.length;
  const correctAnswers = previous.correctAnswers + correctCount;

  const updated: SkillLevel = {
    user_id: userId,
    topic,
    confidence: calculateWeightedConfidence(recentScore, previous.confidence, previous.quizzesTaken),
    quizzesTaken: previous.quizzesTaken + 1,
    correctAnswers,
    totalAnswers,
    accuracy: Math.round((correctAnswers / totalAnswers) * 1000) / 10,
    weakSpots,
    strongSpots,
    lastQuizAt: new Date(now),
  };

  const { error: skillError } = await supabase.from('skill_levels').upsert(
    {
      user_id: userId,
      topic,
      confidence: updated.confidence,
      quizzes_taken: updated.quizzesTaken,
      correct_answers: updated.correctAnswers,
      total_answers: updated.totalAnswers,
      accuracy: updated.accuracy,
      weak_spots: updated.weakSpots,
      strong_spots: updated.strongSpots,
      last_quiz_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id,topic' }
  );
  if (skillError) throw new Error(`Could not save skill level: ${skillError.message}`);

  return { previous, updated, concepts, changes };
}

// ===== READS =====

export async function getSkillLevel(userId: string, topic: string): Promise<SkillLevel> {
  const { data, error } = await supabase
    .from('skill_levels')
    .select('*')
    .eq('user_id', userId)
    .eq('topic', topic)
    .maybeSingle();

  if (error) throw new Error(`Could not read skill level: ${error.message}`);
  return data ? rowToSkill(data) : emptySkill(userId, topic);
}

export async function getConceptStats(userId: string, topic: string): Promise<ConceptStats[]> {
  const { data, error } = await supabase
    .from('concept_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('topic', topic)
    .order('accuracy', { ascending: true });

  if (error) throw new Error(`Could not read concept stats: ${error.message}`);
  return (data ?? []).map((r) => rowToConcept(r));
}

export async function getAllSkillLevels(userId: string): Promise<SkillLevel[]> {
  const { data, error } = await supabase
    .from('skill_levels')
    .select('*')
    .eq('user_id', userId)
    .order('last_quiz_at', { ascending: false });

  if (error) {
    console.error('Failed to get all skill levels:', error);
    return [];
  }
  return (data ?? []).map(rowToSkill);
}
