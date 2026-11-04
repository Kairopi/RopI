/**
 * ROPI LifeShift Scheduler - Main Algorithm
 * 
 * Adapted from Smart Agentic Calendar scheduler.ts
 * Reference: docs/UPSTREAM_AUDIT.md - Smart Agentic Calendar
 * 
 * Algorithm:
 * 1. Build availability map (windows - events - blocks = free slots)
 * 2. Score all slots for each task (weighted scoring)
 * 3. Place tasks greedily into best-scored slots (bin packing)
 * 4. Track at-risk tasks (insufficient time)
 * 5. Return complete schedule with calculation time
 */

import type {
  Task,
  AvailableSlot,
  Availability,
  Event,
  TimeBlock,
  FocusTime,
  Schedule,
  TaskPlacement,
  SlotScore,
  ScoringContext,
  AtRiskTask,
} from './types';
import { FOCUS_TAGS } from './types';
import { buildAvailabilityMap, consumeSlotSpace } from './availability';
import { scoreSlot, isSlotInFocusBlock } from './scoring';
import { generateId, addMinutes } from './utils';

interface SchedulerConfig {
  availability: Availability;
  focusTime: FocusTime;
  bufferTimeMinutes: number;
  minimumBlockMinutes: number;
}

interface SlotAllocation {
  slot: AvailableSlot;
  durationMinutes: number;
}

/**
 * Select best slots for a task (greedy bin packing)
 */
function selectSlotsForTask(
  task: Task,
  availableSlots: AvailableSlot[],
  scoringCtx: ScoringContext,
  minimumBlockMinutes: number,
  focusMinimumBlockMinutes: number
): { allocations: SlotAllocation[]; unscheduledMinutes: number } {
  // Score all slots
  const scoredSlots = availableSlots
    .map((slot) => scoreSlot(task, slot, scoringCtx))
    .sort((a, b) => b.totalScore - a.totalScore); // Best first

  // Same definition the scorer uses (FOCUS_TAGS: deep-work, focus, study)
  const isFocusTask = task.tags?.some((t) => FOCUS_TAGS.includes(t.toLowerCase())) ?? false;
  const allocations: SlotAllocation[] = [];
  let remainingMinutes = task.duration;

  // Overdue tasks have no "before the deadline" window left: schedule them ASAP
  const rawDeadline = task.deadline ? task.deadline.getTime() : Infinity;
  const deadlineMs = rawDeadline <= scoringCtx.now.getTime() ? Infinity : rawDeadline;

  for (const scored of scoredSlots) {
    if (remainingMinutes <= 0) break;

    const slot = scored.slot;
    if (slot.durationMinutes <= 0) continue;

    // Never schedule work after its deadline: only the part of the slot
    // before the deadline is usable
    const slotStartMs = new Date(slot.startTime).getTime();
    const usableMinutes = Math.min(
      slot.durationMinutes,
      Math.floor((deadlineMs - slotStartMs) / 60000)
    );
    // Skip fragments too small to be useful (unless they finish the task)
    if (usableMinutes < Math.min(minimumBlockMinutes, remainingMinutes)) continue;

    // Focus fragmentation prevention: don't put short non-focus tasks inside
    // protected focus blocks. (Previously this checked slot LENGTH, which
    // skipped every short task on every long slot and left them "at risk".)
    if (
      !isFocusTask &&
      task.duration < focusMinimumBlockMinutes &&
      isSlotInFocusBlock(slot, scoringCtx.focusTime)
    ) {
      continue;
    }

    const rawDuration = Math.min(remainingMinutes, usableMinutes);
    
    // Adjust for minimum block size on trailing blocks
    const blockDuration = adjustForTrailingBlock(
      rawDuration,
      remainingMinutes,
      minimumBlockMinutes
    );

    allocations.push({ slot, durationMinutes: blockDuration });
    remainingMinutes -= blockDuration;
  }

  return { allocations, unscheduledMinutes: Math.max(0, remainingMinutes) };
}

/**
 * Adjust trailing block duration to meet minimum block size
 */
