/**
 * Demo schedule data for ROPI LifeShift
 *
 * Persona: a busy professional upskilling around a day job. Free time is
 * weekday evenings plus a block on each weekend day. All times are LOCAL.
 *
 * Demo story (each example constraint produces a visible change):
 * 1. "Manager added shift, only 20min tonight"  -> tonight shrinks to 20 min,
 *    tasks slide to tomorrow.
 * 2. "Dream job closes tomorrow at 5PM"         -> Monzo application deadline
 *    moves up; ROPI flags it if there isn't enough time before it closes.
 * 3. "Extra shift tomorrow 6PM-10PM"            -> tomorrow evening disappears,
 *    tasks move later in the week.
 */

import type { Task, Availability, Event, Constraint, FocusTime } from '../scheduling/types';
import { formatDate, roundUpMinutes, toHHMM } from '../scheduling/utils';

// Two realistic hours after work on weekdays
const WEEKDAY_EVENING = { startTime: '19:00', endTime: '21:00' };

// Free time: Mon-Fri evenings, Sat late morning, Sun afternoon
export const mockAvailability: Availability = {
  windows: [
    { day: 1, ...WEEKDAY_EVENING },
    { day: 2, ...WEEKDAY_EVENING },
    { day: 3, ...WEEKDAY_EVENING },
    { day: 4, ...WEEKDAY_EVENING },
    { day: 5, ...WEEKDAY_EVENING },
    { day: 6, startTime: '10:00', endTime: '13:00' },
    { day: 0, startTime: '14:00', endTime: '17:00' },
  ],
  overrides: [],
};

/** Local date `daysFromToday` days ahead, at HH:MM */
function localAt(daysFromToday: number, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(h, m, 0, 0);
  return d;
}

// Deadlines are computed when the page loads, relative to "now"
export const mockTasks: Task[] = [
  {
    id: 'task-6',
    title: 'Review cards',
    duration: 15,
    priority: 'P2',
    deadline: localAt(1, '22:00'),
    flexible: true,
    tags: ['study', 'review'],
    category: 'learning',
  },
  {
    id: 'task-1',
    title: 'AWS Lambda Quiz',
    duration: 15,
    priority: 'P1',
    deadline: localAt(2, '22:00'),
    flexible: false,
    tags: ['study', 'focus'],
    category: 'learning',
  },
  {
    id: 'task-2',
    title: 'Job Application - Monzo PM',
    duration: 30,
    priority: 'P1',
    deadline: localAt(3, '17:00'),
    flexible: false,
    tags: ['job', 'application'],
    category: 'career',
  },
  {
    id: 'task-3',
    title: 'Tailor Resume for Monzo',
    duration: 20,
    priority: 'P2',
    deadline: localAt(3, '17:00'),
    flexible: true,
    tags: ['job'],
    category: 'career',
  },
  {
    id: 'task-4',
    title: 'Study VPC Networking',
    duration: 45,
    priority: 'P2',
    deadline: localAt(5, '22:00'),
    flexible: true,
    tags: ['study', 'focus'],
    category: 'learning',
  },
  {
    id: 'task-5',
    title: 'Practice Interview Questions',
    duration: 30,
    priority: 'P3',
    flexible: true,
    tags: ['job', 'practice'],
    category: 'career',
  },
];

// Fixed calendar events that block free time
export const mockEvents: Event[] = [
  {
    id: 'event-1',
    title: 'Gym class',
    startTime: localAt(2, '19:00').toISOString(),
    endTime: localAt(2, '20:00').toISOString(),
    isAllDay: false,
  },
  {
    id: 'event-2',
    title: 'Coffee with Mentor',
    startTime: localAt(4, '19:00').toISOString(),
    endTime: localAt(4, '20:00').toISOString(),
    isAllDay: false,
  },
];

// Example constraints shown as one-click buttons in LifeShift
export const EXAMPLE_CONSTRAINTS = [
  'Manager added shift, only 20min tonight',
  'Dream job closes tomorrow at 5PM',
  'Extra shift tomorrow 6PM-10PM',
];

/** Windows that apply on a given local date (override, else weekly pattern) */
export function windowsForDate(availability: Availability, date: Date) {
  const dateStr = formatDate(date);
  const override = availability.overrides?.find((o) => o.date === dateStr);
  if (override) return override.windows;
  return availability.windows
    .filter((w) => w.day === date.getDay())
    .map(({ startTime, endTime }) => ({ startTime, endTime }));
}

