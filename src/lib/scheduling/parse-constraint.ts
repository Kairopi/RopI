/**
 * Natural-language constraint parsing for LifeShift.
 *
 * 1. Meta Muse (muse-spark-1.3, minimal reasoning, JSON mode) turns the
 *    sentence into structured data. ~1.5s in testing.
 * 2. If Muse is unavailable or returns something invalid, deterministic
 *    rules handle the common phrasings. The result says which one parsed it.
 */

import { callMuse, isMuseConfigured, MUSE_MODELS } from '@/lib/api/muse';
import type { Constraint } from './types';
import { formatDate } from './utils';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function localDate(ymd: string, hhmm: string): Date {
  const [y, mo, d] = ymd.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

function dayOffset(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/** Convert the structured fields (from Muse or rules) into a Constraint */
function toConstraint(
  input: string,
  fields: {
    type?: string;
    date?: string | null;
    availableMinutes?: number | null;
    deadlineTime?: string | null;
    shiftStart?: string | null;
    shiftEnd?: string | null;
  },
  parsedBy: 'muse' | 'rules',
  now: Date
): Constraint | null {
  const date = fields.date && YMD.test(fields.date) ? fields.date : formatDate(now);

  switch (fields.type) {
    case 'time_reduced': {
      const minutes = Number(fields.availableMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) return null;
      return { type: 'time_reduced', description: input, parsedBy, date, availableMinutes: Math.round(minutes) };
    }
    case 'deadline_added': {
      const time = fields.deadlineTime && HHMM.test(fields.deadlineTime) ? fields.deadlineTime : '17:00';
      const deadline = localDate(date, time);
      if (deadline <= now) return null;
      return { type: 'deadline_added', description: input, parsedBy, urgentDeadline: deadline };
    }
    case 'shift_conflict': {
      const s = fields.shiftStart && HHMM.test(fields.shiftStart) ? fields.shiftStart : null;
      const e = fields.shiftEnd && HHMM.test(fields.shiftEnd) ? fields.shiftEnd : null;
      if (!s || !e || e <= s) return null;
      return {
        type: 'shift_conflict',
        description: input,
        parsedBy,
        conflictingShift: {
          start: localDate(date, s).toISOString(),
          end: localDate(date, e).toISOString(),
        },
      };
    }
    default:
      return null;
  }
}

/** "6PM", "6:30 pm", "18:00" -> "18:00" (meridiem may be shared with the other end of a range) */
function to24h(hour: string, minute: string | undefined, meridiem: string | undefined): string {
  let h = parseInt(hour, 10);
  const m = minute ? parseInt(minute, 10) : 0;
  const mer = meridiem?.toLowerCase();
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Deterministic fallback for common phrasings */
export function parseConstraintWithRules(input: string, now: Date = new Date()): Constraint | null {
  const lower = input.toLowerCase();
  const date = /\btomorrow\b/.test(lower) ? dayOffset(now, 1) : formatDate(now);

  // Shift/meeting with an explicit time range: "6PM-10PM", "2 to 6 pm"
  const range = lower.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/
  );
  if (range && /(shift|meeting|appointment|busy|class|event|call)/.test(lower)) {
    const endMer = range[6] ?? range[3];
    const startMer = range[3] ?? endMer;
    return toConstraint(
      input,
      { type: 'shift_conflict', date, shiftStart: to24h(range[1], range[2], startMer), shiftEnd: to24h(range[4], range[5], endMer) },
      'rules',
      now
    );
  }

  // Less time than usual: "only 20min tonight", "just 1 hour"
  const time = lower.match(/(\d+)\s*(min|mins|minute|minutes|m|hr|hrs|hour|hours|h)\b/);
  if (time && /(only|just|have|got|left)/.test(lower)) {
    const value = parseInt(time[1], 10);
    const minutes = time[2].startsWith('h') ? value * 60 : value;
    return toConstraint(input, { type: 'time_reduced', date, availableMinutes: minutes }, 'rules', now);
  }

  // Deadline: "closes tomorrow at 5PM", "due today at 3"
  if (/(close|closes|closing|due|deadline|submit by|apply by)/.test(lower)) {
    const at = lower.match(/at\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    const deadlineTime = at ? to24h(at[1], at[2], at[3] ?? 'pm') : '17:00';
    return toConstraint(input, { type: 'deadline_added', date, deadlineTime }, 'rules', now);
  }

  // Shift without times: assume it takes the evening
  if (/(shift|overtime)/.test(lower)) {
    return toConstraint(input, { type: 'shift_conflict', date, shiftStart: '18:00', shiftEnd: '22:00' }, 'rules', now);
  }

  return null;
}

/** Parse with Meta Muse, falling back to rules */
export async function parseConstraint(input: string, now: Date = new Date()): Promise<Constraint | null> {
  const text = input.trim();
  if (!text) return null;

  if (isMuseConfigured()) {
    try {
      const prompt = `Current local date and time: ${now.toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })} (today is ${formatDate(now)}).

A user describes a change to their free time for study and job applications. Classify it and extract fields.

Types:
- "time_reduced": they have only N minutes of free time on a day. Fill availableMinutes.
- "deadline_added": something (e.g. a job application) is now due at a time. Fill deadlineTime.
- "shift_conflict": they are busy during a time range (work shift, meeting). Fill shiftStart and shiftEnd. If no times are given, use 18:00-22:00.
- "unknown": anything else.

Return ONLY a JSON object:
{"type": "...", "date": "YYYY-MM-DD", "availableMinutes": number|null, "deadlineTime": "HH:MM"|null, "shiftStart": "HH:MM"|null, "shiftEnd": "HH:MM"|null}
Use 24-hour times. "tonight" means today. "tomorrow" means the day after today.

User: "${text.replace(/"/g, "'")}"`;

      const raw = await callMuse(prompt, {
        model: MUSE_MODELS.fast,
        reasoningEffort: 'minimal',
        json: true,
        maxTokens: 1500,
        timeoutMs: 15000,
      });
      const fields = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
      const constraint = toConstraint(text, fields, 'muse', now);
      if (constraint) return constraint;
      console.warn('Muse could not classify the constraint, using rules:', fields);
    } catch (error) {
      console.warn('Muse constraint parsing failed, using rules:', error);
    }
  }

  return parseConstraintWithRules(text, now);
}
