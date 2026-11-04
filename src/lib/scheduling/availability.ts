/**
 * Availability Map Builder for ROPI LifeShift
 * 
 * Adapted from Smart Agentic Calendar scheduler.ts lines 186-238
 * Reference: docs/UPSTREAM_AUDIT.md - Smart Agentic Calendar
 * 
 * Purpose: Calculate free time slots by subtracting events and blocks from availability windows
 */

import type {
  AvailableSlot,
  Availability,
  Event,
  TimeBlock,
} from './types';
import { diffMinutes, formatDate, getDayOfWeek, localDateTimeIso, roundUpMinutes } from './utils';

interface Blocker {
  start: string;
  end: string;
}

/**
 * Clip a time range to fit within a window
 * Returns null if no overlap
 */
function clipToWindow(
  start: string,
  end: string,
  windowStart: string,
  windowEnd: string
): Blocker | null {
  if (start >= windowEnd || end <= windowStart) return null;
  return {
    start: start < windowStart ? windowStart : start,
    end: end > windowEnd ? windowEnd : end,
  };
}

/**
 * Collect all blockers (events + pinned blocks) for a specific window
 */
function collectBlockers(
  windowStart: string,
  windowEnd: string,
  events: Event[],
  pinnedBlocks: TimeBlock[]
): Blocker[] {
  const blockers: Blocker[] = [];

  // Add events as blockers
  for (const event of events) {
    if (event.isAllDay || !event.startTime || !event.endTime) continue;
    const clipped = clipToWindow(event.startTime, event.endTime, windowStart, windowEnd);
    if (clipped) blockers.push(clipped);
  }

  // Add pinned blocks (completed tasks) as blockers
  for (const block of pinnedBlocks) {
    const clipped = clipToWindow(block.startTime, block.endTime, windowStart, windowEnd);
    if (clipped) blockers.push(clipped);
  }

  // Sort by start time
  blockers.sort((a, b) => a.start.localeCompare(b.start));
  return blockers;
}

/**
 * Subtract blockers from a time window to get free slots
 */
function subtractBlockers(
  windowStart: string,
  windowEnd: string,
  blockers: Blocker[]
): { start: string; end: string }[] {
  const freeSlots: { start: string; end: string }[] = [];
  let currentStart = windowStart;

  for (const blocker of blockers) {
    // If there's free time before this blocker
    if (blocker.start > currentStart) {
      freeSlots.push({ start: currentStart, end: blocker.start });
    }
    // Move past this blocker
    currentStart = blocker.end > currentStart ? blocker.end : currentStart;
  }

  // Add remaining free time after last blocker
  if (currentStart < windowEnd) {
    freeSlots.push({ start: currentStart, end: windowEnd });
  }

  return freeSlots;
}

/**
 * Build availability map - calculate all free time slots
 * 
 * Algorithm:
 * 1. For each day in date range
 * 2. Check if all-day event blocks entire day
 * 3. Get availability windows for that day (e.g., Mon-Fri 9-5)
 * 4. Collect blockers (events + pinned blocks) for each window
 * 5. Subtract blockers from window to get free slots
 * 6. Return all free slots with durations
 */
export function buildAvailabilityMap(
  start: Date,
  end: Date,
  availability: Availability,
  events: Event[],
  pinnedBlocks: TimeBlock[]
): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  // Never schedule in the past: free time starts at the next 5-minute mark
  const earliestIso = roundUpMinutes(start).toISOString();
  const latestIso = end.toISOString();

  // Walk local calendar days from the start day
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  while (current < end) {
    const dayOfWeek = getDayOfWeek(current);
    const dateStr = formatDate(current);

    // Check for all-day events blocking this entire day
    const allDayBlock = events.some((e) => e.isAllDay && e.date === dateStr);

    if (!allDayBlock) {
      // A one-off override (e.g. "only 20 min tonight") replaces the weekly windows for that date
      const override = availability.overrides?.find((o) => o.date === dateStr);
      const windows = override
        ? override.windows
        : availability.windows.filter((w) => w.day === dayOfWeek);

      for (const window of windows) {
        // Local window times -> UTC ISO timestamps, clipped to [start, end]
        let windowStart = localDateTimeIso(current, window.startTime);
        let windowEnd = localDateTimeIso(current, window.endTime);
        if (windowStart < earliestIso) windowStart = earliestIso;
        if (windowEnd > latestIso) windowEnd = latestIso;
        if (windowStart >= windowEnd) continue;

        // Collect all blockers for this window
        const blockers = collectBlockers(windowStart, windowEnd, events, pinnedBlocks);

        // Subtract blockers to get free slots
        const freeSlots = subtractBlockers(windowStart, windowEnd, blockers);

        for (const free of freeSlots) {
          const durationMinutes = diffMinutes(free.start, free.end);
          if (durationMinutes > 0) {
            slots.push({
              date: dateStr,
              startTime: free.start,
              endTime: free.end,
              durationMinutes,
            });
          }
        }
      }
    }

    // Move to next local day
    current.setDate(current.getDate() + 1);
  }

  return slots;
}

/**
 * Consume slot space - remove or split slots that overlap with a placed block
 * This prevents future tasks from overlapping with already-placed blocks
 */
export function consumeSlotSpace(
  slots: AvailableSlot[],
  block: TimeBlock
): void {
  const blockStart = new Date(block.startTime).getTime();
  const blockEnd = new Date(block.endTime).getTime();

  for (let i = slots.length - 1; i >= 0; i--) {
    const slot = slots[i];
    const slotStart = new Date(slot.startTime).getTime();
    const slotEnd = new Date(slot.endTime).getTime();

    // Slot is completely consumed by block
    if (slotStart >= blockStart && slotEnd <= blockEnd) {
      slots.splice(i, 1);
      continue;
    }

    // Block overlaps start of slot
    if (blockStart <= slotStart && blockEnd > slotStart && blockEnd < slotEnd) {
      slot.startTime = block.endTime;
      slot.durationMinutes = diffMinutes(slot.startTime, slot.endTime);
      continue;
    }

    // Block overlaps end of slot
    if (blockStart > slotStart && blockStart < slotEnd && blockEnd >= slotEnd) {
      slot.endTime = block.startTime;
      slot.durationMinutes = diffMinutes(slot.startTime, slot.endTime);
      continue;
    }

    // Block is in middle of slot - split slot
    if (blockStart > slotStart && blockEnd < slotEnd) {
      const originalEnd = slot.endTime;
      
      // First part: slot start → block start
      slot.endTime = block.startTime;
      slot.durationMinutes = diffMinutes(slot.startTime, slot.endTime);
      
      // Second part: block end → slot end
      slots.push({
        date: slot.date,
        startTime: block.endTime,
        endTime: originalEnd,
        durationMinutes: diffMinutes(block.endTime, originalEnd),
      });
    }
  }
}
