/**
 * Time Utilities for ROPI Scheduling
 *
 * Adapted from Smart Agentic Calendar
 * Reference: docs/UPSTREAM_AUDIT.md
 *
 * All calendar math (day of week, HH:MM windows, YYYY-MM-DD dates) uses the
 * user's LOCAL time zone. Timestamps are stored as UTC ISO strings, which
 * compare correctly as plain strings.
 */

/**
 * Calculate difference in minutes between two ISO datetime strings
 */
export function diffMinutes(start: string, end: string): number {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  return Math.floor((endMs - startMs) / 60000);
}

/**
 * Add minutes to an ISO datetime string
 */
export function addMinutes(isoString: string, minutes: number): string {
  const date = new Date(isoString);
  date.setTime(date.getTime() + minutes * 60000);
  return date.toISOString();
}

/**
 * Local time of day (HH:MM) for an ISO timestamp
 */
export function extractTime(isoString: string): string {
  const d = new Date(isoString);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Check if time is within range (all in HH:MM format)
 */
export function isTimeInRange(time: string, start: string, end: string): boolean {
  return time >= start && time < end;
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Local calendar date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Local day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * UTC ISO timestamp for a local calendar day + HH:MM time
 */
export function localDateTimeIso(day: Date, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
  return d.toISOString();
}

/**
 * Round a date up to the next N-minute boundary (default 5)
 */
export function roundUpMinutes(date: Date, step: number = 5): Date {
  const ms = step * 60000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/**
 * Format a Date as local HH:MM
 */
export function toHHMM(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
