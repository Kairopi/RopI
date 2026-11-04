/**
 * Real learning numbers for the signed-in user (Learning page + Dashboard).
 * Every value comes from Supabase; nothing is hardcoded.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getAllSkillLevels, type SkillLevel } from '@/lib/learning/skill-tracker';
import { formatDate } from '@/lib/scheduling/utils';

export interface QuizAttemptRow {
  id: string;
  topic: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  weak_spots: string[] | null;
  quiz_mode: string | null;
  created_at: string;
}

export interface LearningStats {
  dueNow: number;
  totalCards: number;
  reviewedToday: number;
  retentionRate: number | null; // null until there are reviews
  streakDays: number;
  skills: SkillLevel[];
  recentAttempts: QuizAttemptRow[];
}

const EMPTY: LearningStats = {
  dueNow: 0,
  totalCards: 0,
  reviewedToday: 0,
  retentionRate: null,
  streakDays: 0,
  skills: [],
  recentAttempts: [],
};

/** Consecutive local days with activity, ending today (or yesterday if nothing yet today) */
function computeStreak(timestamps: string[]): number {
  const days = new Set(timestamps.map((t) => formatDate(new Date(t))));
  const cursor = new Date();
  if (!days.has(formatDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(formatDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function useLearningStats(userId: string) {
  const [stats, setStats] = useState<LearningStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

      const [cards, reviews, attempts, skills] = await Promise.all([
        supabase.from('concept_cards').select('due_date').eq('user_id', userId),
        supabase.from('review_sessions').select('rating, created_at').eq('user_id', userId).gte('created_at', monthAgo),
        supabase
          .from('quiz_attempts')
          .select('id, topic, score, total_questions, correct_answers, weak_spots, quiz_mode, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30),
        getAllSkillLevels(userId),
      ]);

      if (cancelled) return;
      const firstError = cards.error || reviews.error || attempts.error;
      if (firstError) setError(firstError.message);

      const now = Date.now();
      const reviewRows = reviews.data ?? [];
      const attemptRows = (attempts.data ?? []) as QuizAttemptRow[];
      // ts-fsrs Rating: Again=1, Hard=2, Good=3, Easy=4. Good/Easy count as remembered.
      const remembered = reviewRows.filter((r) => r.rating === 3 || r.rating === 4).length;

      setStats({
        dueNow: (cards.data ?? []).filter((c) => new Date(c.due_date).getTime() <= now).length,
        totalCards: cards.data?.length ?? 0,
        reviewedToday: reviewRows.filter((r) => new Date(r.created_at) >= startOfToday).length,
        retentionRate: reviewRows.length ? Math.round((remembered / reviewRows.length) * 100) : null,
        streakDays: computeStreak([...attemptRows.map((a) => a.created_at), ...reviewRows.map((r) => r.created_at)]),
        skills,
        recentAttempts: attemptRows.slice(0, 5),
      });
      setLoading(false);
    })().catch((e) => {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { stats, loading, error };
}
