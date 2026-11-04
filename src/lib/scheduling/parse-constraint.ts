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
    dates?: string[] | null;
    freeStart?: string | null;
    freeEnd?: string | null;
    about?: string | null;
  },
  parsedBy: 'muse' | 'rules',
  now: Date
): Constraint | null {
  const date = fields.date && YMD.test(fields.date) ? fields.date : formatDate(now);
  const today = formatDate(now);
  const horizon = dayOffset(now, 7);

  switch (fields.type) {
    case 'day_off': {
      const list = (Array.isArray(fields.dates) && fields.dates.length ? fields.dates : [date]).filter((d) => YMD.test(d) && d >= today && d <= horizon);
      const dates = [...new Set(list)].sort().slice(0, 8);
      if (!dates.length) return null;
      return { type: 'day_off', description: input, parsedBy, dates, date: dates[0] };
    }
    case 'time_added': {
      const s = fields.freeStart && HHMM.test(fields.freeStart) ? fields.freeStart : null;
      let e = fields.freeEnd && HHMM.test(fields.freeEnd) ? fields.freeEnd : null;
      if (s && !e) {
        // "free from 8": two hours, but not past midnight
        const [h, m] = s.split(':').map(Number);
        e = `${String(Math.min(23, h + 2)).padStart(2, '0')}:${h + 2 > 23 ? '59' : String(m).padStart(2, '0')}`;
      }
      if (!s || !e || e <= s || date < today) return null;
      return { type: 'time_added', description: input, parsedBy, date, freeWindow: { start: s, end: e } };
    }
    case 'time_reduced': {
      const minutes = Number(fields.availableMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) return null;
      return { type: 'time_reduced', description: input, parsedBy, date, availableMinutes: Math.round(minutes) };
    }
    case 'deadline_added': {
      const time = fields.deadlineTime && HHMM.test(fields.deadlineTime) ? fields.deadlineTime : '17:00';
      const deadline = localDate(date, time);
      if (deadline <= now) return null;
      const about = typeof fields.about === 'string' ? fields.about.trim().slice(0, 60) : '';
      return { type: 'deadline_added', description: input, parsedBy, urgentDeadline: deadline, ...(about ? { about } : {}) };
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
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_RE = /\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday)?\b/g;

/** "friday" -> the next Friday (today if it's Friday) */
function nextWeekday(now: Date, day: number): string {
  return dayOffset(now, (day - now.getDay() + 7) % 7);
}
const dayIndex = (w: string) => WEEKDAYS.findIndex((d) => d.startsWith(w.slice(0, 3)));

/** The date a sentence talks about: tomorrow, a weekday name, else today */
function dateOf(lower: string, now: Date): string {
  if (/\btomorrow\b/.test(lower)) return dayOffset(now, 1);
  const m = [...lower.matchAll(DAY_RE)][0];
  return m ? nextWeekday(now, dayIndex(m[1])) : formatDate(now);
}

/** Every date a "days off" sentence covers: "Fri to Sun", "this weekend", "today and tomorrow" */
function datesOf(lower: string, now: Date): string[] {
  if (/\b(this )?weekend\b/.test(lower)) {
    const sat = nextWeekday(now, 6);
    return now.getDay() === 0 ? [formatDate(now)] : [sat, dayOffset(new Date(sat + 'T12:00:00'), 1)];
  }
  const days = [...lower.matchAll(DAY_RE)].map((m) => dayIndex(m[1]));
  if (days.length >= 2 && /\b(to|until|till|through|-|–)\b|-|–/.test(lower)) {
    const start = nextWeekday(now, days[0]);
    const span = (days[days.length - 1] - days[0] + 7) % 7;
    return Array.from({ length: span + 1 }, (_, i) => dayOffset(new Date(start + 'T12:00:00'), i));
  }
  if (days.length) return days.map((d) => nextWeekday(now, d));
  const out = [];
  if (/\btoday\b|\btonight\b/.test(lower) || !/\btomorrow\b/.test(lower)) out.push(formatDate(now));
  if (/\btomorrow\b/.test(lower)) out.push(dayOffset(now, 1));
  return out;
}

export function parseConstraintWithRules(input: string, now: Date = new Date()): Constraint | null {
  const lower = input.toLowerCase();
  const date = dateOf(lower, now);

  // Whole days out: sick, away, a trip, a day off, no studying
  if (/\b(sick|ill|unwell|day off|days off|away|travel(l?ing)?|trip|holiday|vacation|out of town|no study(ing)?|can'?t study|off (today|tomorrow|this weekend))\b/.test(lower) && !/\bonly\b/.test(lower)) {
    return toConstraint(input, { type: 'day_off', dates: datesOf(lower, now) }, 'rules', now);
  }

  // Extra free time: "free tonight from 8 to 10", "finished early, free from 3pm"
  const free = lower.match(/\bfree\b[^0-9]*?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s*(?:-|–|to|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/);
  if (free && !/\bnot free\b/.test(lower)) {
    const evening = /tonight|evening/.test(lower);
    const endMer = free[6] ?? free[3] ?? (evening || Number(free[1]) < 8 ? 'pm' : undefined);
    const startMer = free[3] ?? endMer;
    const start = to24h(free[1], free[2], startMer);
    const end = free[4] ? to24h(free[4], free[5], endMer) : null;
    return toConstraint(input, { type: 'time_added', date, freeStart: start, freeEnd: end }, 'rules', now);
  }

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
  if (/(close|closes|closing|due|deadline|submit by|apply by|moved to|is now on)/.test(lower)) {
    const at = lower.match(/at\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    const deadlineTime = at ? to24h(at[1], at[2], at[3] ?? 'pm') : '17:00';
    // What's due: the words before "closes / is due / moved"
    const about = input
      .split(/\b(?:closes|closing|close|is due|due|deadline|moved|submit by|apply by)\b/i)[0]
      .replace(/^(my|the|our)\s+/i, '')
      .trim()
      .slice(0, 60);
    return toConstraint(input, { type: 'deadline_added', date, deadlineTime, about }, 'rules', now);
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
- "deadline_added": something is now due at a time (a job application, an exam, an assignment, a course). Fill deadlineTime and "about" = what is due in 2-5 words, e.g. "Monzo application", "AWS exam".
- "shift_conflict": they are busy during a time range (work shift, meeting, appointment). Fill shiftStart and shiftEnd. If no times are given, use 18:00-22:00.
- "day_off": whole days with no study time (sick, travelling, away, a holiday, "no studying this weekend"). Fill "dates" with every date covered (within the next 7 days).
- "time_added": they have EXTRA free time (finished work early, a cancelled plan). Fill freeStart and freeEnd (if no end is given, 2 hours after the start).
- "unknown": anything else.

Return ONLY a JSON object:
{"type": "...", "date": "YYYY-MM-DD", "dates": ["YYYY-MM-DD"]|null, "availableMinutes": number|null, "deadlineTime": "HH:MM"|null, "about": string|null, "shiftStart": "HH:MM"|null, "shiftEnd": "HH:MM"|null, "freeStart": "HH:MM"|null, "freeEnd": "HH:MM"|null}
Use 24-hour times. "tonight" means today. "tomorrow" means the day after today. A weekday name means the next one (today if it is that day).

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