function adjustForTrailingBlock(
  rawDuration: number,
  remainingMinutes: number,
  minimumBlockMinutes: number
): number {
  // Ported from smart-agentic-calendar src/engine/scheduler.ts (MIT, (c) 2024-2026
  // Fabio Oliveira): never leave a leftover smaller than the minimum block. Our
  // previous version returned min(min, raw), which was always raw (a no-op).
  const leftover = remainingMinutes - rawDuration;
  if (leftover > 0 && leftover < minimumBlockMinutes) {
    const adjusted = remainingMinutes - minimumBlockMinutes;
    return adjusted >= minimumBlockMinutes ? adjusted : rawDuration;
  }
  return rawDuration;
}

/**
 * Emit time blocks for a task's allocations
 */
function emitBlocksForTask(taskId: string, allocations: SlotAllocation[]): TimeBlock[] {
  const totalBlocks = allocations.length;
  return allocations.map((alloc, blockIndex) => ({
    // Deterministic: the same task placement gives the same id on every replan
    id: `${taskId}#${blockIndex}@${alloc.slot.startTime}`,
    taskId,
    startTime: alloc.slot.startTime,
    endTime: addMinutes(alloc.slot.startTime, alloc.durationMinutes),
    date: alloc.slot.date,
    blockIndex,
    totalBlocks,
  }));
}

/**
 * Place a single task into available slots
 */
function placeTask(
  task: Task,
  availableSlots: AvailableSlot[],
  existingBlocks: TimeBlock[],
  config: SchedulerConfig,
  now: Date
): TaskPlacement {
  const scoringCtx: ScoringContext = {
    now,
    focusTime: config.focusTime,
    adjacentBlocks: existingBlocks,
    bufferTimeMinutes: config.bufferTimeMinutes,
  };

  const { allocations, unscheduledMinutes } = selectSlotsForTask(
    task,
    availableSlots,
    scoringCtx,
    config.minimumBlockMinutes,
    config.focusTime.minimumBlockMinutes
  );

  return {
    taskId: task.id,
    blocks: emitBlocksForTask(task.id, allocations),
    unscheduledMinutes,
  };
}

/**
 * Order tasks by priority and deadline (simplified for MVP)
 * 
 * Sort order:
 * 1. Deadline urgency (overdue first)
 * 2. Priority (P1 > P2 > P3 > P4)
 * 3. Duration (shorter first for better packing)
 */
// Lower priority = a later "effective deadline", so a P1 due Friday can still go
// before a P4 due Thursday. One numeric key per task keeps the order total and
// transitive (the old pairwise comparator with a 1-hour tolerance was not, so
// the result could depend on input order).
const PRIORITY_OFFSET_MS: Record<Task['priority'], number> = {
  P1: 0,
  P2: 12 * 3_600_000,
  P3: 36 * 3_600_000,
  P4: 72 * 3_600_000,
};
const NO_DEADLINE_MS = 8 * 24 * 3_600_000; // treat "no deadline" as just past the 7-day horizon

export function orderKey(task: Task, now: Date): number {
  const nowMs = now.getTime();
  const deadline = task.deadline?.getTime();
  if (deadline !== undefined && deadline < nowMs) return Number.NEGATIVE_INFINITY; // overdue: first
  return (deadline ?? nowMs + NO_DEADLINE_MS) + (PRIORITY_OFFSET_MS[task.priority] ?? PRIORITY_OFFSET_MS.P3);
}

function orderTasks(tasks: Task[], now: Date): Task[] {
  return [...tasks].sort(
    (a, b) =>
      orderKey(a, now) - orderKey(b, now) ||
      // Overdue ties: priority first
      a.priority.localeCompare(b.priority) ||
      // Shorter first packs better
      a.duration - b.duration ||
      a.id.localeCompare(b.id)
  );
}

/**
 * Main Scheduler: Generate complete schedule
 * 
 * @param tasks - Tasks to schedule
 * @param start - Schedule start date
 * @param end - Schedule end date
 * @param config - Scheduler configuration (availability, focus time, etc.)
 * @param events - Calendar events that block time
 * @param pinnedBlocks - Already-placed blocks (completed tasks)
 * @returns Complete schedule with time blocks and at-risk tasks
 */
