/**
 * LifeShift constraints: how a parsed sentence changes the week.
 *
 * - time_reduced / shift_conflict change free time (a date override; the
 *   weekly pattern is never mutated)
 * - deadline_added changes a task (the next application gets that deadline)
 */

import type { Task, Availability, Constraint } from './types';
import { formatDate, roundUpMinutes, toHHMM } from './utils';

export const SCHEDULER_OPTIONS = {
  focusTime: { blocks: [], minimumBlockMinutes: 60 },
  bufferTimeMinutes: 10,
  minimumBlockMinutes: 15,
};

// One-click examples in LifeShift
export const EXAMPLE_CONSTRAINTS = [
  'Manager added shift, only 20min tonight',
  'Dream job closes tomorrow at 5PM',
  'Extra shift tomorrow 6PM-10PM',
  'I’m sick today, no studying',
  'Free tonight from 8 to 10',
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

    case 'day_off': {
      // Whole days with no study time: an empty override for each
      let next = availability;
      for (const d of constraint.dates ?? []) next = withOverride(next, new Date(d + 'T12:00:00'), []);
      return next;
    }

    case 'time_added': {
      if (!constraint.freeWindow || !constraint.date) return availability;
      const day = new Date(constraint.date + 'T12:00:00');
      const isToday = formatDate(day) === formatDate(now);
      const soonest = isToday ? toHHMM(roundUpMinutes(now)) : '00:00';
      const start = constraint.freeWindow.start > soonest ? constraint.freeWindow.start : soonest;
      if (start >= constraint.freeWindow.end) return availability;
      return withOverride(availability, day, mergeWindows([...windowsForDate(availability, day), { startTime: start, endTime: constraint.freeWindow.end }]));
    }

    case 'deadline_added':
    default:
      // Deadlines change tasks, not free time (see applyConstraintToTasks)
      return availability;
  }
}

/** Sort and join overlapping windows */
function mergeWindows(ws: { startTime: string; endTime: string }[]) {
  const sorted = [...ws].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const out: { startTime: string; endTime: string }[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w.startTime <= last.endTime) last.endTime = w.endTime > last.endTime ? w.endTime : last.endTime;
    else out.push({ ...w });
  }
  return out;
}

const STOP = new Set(['the', 'a', 'an', 'my', 'is', 'now', 'due', 'by', 'on', 'at', 'for', 'to', 'of', 'and', 'moved', 'move', 'closes', 'close', 'deadline', 'new']);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w));

/** The task a deadline is about: the most words in common with its title (at least one) */
export function matchTask(tasks: Task[], about: string): Task | null {
  const want = new Set(words(about).map((w) => w.replace(/s$/, '')));
  if (!want.size) return null;
  let best: { t: Task; n: number } | null = null;
  for (const t of tasks) {
    const n = words(t.title).filter((w) => want.has(w.replace(/s$/, ''))).length;
    // "AWS exam" must match both words, so it doesn't land on "AWS Lambda quiz"
    if (n >= Math.min(2, want.size) && (!best || n > best.n)) best = { t, n };
  }
  return best?.t ?? null;
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

  const deadline = new Date(constraint.urgentDeadline);
  const about = constraint.about?.trim() ?? '';
  const isJob = !about || /\b(job|appl\w*|role|position|posting|interview)\b/i.test(about);

  // The task it's about ("AWS exam" -> "Study for the AWS exam"); else the next application
  const named = about ? matchTask(tasks, about) : null;
  const target =
    named ??
    (isJob
      ? tasks
          .filter((t) => t.category === 'career' && /\bappl/i.test(t.title))
          .sort((a, b) => (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity))[0]
      : undefined);

  if (!target && !isJob) {
    // Something new and not a job: it becomes its own task, due then
    const id = `lifeshift-${deadline.getTime()}`;
    const title = about.charAt(0).toUpperCase() + about.slice(1);
    return {
      tasks: [
        ...tasks,
        { id, title: /exam|test|quiz|assignment|essay|course|study|chapter/i.test(about) ? `Prepare: ${title}` : title, duration: 45, priority: 'P1', deadline, flexible: true, category: 'learning', source: 'you', why: `"${constraint.description}"` },
      ],
      changedTaskId: id,
    };
  }

  if (!target) {
    // Nothing to attach it to: the sentence itself becomes an application task
    const id = `lifeshift-${deadline.getTime()}`;
    return {
      tasks: [
        ...tasks,
        {
          id,
          title: 'Job application (from LifeShift)',
          duration: 30,
          priority: 'P1',
          deadline,
          flexible: false,
          category: 'career',
          source: 'you',
          href: '/jobs',
          why: `"${constraint.description}"`,
        },
      ],
      changedTaskId: id,
    };
  }

  return {
    tasks: tasks.map((t) => (t.id === target.id ? { ...t, deadline, priority: 'P1' as const } : t)),
    changedTaskId: target.id,
  };
}

/** Planning horizon used everywhere: now -> 7 days ahead */
export function planningWindow(now: Date = new Date()): { start: Date; end: Date } {
  return { start: now, end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
}
