/**
 * Quick-add parser: one line becomes a task.
 *
 * Grammar adapted from Super Productivity's short syntax
 * (github.com/super-productivity/super-productivity, src/app/features/tasks/short-syntax.ts):
 *   duration   30m | 1h | 1.5h | 1h30m | 90min
 *   due        @today | @tonight | @tomorrow | @mon..@sun | @fri 5pm | @12/15
 *   priority   !1 (urgent) | !2 (high) | !3 (normal)
 *   area       #learning #study #career #job #life
 * Everything else is the title. Area is inferred from words when no tag is given.
 */

import type { Task } from '@/lib/scheduling/types';

export interface QuickAddResult {
  title: string;
  duration: number;
  deadline?: Date;
  priority: Task['priority'];
  category: 'learning' | 'career' | 'life';
  /** Pieces we recognised, for the live preview chips */
  tokens: { kind: 'duration' | 'due' | 'priority' | 'area'; text: string }[];
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const LEARNING_WORDS = /\b(study|learn|quiz|exam|cert|course|read|revise|review|practice|lesson|flashcards?|chapter|lecture|homework)\b/i;
const CAREER_WORDS = /\b(apply|application|resume|cv|cover letter|interview|recruiter|linkedin|portfolio|job|networking|referral)\b/i;

function parseTime(text: string | undefined): [number, number] | null {
  if (!text) return null;
  const m = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3]?.toLowerCase();
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  if (!mer && h < 8) h += 12; // "@fri 5" means 5pm
  if (h > 23 || min > 59) return null;
  return [h, min];
}

/** Resolve "@tomorrow", "@fri 5pm", "@12/15" to a local Date (end of day if no time) */
export function parseDue(raw: string, now: Date = new Date()): Date | null {
  const [word, time] = raw.toLowerCase().trim().split(/\s+/, 2);
  const d = new Date(now);
  d.setSeconds(0, 0);

  if (word === 'today' || word === 'tonight') {
    // keep date
  } else if (word === 'tomorrow' || word === 'tmr') {
    d.setDate(d.getDate() + 1);
  } else if (DAYS.some((day) => word.startsWith(day))) {
    const target = DAYS.findIndex((day) => word.startsWith(day));
    let diff = (target - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // "@fri" on a Friday means next Friday
    d.setDate(d.getDate() + diff);
  } else if (/^\d{1,2}\/\d{1,2}$/.test(word)) {
    const [mo, day] = word.split('/').map(Number);
    d.setMonth(mo - 1, day);
    if (d < now) d.setFullYear(d.getFullYear() + 1);
  } else {
    return null;
  }

  const t = parseTime(time);
  if (t) d.setHours(t[0], t[1]);
  else d.setHours(22, 0); // due by the end of that evening
  return d;
}

export function parseQuickAdd(input: string, now: Date = new Date()): QuickAddResult | null {
  let text = ` ${input.trim()} `;
  const tokens: QuickAddResult['tokens'] = [];

  // Duration: 1h30m, 1.5h, 45m, 90min
  let duration = 30;
  const dur = text.match(/\s(\d+(?:\.\d+)?)\s?(h|hr|hrs|hours?)(?:\s?(\d+)\s?(m|min|mins|minutes?))?(?=\s)|\s(\d+)\s?(m|min|mins|minutes?)(?=\s)/i);
  if (dur) {
    duration = dur[1] ? Math.round(parseFloat(dur[1]) * 60 + (dur[3] ? parseInt(dur[3], 10) : 0)) : parseInt(dur[5], 10);
    tokens.push({ kind: 'duration', text: `${duration} min` });
    text = text.replace(dur[0], ' ');
  }

  // Due: @word [time]
  let deadline: Date | undefined;
  const due = text.match(/\s@([a-z0-9/]+(?:\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)(?=\s)/i);
  if (due) {
    const parsed = parseDue(due[1], now);
    if (parsed) {
      deadline = parsed;
      tokens.push({
        kind: 'due',
        text: `Due ${parsed.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`,
      });
      text = text.replace(due[0], ' ');
    }
  }

  // Priority: !1 !2 !3
  let priority: Task['priority'] = 'P2';
  const pri = text.match(/\s!([1-3])(?=\s)/);
  if (pri) {
    priority = (`P${pri[1]}` as Task['priority']);
    tokens.push({ kind: 'priority', text: ['Urgent', 'High', 'Normal'][Number(pri[1]) - 1] });
    text = text.replace(pri[0], ' ');
  }

  // Area: #tag
  let category: QuickAddResult['category'] | null = null;
  const tag = text.match(/\s#(\w+)(?=\s)/);
  if (tag) {
    const t = tag[1].toLowerCase();
    category = /^(learn|learning|study|exam|cert)/.test(t) ? 'learning' : /^(career|job|work|apply)/.test(t) ? 'career' : 'life';
    tokens.push({ kind: 'area', text: category[0].toUpperCase() + category.slice(1) });
    text = text.replace(tag[0], ' ');
  }

  const title = text.replace(/\s+/g, ' ').trim();
  if (!title) return null;

  if (!category) category = CAREER_WORDS.test(title) ? 'career' : LEARNING_WORDS.test(title) ? 'learning' : 'life';

  return { title, duration: Math.min(Math.max(duration, 5), 8 * 60), deadline, priority, category, tokens };
}
