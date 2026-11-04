/**
 * Plan builder shared by Today, LifeShift and Tasks.
 *
 * Inputs: the user's week (free time, events, their tasks) plus tasks the loop
 * creates (due cards, weak spots, job deadlines). We store only the changes the
 * user made (LifeShift constraints, conflict decisions) and rebuild from "now"
 * on every view, so the plan can't go stale.
 *
 * Stable replanning: each LifeShift change is applied on top of the previous
 * plan. Blocks that still fit stay exactly where they were; only tasks whose
 * time was taken (or whose deadline changed) are placed again. A full rebuild
 * is used only if it leaves fewer tasks at risk. smart-agentic-calendar does a
 * full rebuild on every change, which can shuffle unrelated blocks.
 */

import { generateSchedule } from './scheduler';
import { buildAvailabilityMap } from './availability';
import type {
  Adjustment,
  Availability,
  AvailabilityWindow,
  Constraint,
  Event,
  PlanChange,
  Schedule,
  Suggestion,
  Task,
  TimeBlock,
} from './types';
import { SCHEDULER_OPTIONS, applyConstraint, applyConstraintToTasks, planningWindow } from './constraints';

export interface Plan {
  schedule: Schedule;
  tasks: Task[];
  availability: Availability;
  events: Event[];
  /** 'stable' = only affected tasks moved; 'full' = everything was re-placed */
  strategy?: 'stable' | 'full';
}

export interface PlanInput {
  windows: AvailabilityWindow[];
  events: Event[];
  tasks: Task[];
}

const ms = (iso: string) => new Date(iso).getTime();

function applyAdjustments(tasks: Task[], adjustments: Adjustment[]): Task[] {
  const skip = new Set(adjustments.filter((a) => a.kind === 'skip').map((a) => a.taskId));
  const shorten = new Map(
    adjustments.filter((a): a is Extract<Adjustment, { kind: 'shorten' }> => a.kind === 'shorten').map((a) => [a.taskId, a.minutes])
  );
  return tasks.filter((t) => !skip.has(t.id)).map((t) => (shorten.has(t.id) ? { ...t, duration: shorten.get(t.id)! } : t));
}

function fullPlan(tasks: Task[], availability: Availability, events: Event[], now: Date): Plan {
  const { start, end } = planningWindow(now);
  const schedule = generateSchedule(tasks, start, end, { ...SCHEDULER_OPTIONS, availability }, events);
  return { schedule, tasks, availability, events, strategy: 'full' };
}

const sameTask = (a: Task, b: Task) =>
  a.duration === b.duration && a.priority === b.priority && (a.deadline?.getTime() ?? 0) === (b.deadline?.getTime() ?? 0);

/** Re-place only the tasks a change affected; everything else keeps its blocks */
export function stableReplan(prev: Plan, tasks: Task[], availability: Availability, events: Event[], now: Date): Plan {
  const { start, end } = planningWindow(now);
  const free = buildAvailabilityMap(start, end, availability, events, []);
  const fits = (b: TimeBlock) => free.some((s) => ms(s.startTime) <= ms(b.startTime) && ms(s.endTime) >= ms(b.endTime));

  const prevTasks = new Map(prev.tasks.map((t) => [t.id, t]));
  const blocksByTask = new Map<string, TimeBlock[]>();
  for (const b of prev.schedule.blocks) blocksByTask.set(b.taskId, [...(blocksByTask.get(b.taskId) ?? []), b]);
  const prevAtRisk = new Set(prev.schedule.atRiskTasks.map((r) => r.taskId));

  const keep: TimeBlock[] = [];
  const affected: Task[] = [];
  for (const task of tasks) {
    const before = prevTasks.get(task.id);
    const blocks = blocksByTask.get(task.id) ?? [];
    const stillValid =
      before &&
      sameTask(before, task) &&
      !prevAtRisk.has(task.id) &&
      blocks.length > 0 &&
      blocks.every((b) => ms(b.endTime) > now.getTime() && fits(b) && (!task.deadline || ms(b.endTime) <= task.deadline.getTime()));
    if (stillValid) keep.push(...blocks);
    else affected.push(task);
  }

  const placed = generateSchedule(affected, start, end, { ...SCHEDULER_OPTIONS, availability }, events, keep);
  const stable: Plan = {
    schedule: { ...placed, blocks: [...keep, ...placed.blocks].sort((a, b) => a.startTime.localeCompare(b.startTime)) },
    tasks,
    availability,
    events,
    strategy: 'stable',
  };

  // Moving unrelated blocks is only worth it if it saves important work: compare
  // unscheduled minutes weighted by priority (a P1 exam losing 100 min is worse
  // than a P3 note losing 60), not just how many tasks are at risk.
  const full = fullPlan(tasks, availability, events, now);
  return riskCost(full) < riskCost(stable) ? full : stable;
}

const PRIORITY_WEIGHT: Record<Task['priority'], number> = { P1: 8, P2: 4, P3: 2, P4: 1 };

