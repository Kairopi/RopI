/**
 * ROPI LifeShift Scheduling Types
 * 
 * Adapted from Smart Agentic Calendar patterns
 * Reference: docs/UPSTREAM_AUDIT.md - Smart Agentic Calendar
 */

export interface Task {
  id: string;
  title: string;
  duration: number; // minutes
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  deadline?: Date;
  flexible: boolean;
  tags?: string[];
  /** 'learning' | 'career' | 'life' (drives block colour) */
  category?: string;
  /** Where the task came from: typed by the user, or created by the loop */
  source?: 'you' | 'reviews' | 'weak-spot' | 'job' | 'sample';
  /** Page that does this task (block click opens it) */
  href?: string;
  /** One line on why the loop added it */
  why?: string;
}

export interface TimeBlock {
  id: string;
  taskId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  date: string; // YYYY-MM-DD
  blockIndex: number; // 0-based
  totalBlocks: number;
}

export interface AvailableSlot {
  date: string; // YYYY-MM-DD
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  durationMinutes: number;
}

export interface Availability {
  windows: AvailabilityWindow[];
  /** One-off changes for a specific local date; replace that day's weekly windows */
  overrides?: AvailabilityOverride[];
}

export interface AvailabilityOverride {
  date: string; // YYYY-MM-DD (local)
  windows: { startTime: string; endTime: string }[]; // HH:MM local
}

export interface AvailabilityWindow {
  day: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // HH:MM format (e.g., "09:00")
  endTime: string; // HH:MM format (e.g., "17:00")
}

export interface Event {
  id: string;
  title: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  isAllDay: boolean;
  date?: string; // YYYY-MM-DD for all-day events
}

export interface FocusTime {
  blocks: FocusBlock[];
  minimumBlockMinutes: number;
}

export interface FocusBlock {
  day: number; // 0 = Sunday, ..., 6 = Saturday
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface Constraint {
  type: 'time_reduced' | 'deadline_added' | 'shift_conflict';
  description: string; // Natural language: "only 20min tonight"
  /** Who turned the sentence into this structure */
  parsedBy?: 'muse' | 'rules';
  /** Local date (YYYY-MM-DD) a time_reduced constraint applies to; default today */
  date?: string;
  availableMinutes?: number;
  urgentDeadline?: Date;
  conflictingShift?: {
    start: string;
    end: string;
  };
}

export interface SlotScore {
  slot: AvailableSlot;
  totalScore: number;
  breakdown: {
    deadlineProximity: number;
    priority: number;
    focusTime: number;
    energy: number;
    buffer: number;
  };
}

export interface TaskPlacement {
  taskId: string;
  blocks: TimeBlock[];
  unscheduledMinutes: number;
}

export interface Schedule {
  blocks: TimeBlock[];
  atRiskTasks: AtRiskTask[];
  calculationTime: number; // milliseconds
  /** Number of free time slots found before placing tasks (for the activity feed) */
  freeSlotCount?: number;
  /** When this schedule was generated (ISO) */
  generatedAt?: string;
}

export interface AtRiskTask {
  taskId: string;
  reason: string;
}

/** A user decision layered on top of the plan (from a conflict suggestion) */
export type Adjustment =
  | { kind: 'skip'; taskId: string; title: string }
  | { kind: 'shorten'; taskId: string; title: string; minutes: number };

/** One way to resolve an at-risk task (ported from smart-agentic-calendar's suggestDeprioritizations) */
export interface Suggestion {
  label: string;
  detail: string;
  adjustments: Adjustment[];
}

/** Why a task's blocks changed between two plans, built from engine data (not templates) */
export interface PlanChange {
  taskId: string;
  task: Task;
  oldBlocks: TimeBlock[];
  newBlocks: TimeBlock[];
  cause: 'slot_removed' | 'deadline_changed' | 'displaced' | 'new_task' | 'dropped' | 'resized' | 'freed_time';
  reason: string;
}

export interface ScoringContext {
  now: Date;
  focusTime: FocusTime;
  adjacentBlocks: TimeBlock[];
  bufferTimeMinutes: number;
}

export const PRIORITY_SCORES: Record<string, number> = {
  P1: 1.0,
  P2: 0.75,
  P3: 0.5,
  P4: 0.25,
};

export const DEFAULT_WEIGHTS = {
  deadlineProximity: 40,
  priority: 30,
  focusTime: 15,
  energy: 10,
  buffer: 5,
};

export const FOCUS_TAGS = ['deep-work', 'focus', 'study'];
