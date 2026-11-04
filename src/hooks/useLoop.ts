/**
 * useLoop - what the learning and job loops say needs time this week.
 *
 * Reads real Supabase data (due FSRS cards, weak spots from quiz history,
 * job applications) and turns it into planner tasks:
 *   - cards due      -> "Review 6 cards" (about 20 s per card)
 *   - weak spot      -> "Practice: Lambda cold starts" (Muse writes the quiz)
 *   - job deadline   -> "Apply: Monzo, Product Manager" before it closes
 *   - interview date -> "Prep interview: Monzo"
 * So finishing a quiz or adding a job visibly changes the week.
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { getAllSkillLevels } from '@/lib/learning/skill-tracker';
import { sourcesMissing, markSourcesMissing } from '@/lib/documents/sources';
import type { Task } from '@/lib/scheduling/types';

interface LoopJob {
  id: string;
  company: string;
  job_title: string;
  status: string;
  deadline?: string | null;
  interview_date?: string | null;
  ats_score?: number | null;
}

interface LoopState {
  loadedFor: string | null;
  loading: boolean;
  dueCards: number;
  weakSpots: { topic: string; concept: string }[];
  jobs: LoopJob[];
  sources: { id: string; title: string; topic: string | null }[];
  refresh: (userId: string) => Promise<void>;
}

const OPEN_JOB = new Set(['discovered', 'scored', 'tailored', 'reviewed', 'approved']);

export const useLoop = create<LoopState>()((set) => ({
  loadedFor: null,
  loading: false,
  dueCards: 0,
  weakSpots: [],
  jobs: [],
  sources: [],

  refresh: async (userId) => {
    if (!userId) return;
    set({ loading: true });
    try {
      const nowIso = new Date().toISOString();
      const [cards, skills, jobs, sources] = await Promise.all([
        supabase.from('concept_cards').select('id', { count: 'exact', head: true }).eq('user_id', userId).lte('due_date', nowIso),
        getAllSkillLevels(userId).catch(() => []),
        supabase.from('job_applications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
        sourcesMissing
          ? Promise.resolve({ data: [], error: null })
          : supabase.from('sources').select('id, title, topic').eq('user_id', userId).limit(50).then((r) => (markSourcesMissing(r.error), r)),
      ]);
      set({
        loadedFor: userId,
        loading: false,
        dueCards: cards.count ?? 0,
        weakSpots: skills.flatMap((s) => s.weakSpots.slice(0, 1).map((concept) => ({ topic: s.topic, concept }))).slice(0, 2),
        jobs: (jobs.data ?? []) as LoopJob[],
        sources: (sources.data ?? []) as LoopState['sources'],
      });
    } catch (error) {
      console.warn('Loop refresh failed:', error);
      set({ loading: false, loadedFor: userId });
    }
  },
}));

function tonight(now: Date, hhmm = '22:00'): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

function daysAhead(now: Date, days: number): Date {
  const d = tonight(now);
  d.setDate(d.getDate() + days);
  return d;
}

/** Planner tasks created by the loop */
export function loopTasks(state: Pick<LoopState, 'dueCards' | 'weakSpots' | 'jobs'> & { sources?: LoopState['sources'] }, now: Date = new Date()): Task[] {
  const tasks: Task[] = [];

  if (state.dueCards > 0) {
    const minutes = Math.max(5, Math.ceil((state.dueCards * 20) / 60 / 5) * 5);
    tasks.push({
      id: 'loop-reviews',
      title: `Review ${state.dueCards} card${state.dueCards === 1 ? '' : 's'}`,
      duration: minutes,
      priority: state.dueCards >= 10 ? 'P1' : 'P2',
      deadline: tonight(now),
      flexible: true,
      category: 'learning',
      tags: ['study'],
      source: 'reviews',
      href: '/reviews',
      why: `${state.dueCards} card${state.dueCards === 1 ? ' is' : 's are'} due. FSRS picked today because that's right before you'd forget them.`,
    });
  }

  for (const w of state.weakSpots) {
    // A weak spot found in a quiz on your own document is practised from that document
    const fromSource = state.sources?.find((s) => (s.topic || s.title).toLowerCase() === w.topic.toLowerCase());
    tasks.push({
      id: `loop-weak-${w.topic}-${w.concept}`,
      title: `Practice: ${w.concept}`,
      duration: 15,
      priority: 'P2',
      deadline: daysAhead(now, 2),
      flexible: true,
      category: 'learning',
      tags: ['study', 'focus'],
      source: 'weak-spot',
      href: fromSource
        ? `/quiz/new?source=${fromSource.id}&focus=${encodeURIComponent(w.concept)}`
        : `/quiz/new?topic=${encodeURIComponent(w.topic)}&focus=${encodeURIComponent(w.concept)}`,
      why: fromSource
        ? `Your quizzes show ${w.concept} under 50%. Practice is written from your document "${fromSource.title}".`
        : `Your quizzes show ${w.concept} under 50%. Meta Muse writes a 6-question quiz on just that.`,
    });
  }

  const open = state.jobs
    .filter((j) => OPEN_JOB.has(j.status))
    .filter((j) => j.deadline || j.status === 'tailored' || j.status === 'approved' || (j.ats_score ?? 0) >= 70)
    .slice(0, 4);
  for (const j of open) {
    const deadline = j.deadline ? new Date(j.deadline) : undefined;
    if (deadline && deadline <= now) continue;
    tasks.push({
      id: `loop-job-${j.id}`,
      title: `Apply: ${j.company}, ${j.job_title}`,
      duration: 30,
      priority: deadline ? 'P1' : 'P2',
      deadline,
      flexible: !deadline,
      category: 'career',
      tags: ['job', 'application'],
      source: 'job',
      href: '/jobs',
      why: deadline
        ? `Closes ${deadline.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.`
        : `ATS score ${j.ats_score ?? '–'}. Ready to send.`,
    });
  }

  for (const j of state.jobs.filter((x) => x.status === 'interviewing' && x.interview_date)) {
    const date = new Date(j.interview_date!);
    if (date <= now) continue;
    tasks.push({
      id: `loop-interview-${j.id}`,
      title: `Prep interview: ${j.company}`,
      duration: 45,
      priority: 'P1',
      deadline: date,
      flexible: true,
      category: 'career',
      source: 'job',
      href: '/jobs',
      why: `Interview ${date.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.`,
    });
  }

  return tasks;
}