/** Priority-weighted minutes that don't fit */
export function riskCost(plan: Plan): number {
  const placed = new Map<string, number>();
  for (const b of plan.schedule.blocks) placed.set(b.taskId, (placed.get(b.taskId) ?? 0) + (ms(b.endTime) - ms(b.startTime)) / 60000);
  return plan.schedule.atRiskTasks.reduce((sum, r) => {
    const task = plan.tasks.find((t) => t.id === r.taskId);
    if (!task) return sum;
    return sum + Math.max(0, task.duration - (placed.get(task.id) ?? 0)) * (PRIORITY_WEIGHT[task.priority] ?? 1);
  }, 0);
}

export function buildPlan(
  constraints: Constraint[],
  input: PlanInput,
  now: Date = new Date(),
  adjustments: Adjustment[] = []
): Plan {
  let availability: Availability = { windows: input.windows, overrides: [] };
  let tasks = input.tasks;
  let plan = fullPlan(applyAdjustments(tasks, adjustments), availability, input.events, now);

  for (const constraint of constraints) {
    availability = applyConstraint(availability, constraint, now);
    tasks = applyConstraintToTasks(tasks, constraint).tasks;
    plan = stableReplan(plan, applyAdjustments(tasks, adjustments), availability, input.events, now);
  }
  if (!constraints.length) plan = { ...plan, strategy: 'stable' };
  return plan;
}

/** Task ids whose time blocks differ between two schedules */
export function changedTaskIds(before: Schedule, after: Schedule): string[] {
  const key = (b: TimeBlock) => `${b.taskId}|${b.startTime}|${b.endTime}`;
  const beforeKeys = new Set(before.blocks.map(key));
  const afterKeys = new Set(after.blocks.map(key));
  const changed = new Set<string>();
  after.blocks.forEach((b) => !beforeKeys.has(key(b)) && changed.add(b.taskId));
  before.blocks.forEach((b) => !afterKeys.has(key(b)) && changed.add(b.taskId));
  return Array.from(changed);
}

const when = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Explain every change from the engine's own data: which slot disappeared,
 * which task took a slot, what the deadline is. No canned sentences per
 * constraint type.
 */
export function explainChanges(before: Plan, after: Plan, trigger?: string): PlanChange[] {
  const { start, end } = planningWindow(new Date());
  const freeAfter = buildAvailabilityMap(start, end, after.availability, after.events, []);
  const fitsAfter = (b: TimeBlock) => freeAfter.some((s) => ms(s.startTime) <= ms(b.startTime) && ms(s.endTime) >= ms(b.endTime));
  const prevTasks = new Map(before.tasks.map((t) => [t.id, t]));
  const nextTasks = new Map(after.tasks.map((t) => [t.id, t]));
  const by = (plan: Plan, id: string) => plan.schedule.blocks.filter((b) => b.taskId === id).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const quote = trigger ? `"${trigger}"` : 'your change';

  return changedTaskIds(before.schedule, after.schedule)
    .map((taskId): PlanChange | null => {
      const task = nextTasks.get(taskId) ?? prevTasks.get(taskId);
      if (!task) return null;
      const oldBlocks = by(before, taskId);
      const newBlocks = by(after, taskId);
      const prev = prevTasks.get(taskId);
      const risk = after.schedule.atRiskTasks.find((r) => r.taskId === taskId);
      const deadlineNote = task.deadline ? `, still before its deadline (${when(task.deadline)})` : '';

      if (!prev) {
        return { taskId, task, oldBlocks, newBlocks, cause: 'new_task', reason: `Added by ${quote}. ${newBlocks[0] ? `Placed ${when(newBlocks[0].startTime)}${deadlineNote}.` : risk?.reason ?? ''}` };
      }
      if (prev.duration !== task.duration) {
        return { taskId, task, oldBlocks, newBlocks, cause: 'resized', reason: `Shortened from ${prev.duration} to ${task.duration} min, so it now fits${deadlineNote}.` };
      }
      if ((prev.deadline?.getTime() ?? 0) !== (task.deadline?.getTime() ?? 0)) {
        return {
          taskId, task, oldBlocks, newBlocks, cause: 'deadline_changed',
          reason: `Deadline is now ${task.deadline ? when(task.deadline) : 'none'} (${quote}). ${newBlocks[0] ? `Moved to ${when(newBlocks[0].startTime)} to finish in time.` : risk?.reason ?? ''}`,
        };
      }
      const lostSlot = oldBlocks.find((b) => !fitsAfter(b));
      if (newBlocks.length === 0 || risk) {
        const reason = lostSlot
          ? `Its ${when(lostSlot.startTime)} slot was taken by ${quote}, and ${risk?.reason ?? 'no other free time is left'}.`
          : risk?.reason ?? 'No free time left for it this week.';
        return { taskId, task, oldBlocks, newBlocks, cause: 'dropped', reason };
      }
      if (lostSlot) {
        return {
          taskId, task, oldBlocks, newBlocks, cause: 'slot_removed',
          reason: `Its ${when(lostSlot.startTime)} slot was taken by ${quote}. Next free slot: ${when(newBlocks[0].startTime)}${deadlineNote}.`,
        };
      }
      // Its old time still exists: someone else is in it now (full rebuild), or it moved into freed time
      const taker = oldBlocks
        .map((ob) => after.schedule.blocks.find((nb) => nb.taskId !== taskId && ms(nb.startTime) < ms(ob.endTime) && ms(nb.endTime) > ms(ob.startTime)))
        .find(Boolean);
      if (taker) {
        const t = nextTasks.get(taker.taskId);
        return {
          taskId, task, oldBlocks, newBlocks, cause: 'displaced',
          reason: `"${t?.title ?? 'A more urgent task'}"${t?.deadline ? ` (due ${when(t.deadline)})` : ''} needed its ${when(oldBlocks[0].startTime)} slot. Moved to ${when(newBlocks[0].startTime)}${deadlineNote}.`,
        };
      }
      return { taskId, task, oldBlocks, newBlocks, cause: 'freed_time', reason: `Time opened up, so it moved earlier to ${when(newBlocks[0].startTime)}.` };
    })
    .filter((c): c is PlanChange => c !== null);
}