function withOverride(
  availability: Availability,
  date: Date,
  windows: { startTime: string; endTime: string }[]
): Availability {
  const dateStr = formatDate(date);
  const others = (availability.overrides ?? []).filter((o) => o.date !== dateStr);
  return { ...availability, overrides: [...others, { date: dateStr, windows }] };
}

/**
 * Apply a constraint to availability (time-based constraints).
 * Returns a NEW availability; the weekly pattern is never mutated.
 */
export function applyConstraint(
  availability: Availability,
  constraint: Constraint,
  now: Date = new Date()
): Availability {
  switch (constraint.type) {
    case 'time_reduced': {
      const minutes = Math.max(5, constraint.availableMinutes ?? 0);
      const day = constraint.date ? new Date(constraint.date + 'T00:00:00') : new Date(now);
      const isToday = formatDate(day) === formatDate(now);
      const base = [...windowsForDate(availability, day)].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );
      const soonest = isToday ? toHHMM(roundUpMinutes(now)) : '00:00';

      // Keep only the first `minutes` of the free time still left that day.
      // This constraint can only take time away, never add it.
      let left = minutes;
      const kept: { startTime: string; endTime: string }[] = [];
      for (const w of base) {
        if (left <= 0) break;
        const s = w.startTime > soonest ? w.startTime : soonest;
        if (s >= w.endTime) continue;
        const [sh, sm] = s.split(':').map(Number);
        const [eh, em] = w.endTime.split(':').map(Number);
        const span = eh * 60 + em - (sh * 60 + sm);
        const take = Math.min(span, left);
        const endMin = sh * 60 + sm + take;
        kept.push({
          startTime: s,
          endTime: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
        });
        left -= take;
      }

      return withOverride(availability, day, kept);
    }

    case 'shift_conflict': {
      if (!constraint.conflictingShift) return availability;
      const shiftStart = new Date(constraint.conflictingShift.start);
      const shiftEnd = new Date(constraint.conflictingShift.end);
      const s = toHHMM(shiftStart);
      const e = toHHMM(shiftEnd);

      // Subtract the shift from that day's windows
      const remaining = windowsForDate(availability, shiftStart).flatMap((w) => {
        if (e <= w.startTime || s >= w.endTime) return [w]; // no overlap
        const parts: { startTime: string; endTime: string }[] = [];
        if (w.startTime < s) parts.push({ startTime: w.startTime, endTime: s });
        if (w.endTime > e) parts.push({ startTime: e, endTime: w.endTime });
        return parts;
      });

      return withOverride(availability, shiftStart, remaining);
    }

    case 'deadline_added':
    default:
      // Deadlines change tasks, not free time (see applyConstraintToTasks)
      return availability;
  }
}

/**
 * Apply a constraint to tasks (deadline-based constraints).
 * "Dream job closes tomorrow at 5PM" -> the job application task gets that
 * deadline and top priority. Returns the new task list and which task changed.
 */
export function applyConstraintToTasks(
  tasks: Task[],
  constraint: Constraint
): { tasks: Task[]; changedTaskId: string | null } {
  if (constraint.type !== 'deadline_added' || !constraint.urgentDeadline) {
    return { tasks, changedTaskId: null };
  }

  const target =
    tasks.find((t) => t.category === 'career' && /appl/i.test(t.title)) ??
    tasks.find((t) => t.priority === 'P1') ??
    tasks[0];
  if (!target) return { tasks, changedTaskId: null };

  const deadline = new Date(constraint.urgentDeadline);
  return {
    tasks: tasks.map((t) =>
      t.id === target.id ? { ...t, deadline, priority: 'P1' as const } : t
    ),
    changedTaskId: target.id,
  };
}

// Protected deep-work time: Saturday morning (study tasks are steered here,
// short admin tasks are kept out of it)
export const mockFocusTime: FocusTime = {
  blocks: [{ day: 6, startTime: '10:00', endTime: '12:00' }],
  minimumBlockMinutes: 60,
};

export const SCHEDULER_OPTIONS = {
  focusTime: mockFocusTime,
  bufferTimeMinutes: 10,
  minimumBlockMinutes: 15,
};

/** Planning horizon used everywhere: now -> 7 days ahead */
export function planningWindow(now: Date = new Date()): { start: Date; end: Date } {
  return { start: now, end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
}
