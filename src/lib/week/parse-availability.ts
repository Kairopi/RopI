/**
 * "Weeknights after 7, Saturday morning" -> weekly free-time windows.
 *
 * Meta Muse (JSON mode, minimal reasoning) reads the sentence; deterministic
 * rules handle common phrasings when Muse is unavailable. Same pattern as the
 * LifeShift constraint parser.
 */

import { callMuse, isMuseConfigured, MUSE_MODELS } from '@/lib/api/muse';
import type { AvailabilityWindow } from '@/lib/scheduling/types';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export interface ParsedAvailability {
  windows: AvailabilityWindow[];
  parsedBy: 'muse' | 'rules';
}

const pad = (n: number) => String(n).padStart(2, '0');

function to24(h: number, m: number, mer?: string): string {
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  return `${pad(h)}:${pad(m)}`;
}

function daysIn(segment: string): number[] {
  const s = segment.toLowerCase();
  if (/\b(every ?day|daily|each day|all week)\b/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
  const days = new Set<number>();
  if (/\b(week ?nights?|week ?days?|mon(day)?\s*(-|to|–)\s*fri(day)?|after work)\b/.test(s)) [1, 2, 3, 4, 5].forEach((d) => days.add(d));
  if (/\bweekends?\b/.test(s)) [0, 6].forEach((d) => days.add(d));
  DAY_NAMES.forEach((name, i) => {
    if (new RegExp(`\\b${name}[a-z]*\\b`).test(s)) days.add(i);
  });
  return [...days];
}

function timesIn(segment: string): { startTime: string; endTime: string } | null {
  const s = segment.toLowerCase();
  const range = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (range) {
    const endMer = range[6] ?? range[3] ?? (parseInt(range[4], 10) < 8 ? 'pm' : undefined);
    const startMer = range[3] ?? (endMer === 'pm' && parseInt(range[1], 10) <= parseInt(range[4], 10) ? 'pm' : endMer);
    const start = to24(parseInt(range[1], 10), range[2] ? parseInt(range[2], 10) : 0, startMer);
    const end = to24(parseInt(range[4], 10), range[5] ? parseInt(range[5], 10) : 0, endMer);
    return end > start ? { startTime: start, endTime: end } : null;
  }
  const after = s.match(/(?:after|from)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (after) {
    const h = parseInt(after[1], 10);
    const mer = after[3] ?? (h < 12 ? 'pm' : undefined);
    const start = to24(h, after[2] ? parseInt(after[2], 10) : 0, mer);
    const endH = Math.min(parseInt(start, 10) + 2, 23);
    return { startTime: start, endTime: `${pad(endH)}:${start.slice(3)}` };
  }
  if (/\bmornings?\b/.test(s)) return { startTime: '09:00', endTime: '12:00' };
  if (/\blunch\b/.test(s)) return { startTime: '12:00', endTime: '13:00' };
  if (/\bafternoons?\b/.test(s)) return { startTime: '14:00', endTime: '17:00' };
  if (/\b(evenings?|nights?|tonight)\b/.test(s)) return { startTime: '19:00', endTime: '21:00' };
  return null;
}

export function parseAvailabilityWithRules(input: string): AvailabilityWindow[] {
  const windows: AvailabilityWindow[] = [];
  let lastDays: number[] = [];
  let pending: number[] = []; // "Tue and Thu 6-8pm": Tue has no time yet
  for (const segment of input.split(/[,;.]|\band\b|\bplus\b/i)) {
    if (!segment.trim()) continue;
    const days = daysIn(segment);
    const time = timesIn(segment);
    if (!time) {
      pending.push(...days);
      continue;
    }
    const useDays = days.length || pending.length ? [...new Set([...pending, ...days])] : lastDays;
    pending = [];
    if (!useDays.length) continue;
    lastDays = useDays;
    useDays.forEach((day) => windows.push({ day, ...time }));
  }
  return mergeWindows(windows);
}

/** Sort, drop invalid, merge overlapping windows on the same day */
export function mergeWindows(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  const valid = windows
    .filter((w) => w.day >= 0 && w.day <= 6 && HHMM.test(w.startTime) && HHMM.test(w.endTime) && w.endTime > w.startTime)
    .sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime));
  const out: AvailabilityWindow[] = [];
  for (const w of valid) {
    const last = out[out.length - 1];
    if (last && last.day === w.day && w.startTime <= last.endTime) {
      if (w.endTime > last.endTime) last.endTime = w.endTime;
    } else {
      out.push({ ...w });
    }
  }
  return out;
}

export async function parseAvailability(input: string): Promise<ParsedAvailability> {
  const text = input.trim();
  if (!text) return { windows: [], parsedBy: 'rules' };

  if (isMuseConfigured()) {
    try {
      const raw = await callMuse(
        `A user describes when they are usually FREE each week to study and work on job applications.
Turn it into weekly windows. day: 0=Sunday, 1=Monday ... 6=Saturday. Times are 24-hour HH:MM local.
"weeknights"/"after work" = Monday-Friday. If only a start is given ("after 7"), assume 2 hours.
"morning" = 09:00-12:00, "afternoon" = 14:00-17:00, "evening" = 19:00-21:00, "lunch" = 12:00-13:00.
Return ONLY a JSON object: {"windows":[{"day":1,"startTime":"19:00","endTime":"21:00"}]}

User: "${text.replace(/"/g, "'")}"`,
        { model: MUSE_MODELS.fast, reasoningEffort: 'minimal', json: true, maxTokens: 1500, timeoutMs: 15000 }
      );
      const data = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
      const windows = mergeWindows(
        (Array.isArray(data?.windows) ? data.windows : []).map((w: any) => ({
          day: Number(w.day),
          startTime: String(w.startTime ?? ''),
          endTime: String(w.endTime ?? ''),
        }))
      );
      if (windows.length) return { windows, parsedBy: 'muse' };
    } catch (error) {
      console.warn('Muse availability parsing failed, using rules:', error);
    }
  }

  return { windows: parseAvailabilityWithRules(text), parsedBy: 'rules' };
}
