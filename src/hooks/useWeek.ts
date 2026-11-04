/**
 * useWeek - the user's own week: when they're free, what they want done, their goal.
 *
 * This replaces the hardcoded persona the planner used to run on. The sample
 * week is still available, but only when the user picks it, and it is labelled
 * "Sample week" everywhere it shows.
 *
 * Stored in this browser (the account is an anonymous Supabase user that also
 * lives in this browser). ownerId stops a second account on the same browser
 * from seeing the first one's week.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AvailabilityWindow, Event, Task } from '@/lib/scheduling/types';
import { generateId } from '@/lib/scheduling/utils';
import { recordReceipt } from '@/lib/receipts';

export interface Goal {
  title: string;
  /** YYYY-MM-DD */
  targetDate?: string;
}

export interface WeekTask extends Omit<Task, 'deadline'> {
  /** ISO string (Dates don't survive JSON persistence) */
  deadline?: string;
  createdAt: string;
  doneAt?: string;
  /** Minutes it really took (set on check-in), for estimate accuracy */
  actualMinutes?: number;
  /** Minutes already worked when it was rolled over */
  workedMinutes?: number;
}

export type CheckInAction = 'done' | 'partly' | 'later' | 'drop';

interface WeekStore {
  ownerId: string | null;
  setupDone: boolean;
  isSample: boolean;
  goal: Goal | null;
  windows: AvailabilityWindow[];
  events: Event[];
  tasks: WeekTask[];
  /** Last slot the plan gave each of your tasks; once it has passed, Ropi asks how it went */
  slots: Record<string, { start: string; end: string }>;

  claim: (userId: string) => void;
  setGoal: (goal: Goal | null) => void;
  setWindows: (windows: AvailabilityWindow[]) => void;
  addTask: (task: Omit<WeekTask, 'id' | 'createdAt' | 'flexible' | 'source'> & Partial<Pick<WeekTask, 'flexible'>>) => string;
  removeTask: (id: string) => void;
  /** Busy time (a shift, a class): Ropi plans around it */
  addEvent: (event: Omit<Event, 'id' | 'isAllDay'>) => string;
  removeEvent: (id: string) => void;
  toggleDone: (id: string) => void;
  recordSlots: (slots: Record<string, { start: string; end: string }>) => void;
  checkIn: (id: string, action: CheckInAction, minutes?: number) => void;
  /** A quiz you finished ticks off the planned task that opens it (no extra History entry: the quiz has one) */
  completeByHref: (hrefs: string[], minutes: number) => number;
  finishSetup: () => void;
  loadSample: () => void;
  clear: () => void;
}

const EMPTY = {
  setupDone: false,
  isSample: false,
  goal: null,
  windows: [] as AvailabilityWindow[],
  events: [] as Event[],
  tasks: [] as WeekTask[],
  slots: {} as Record<string, { start: string; end: string }>,
};