export function generateSchedule(
  tasks: Task[],
  start: Date,
  end: Date,
  config: SchedulerConfig,
  events: Event[] = [],
  pinnedBlocks: TimeBlock[] = []
): Schedule {
  const startTime = performance.now();
  const now = new Date();

  // Step 1: Build availability map
  const availableSlots = buildAvailabilityMap(start, end, config.availability, events, pinnedBlocks);

  // Step 2: Order tasks
  const orderedTasks = orderTasks(tasks, now);

  // Step 3: Place tasks greedily
  const allBlocks: TimeBlock[] = [...pinnedBlocks];
  const atRiskTasks: AtRiskTask[] = [];
  const remainingSlots = [...availableSlots];

  for (const task of orderedTasks) {
    const placement = placeTask(task, remainingSlots, allBlocks, config, now);

    allBlocks.push(...placement.blocks);

    // Track at-risk if not fully scheduled
    if (placement.unscheduledMinutes > 0) {
      const beforeDeadline = task.deadline
        ? ` before its deadline (${task.deadline.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })})`
        : '';
      atRiskTasks.push({
        taskId: task.id,
        reason: `${placement.unscheduledMinutes} of ${task.duration} min don't fit${beforeDeadline}`,
      });
    }

    // Consume slot space so next task doesn't overlap
    for (const block of placement.blocks) {
      consumeSlotSpace(remainingSlots, block);
    }
  }

  // Round to 0.1 ms so the UI shows "3.2ms", not "3.19999999ms"
  const calculationTime = Math.round((performance.now() - startTime) * 10) / 10;

  return {
    blocks: allBlocks.filter((b) => !pinnedBlocks.includes(b)), // Return only new blocks
    atRiskTasks,
    calculationTime,
    freeSlotCount: availableSlots.length,
    generatedAt: now.toISOString(),
  };
}

/**
 * Recalculate schedule with new constraints
 * 
 * This is the key function for LifeShift - when user says
 * "manager added shift, only 20min tonight", this recalculates everything
 */
export function recalculateSchedule(
  currentSchedule: Schedule,
  tasks: Task[],
  newAvailability: Availability, // Updated with new constraint
  start: Date,
  end: Date,
  config: Omit<SchedulerConfig, 'availability'>,
  events: Event[] = []
): Schedule {
  // Full reschedule with new availability
  return generateSchedule(
    tasks,
    start,
    end,
    { ...config, availability: newAvailability },
    events,
    [] // No pinned blocks - we're rescheduling everything
  );
}

/**
 * Calculate schedule changes between old and new
 * Returns what changed for UI display
 */
export function calculateScheduleChanges(
  oldSchedule: Schedule,
  newSchedule: Schedule
): {
  added: TimeBlock[];
  removed: TimeBlock[];
  moved: Array<{ old: TimeBlock; new: TimeBlock }>;
} {
  const oldBlockMap = new Map(oldSchedule.blocks.map((b) => [b.taskId, b]));
  const newBlockMap = new Map(newSchedule.blocks.map((b) => [b.taskId, b]));

  const added: TimeBlock[] = [];
  const removed: TimeBlock[] = [];
  const moved: Array<{ old: TimeBlock; new: TimeBlock }> = [];

  // Find added and moved
  for (const newBlock of newSchedule.blocks) {
    const oldBlock = oldBlockMap.get(newBlock.taskId);
    if (!oldBlock) {
      added.push(newBlock);
    } else if (
      oldBlock.startTime !== newBlock.startTime ||
      oldBlock.endTime !== newBlock.endTime
    ) {
      moved.push({ old: oldBlock, new: newBlock });
    }
  }

  // Find removed
  for (const oldBlock of oldSchedule.blocks) {
    if (!newBlockMap.has(oldBlock.taskId)) {
      removed.push(oldBlock);
    }
  }

  return { added, removed, moved };
}
