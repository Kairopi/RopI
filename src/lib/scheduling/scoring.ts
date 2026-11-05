/**
 * Slot Scoring Functions for ROPI LifeShift
 * 
 * Adapted from Smart Agentic Calendar scheduler.ts lines 68-184
 * Reference: THIRD_PARTY_NOTICES.md - Smart Agentic Calendar
 * 
 * Scoring System (0-1 scale per factor):
 * - Deadline Proximity: 40% weight (how urgent is this task?)
 * - Priority: 30% weight (P1 > P2 > P3 > P4)
 * - Focus Time: 15% weight (match focus tasks to focus blocks)
 * - Energy: 10% weight (match task types to energy levels)
 * - Buffer: 5% weight (prefer slots with buffer time)
 */

import type {
  Task,
  AvailableSlot,
  SlotScore,
  ScoringContext,
  FocusTime,
  TimeBlock,
} from './types';
import { PRIORITY_SCORES, DEFAULT_WEIGHTS, FOCUS_TAGS } from './types';
import { extractTime, isTimeInRange, getDayOfWeek } from './utils';

/**
 * Deadline Proximity Score (40% weight)
 * 
 * Logic:
 * - Overdue tasks = 1.0 (maximum urgency)
 * - Close deadlines = higher score
 * - Far deadlines = lower score
 * - No deadline = 0.5 (neutral)
 */
export function deadlineProximityScore(task: Task, slot: AvailableSlot, now: Date): number {
  const nowMs = now.getTime();
  const slotMs = new Date(slot.startTime).getTime();
  const hoursUntilSlot = Math.max(0, (slotMs - nowMs) / 3_600_000);

  // No deadline: mild preference for sooner slots (within a 1-week horizon)
  if (!task.deadline) {
    const earliness = 1 - Math.min(1, hoursUntilSlot / (7 * 24));
    return 0.3 + 0.2 * earliness;
  }

  const deadline = task.deadline.getTime();

  // Already overdue - maximum urgency, as soon as possible
  if (deadline <= nowMs) return 1.0;

  // Slots that start after the deadline are useless for this task
  if (slotMs >= deadline) return 0;

  // Urgency: how close the deadline is (28-day horizon)
  const hoursToDeadline = (deadline - nowMs) / 3_600_000;
  const urgency = 1.0 - Math.min(1.0, hoursToDeadline / (28 * 24));

  // Earliness: how much of the time before the deadline is still left at this slot.
  // A slot right now = 1, a slot just before the deadline = ~0.
  const earliness = 1 - (slotMs - nowMs) / (deadline - nowMs);

  return Math.max(0, Math.min(1, 0.5 * urgency + 0.5 * earliness));
}

/**
 * Priority Score (30% weight)
 * 
 * P1 = 1.0 (highest)
 * P2 = 0.75
 * P3 = 0.5
 * P4 = 0.25 (lowest)
 */
export function priorityScore(task: Task): number {
  return PRIORITY_SCORES[task.priority] ?? 0.5;
}

/**
 * Focus Time Score (15% weight)
 * 
 * Logic:
 * - Focus task in focus block = 1.0 (perfect match)
 * - Focus task outside focus block = 0.0 (bad match)
 * - Non-focus task in focus block = 0.2 (discouraged)
 * - Non-focus task outside focus block = 0.5 (neutral)
 */
export function focusTimeScore(task: Task, slot: AvailableSlot, focusTime: FocusTime): number {
  if (focusTime.blocks.length === 0) return 0.5;

  const isFocusTask = task.tags?.some((t) => FOCUS_TAGS.includes(t.toLowerCase())) ?? false;
  const inFocusBlock = isSlotInFocusBlock(slot, focusTime);

  if (isFocusTask && inFocusBlock) return 1.0;
  if (isFocusTask && !inFocusBlock) return 0.0;
  if (!isFocusTask && inFocusBlock) return 0.2;
  return 0.5;
}

/**
 * Energy Score (10% weight)
 * 
 * Note: Simplified for MVP - can be enhanced later with user's energy preferences
 * Returns neutral score for now
 */
export function energyScore(task: Task, slot: AvailableSlot): number {
  // TODO: Implement energy matching (peak energy, low energy periods)
  // For MVP, return neutral score
  return 0.5;
}

/**
 * Buffer Score (5% weight)
 * 
 * Logic:
 * - Penalize slots that are too close to existing blocks
 * - Prefer slots with breathing room
 */
export function bufferScore(
  slot: AvailableSlot,
  adjacentBlocks: TimeBlock[],
  bufferTimeMinutes: number
): number {
  let score = 1.0;

  const slotStart = new Date(slot.startTime).getTime();
  const slotEnd = new Date(slot.endTime).getTime();
  const bufferMs = bufferTimeMinutes * 60_000;

  for (const block of adjacentBlocks) {
    const blockEnd = new Date(block.endTime).getTime();
    const blockStart = new Date(block.startTime).getTime();

    // Block ends just before slot starts (within buffer)
    if (blockEnd <= slotStart && slotStart - blockEnd < bufferMs) {
      score -= 0.5;
    }
    // Block starts just after slot ends (within buffer)
    if (blockStart >= slotEnd && blockStart - slotEnd < bufferMs) {
      score -= 0.5;
    }
  }

  return Math.max(0, score);
}

/**
 * Score a slot for a specific task
 * 
 * Returns combined weighted score and breakdown
 */
export function scoreSlot(task: Task, slot: AvailableSlot, ctx: ScoringContext): SlotScore {
  const breakdown = {
    deadlineProximity: deadlineProximityScore(task, slot, ctx.now),
    priority: priorityScore(task),
    focusTime: focusTimeScore(task, slot, ctx.focusTime),
    energy: energyScore(task, slot),
    buffer: bufferScore(slot, ctx.adjacentBlocks, ctx.bufferTimeMinutes),
  };

  const totalScore =
    DEFAULT_WEIGHTS.deadlineProximity * breakdown.deadlineProximity +
    DEFAULT_WEIGHTS.priority * breakdown.priority +
    DEFAULT_WEIGHTS.focusTime * breakdown.focusTime +
    DEFAULT_WEIGHTS.energy * breakdown.energy +
    DEFAULT_WEIGHTS.buffer * breakdown.buffer;

  return { slot, totalScore, breakdown };
}

/**
 * Helper: Check if slot is within a focus time block
 */
export function isSlotInFocusBlock(slot: AvailableSlot, focusTime: FocusTime): boolean {
  const slotDate = new Date(slot.startTime);
  const dayOfWeek = getDayOfWeek(slotDate);
  const slotTimeStr = extractTime(slot.startTime);

  return focusTime.blocks.some(
    (fb) => fb.day === dayOfWeek && slotTimeStr >= fb.startTime && slotTimeStr < fb.endTime
  );
}