/** Local date `days` ahead at HH:MM, as ISO */
function at(days: number, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** The demo persona: works shifts, studying for AWS, applying for PM roles */
function sampleWeek() {
  const now = new Date().toISOString();
  const task = (t: Omit<WeekTask, 'createdAt' | 'flexible' | 'source'>): WeekTask => ({
    ...t,
    flexible: true,
    source: 'sample',
    createdAt: now,
  });
  return {
    ...EMPTY,
    setupDone: true,
    isSample: true,
    goal: { title: 'Pass AWS Solutions Architect and land a PM role', targetDate: at(42, '09:00').slice(0, 10) },
    windows: [1, 2, 3, 4, 5]
      .map((day) => ({ day, startTime: '19:00', endTime: '21:00' }))
      .concat([
        { day: 6, startTime: '10:00', endTime: '13:00' },
        { day: 0, startTime: '14:00', endTime: '17:00' },
      ]),
    events: [
      { id: 'sample-gym', title: 'Gym class', startTime: at(2, '19:00'), endTime: at(2, '20:00'), isAllDay: false },
      { id: 'sample-mentor', title: 'Coffee with mentor', startTime: at(4, '19:00'), endTime: at(4, '20:00'), isAllDay: false },
    ],
    tasks: [
      task({ id: 'sample-apply', title: 'Apply: Monzo, Product Manager', duration: 30, priority: 'P1', deadline: at(3, '17:00'), category: 'career', href: '/jobs' }),
      task({ id: 'sample-tailor', title: 'Tailor resume for Monzo', duration: 20, priority: 'P2', deadline: at(3, '17:00'), category: 'career', href: '/jobs' }),
      task({ id: 'sample-vpc', title: 'Study VPC networking', duration: 45, priority: 'P2', deadline: at(5, '22:00'), category: 'learning', tags: ['study', 'focus'], href: '/quiz/quiz-2' }),
      task({ id: 'sample-lambda', title: 'AWS Lambda quiz', duration: 15, priority: 'P1', deadline: at(2, '22:00'), category: 'learning', tags: ['study', 'focus'], href: '/quiz/quiz-1' }),
      task({ id: 'sample-interview', title: 'Practice interview questions', duration: 30, priority: 'P3', category: 'career', href: '/jobs' }),
    ],
  };
}

export const useWeek = create<WeekStore>()(
  persist(
    (set) => ({
      ownerId: null,
      ...EMPTY,

      claim: (userId) =>
        set((s) => (s.ownerId === userId ? s : { ...EMPTY, ownerId: userId })),

      setGoal: (goal) => set({ goal }),
      setWindows: (windows) => set({ windows }),

      addTask: (input) => {
        const id = generateId();
        set((s) => ({
          tasks: [
            ...s.tasks,
            { flexible: true, ...input, id, source: 'you', createdAt: new Date().toISOString() },
          ],
        }));
        return id;
      },

      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addEvent: (input) => {
        const id = generateId();
        set((s) => ({ events: [...s.events, { ...input, id, isAllDay: false }] }));
        return id;
      },

      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      toggleDone: (id) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (task && !task.doneAt) {
            void recordReceipt({
              domain: 'plan',
              kind: 'plan.task_done',
              actor: 'user',
              verification: 'self_reported',
              title: `Done: ${task.title}`,
              detail: `${task.duration} min planned`,
              subject_id: id,
              evidence: { title: task.title, plannedMinutes: task.duration, category: task.category ?? null },
            });
          }
          return {
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, doneAt: t.doneAt ? undefined : new Date().toISOString() } : t)),
          };
        }),

      recordSlots: (next) =>
        set((s) => {
          const now = Date.now();
          const slots = { ...s.slots };
          let changed = false;
          for (const [id, slot] of Object.entries(next)) {
            const stored = slots[id];
            // Once a slot has started it is frozen (the plan always starts from "now", so an
            // in-progress task would otherwise keep sliding forward); you check in after it ends
            if (stored && new Date(stored.start).getTime() <= now) continue;
            if (!stored || stored.start !== slot.start || stored.end !== slot.end) {
              slots[id] = slot;
              changed = true;
            }
          }
          return changed ? { slots } : s;
        }),

      checkIn: (id, action, minutes) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          const { [id]: _gone, ...slots } = s.slots;
          if (!task) return { slots };
          if (action === 'drop') return { slots, tasks: s.tasks.filter((t) => t.id !== id) };
          if (action === 'later') return { slots };
          if (action === 'partly') {
            const worked = Math.max(5, Math.min(minutes ?? 15, task.duration - 5));
            return {
              slots,
              tasks: s.tasks.map((t) =>
                t.id === id ? { ...t, duration: Math.max(5, t.duration - worked), workedMinutes: (t.workedMinutes ?? 0) + worked } : t
              ),
            };
          }
          const actual = (task.workedMinutes ?? 0) + (minutes ?? task.duration);
          void recordReceipt({
            domain: 'plan',
            kind: 'plan.task_done',
            actor: 'user',
            verification: 'self_reported',
            title: `Done: ${task.title}`,
            detail: `Planned ${task.duration + (task.workedMinutes ?? 0)} min, took ${actual} min`,
            subject_id: id,
            evidence: { title: task.title, plannedMinutes: task.duration + (task.workedMinutes ?? 0), actualMinutes: actual },
          });
          return {
            slots,
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, doneAt: new Date().toISOString(), actualMinutes: actual } : t)),
          };
        }),

      completeByHref: (hrefs, minutes) => {
        const want = new Set(hrefs.map((h) => h.replace(/[?&]start=1$/, '')));
        let n = 0;
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.doneAt || !t.href || !want.has(t.href)) return t;
            n++;
            return { ...t, doneAt: new Date().toISOString(), actualMinutes: Math.max(1, Math.round(minutes)) };
          }),
        }));
        return n;
      },

      finishSetup: () => set({ setupDone: true }),
      loadSample: () => set((s) => ({ ...sampleWeek(), ownerId: s.ownerId })),
      clear: () => set((s) => ({ ...EMPTY, ownerId: s.ownerId })),
    }),
    { name: 'ropi-week-v1' }
  )
);

/** Open tasks in planner form (Date deadlines) */
export function openTasks(tasks: WeekTask[]): Task[] {
  return tasks
    .filter((t) => !t.doneAt)
    .map(({ createdAt: _c, doneAt: _d, deadline, ...rest }) => ({
      ...rest,
      deadline: deadline ? new Date(deadline) : undefined,
    }));
}