/**
 * Ways to rescue each at-risk task, from plan data. Adapted from
 * smart-agentic-calendar src/engine/conflict-detector.ts (MIT, (c) 2024-2026
 * Fabio Oliveira): suggest deprioritising lower-priority tasks scheduled
 * before the deadline (never ones due sooner), lowest priority first.
 */
export function suggestFixes(plan: Plan): Map<string, Suggestion[]> {
  const out = new Map<string, Suggestion[]>();
  const tasks = new Map(plan.tasks.map((t) => [t.id, t]));
  const rank = { P1: 0, P2: 1, P3: 2, P4: 3 } as const;

  for (const risk of plan.schedule.atRiskTasks) {
    const task = tasks.get(risk.taskId);
    if (!task) continue;
    const placedMin = plan.schedule.blocks.filter((b) => b.taskId === task.id).reduce((s, b) => s + (ms(b.endTime) - ms(b.startTime)) / 60000, 0);
    const missing = task.duration - placedMin;
    const suggestions: Suggestion[] = [];

    if (placedMin >= 10) {
      suggestions.push({
        label: `Do ${Math.round(placedMin)} min instead`,
        detail: `${Math.round(placedMin)} of ${task.duration} min fit${task.deadline ? ` before ${when(task.deadline)}` : ''}.`,
        adjustments: [{ kind: 'shorten', taskId: task.id, title: task.title, minutes: Math.round(placedMin) }],
      });
    }

    // Competing tasks: their blocks end before this task's deadline (or anywhere, if none)
    const deadline = task.deadline?.getTime() ?? Infinity;
    const minutesByTask = new Map<string, number>();
    for (const b of plan.schedule.blocks) {
      if (b.taskId === task.id || ms(b.endTime) > deadline) continue;
      minutesByTask.set(b.taskId, (minutesByTask.get(b.taskId) ?? 0) + (ms(b.endTime) - ms(b.startTime)) / 60000);
    }
    const competing = [...minutesByTask.entries()]
      .map(([id, minutes]) => ({ t: tasks.get(id)!, minutes }))
      .filter(({ t }) => t && rank[t.priority] >= rank[task.priority]) // never give up something more important
      .filter(({ t }) => !t.deadline || !task.deadline || t.deadline > task.deadline) // never drop a task due sooner
      .sort((a, b) => rank[b.t.priority] - rank[a.t.priority] || (b.t.deadline?.getTime() ?? Infinity) - (a.t.deadline?.getTime() ?? Infinity));

    let freed = 0;
    const picked: typeof competing = [];
    for (const c of competing) {
      if (freed >= missing) break;
      picked.push(c);
      freed += c.minutes;
    }
    if (picked.length && freed >= missing) {
      suggestions.push({
        label: picked.length === 1 ? `Skip "${picked[0].t.title}" this week` : `Skip ${picked.length} lower-priority tasks`,
        detail: `Frees ${Math.round(freed)} min${task.deadline ? ` before ${when(task.deadline)}` : ''}. ${picked.map((p) => p.t.title).join(', ')}.`,
        adjustments: picked.map((p) => ({ kind: 'skip' as const, taskId: p.t.id, title: p.t.title })),
      });
    }

    suggestions.push({
      label: 'Skip it this week',
      detail: 'Take it off this week’s plan. Undo any time.',
      adjustments: [{ kind: 'skip', taskId: task.id, title: task.title }],
    });
    out.set(task.id, suggestions);
  }
  return out;
}

/** Total scheduled minutes in a schedule */
export function scheduledMinutes(schedule: Schedule): number {
  return schedule.blocks.reduce((sum, b) => sum + (ms(b.endTime) - ms(b.startTime)) / 60000, 0);
}

/** Weekly free minutes from the user's windows */
export function weeklyFreeMinutes(windows: AvailabilityWindow[]): number {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return windows.reduce((s, w) => s + Math.max(0, toMin(w.endTime) - toMin(w.startTime)), 0);
}
