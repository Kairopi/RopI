/**
 * Your day and your week, in a form you can read at a glance or hear out loud.
 *
 * Built from the plan itself (scheduled blocks + busy time), not from a model,
 * so "Read me my day" is instant, works offline from Muse, and is never wrong
 * about a time. Used by Today ("Hear my day") and Talk ("what do I have today?",
 * "read me my week").
 */

import type { Event, Task, TimeBlock } from '@/lib/scheduling/types';

export interface AgendaItem {
  id: string;
  start: string;
  end: string;
  title: string;
  minutes: number;
  kind: 'task' | 'busy';
  category?: string;
  href?: string;
  taskId?: string;
  why?: string;
  source?: Task['source'];
}

export interface AgendaDay {
  /** YYYY-MM-DD, local */
  key: string;
  date: Date;
  /** "Today", "Tomorrow", "Friday" */
  name: string;
  items: AgendaItem[];
  /** Planned task minutes (not busy time) */
  plannedMinutes: number;
}

export interface BriefInput {
  tasks: Task[];
  blocks: TimeBlock[];
  events: Event[];
  atRisk: { taskId: string }[];
  now?: Date;
}

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mins = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));

/** The next `days` days, each with its blocks and busy time in order (past items today are dropped) */
export function buildAgenda(input: BriefInput, days = 7): AgendaDay[] {
  const now = input.now ?? new Date();
  const tasks = new Map(input.tasks.map((t) => [t.id, t]));
  const out: AgendaDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + i);
    out.push({
      key: localKey(date),
      date,
      name: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'long' }),
      items: [],
      plannedMinutes: 0,
    });
  }
  const byKey = new Map(out.map((d) => [d.key, d]));
  for (const b of input.blocks) {
    if (new Date(b.endTime).getTime() <= now.getTime()) continue;
    const day = byKey.get(localKey(new Date(b.startTime)));
    const t = tasks.get(b.taskId);
    if (!day || !t) continue;
    const m = mins(b.startTime, b.endTime);
    day.items.push({ id: b.id, start: b.startTime, end: b.endTime, title: t.title, minutes: m, kind: 'task', category: t.category, href: t.href, taskId: t.id, why: t.why, source: t.source });
    day.plannedMinutes += m;
  }
  for (const e of input.events) {
    if (e.isAllDay || new Date(e.endTime).getTime() <= now.getTime()) continue;
    const day = byKey.get(localKey(new Date(e.startTime)));
    if (!day) continue;
    day.items.push({ id: e.id, start: e.startTime, end: e.endTime, title: e.title, minutes: mins(e.startTime, e.endTime), kind: 'busy' });
  }
  for (const d of out) d.items.sort((a, b) => a.start.localeCompare(b.start));
  return out;
}

// ---------- saying it ----------

/** "7 PM", "7:05 PM" */
export function sayTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** "1 hour 10 minutes", "45 minutes" */
export function sayDuration(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} minute${m === 1 ? '' : 's'}`;
  return `${h} hour${h === 1 ? '' : 's'}${m ? ` ${m} minute${m === 1 ? '' : 's'}` : ''}`;
}

/** Task titles as you'd say them: "Apply: Monzo, Product Manager" -> "apply to Monzo for Product Manager" */
export function sayTitle(title: string): string {
  const t = title.trim();
  let m = t.match(/^Apply:\s*(.+?),\s*(.+)$/i);
  if (m) return `apply to ${m[1]} for ${m[2]}`;
  m = t.match(/^Apply:\s*(.+)$/i);
  if (m) return `apply to ${m[1]}`;
  m = t.match(/^Practice:\s*(.+)$/i);
  if (m) return `practise ${m[1]}`;
  m = t.match(/^Prep interview:\s*(.+)$/i);
  if (m) return `prepare for your ${m[1]} interview`;
  return /^[A-Z][a-z]/.test(t) && !/^(AWS|VPC|API|SQL)\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

const list = (parts: string[]) => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);
const partOfDay = (iso: string) => {
  const h = new Date(iso).getHours();
  return h < 12 ? 'this morning' : h < 17 ? 'this afternoon' : 'tonight';
};

export interface DayBriefOptions {
  dueCards?: number;
  /** Things that close soon: "Monzo closes Saturday at 5 PM" */
  deadlines?: { title: string; at: string }[];
  atRiskTitles?: string[];
  /** Spoken at the end, e.g. an offer to add something */
  close?: string;
}

/** Today (or the next day with something on), as a few spoken sentences */
export function dayBrief(days: AgendaDay[], opts: DayBriefOptions = {}): { text: string; day: AgendaDay | null } {
  const today = days[0];
  const tasks = today?.items.filter((i) => i.kind === 'task') ?? [];
  const parts: string[] = [];
  const weekday = today?.date.toLocaleDateString('en-US', { weekday: 'long' }) ?? 'today';

  let shown: AgendaDay | null = today ?? null;
  if (tasks.length) {
    const when = partOfDay(tasks[0].start);
    parts.push(
      `It's ${weekday}. You have ${tasks.length} thing${tasks.length === 1 ? '' : 's'} planned ${when}, ${sayDuration(today.plannedMinutes)} in all.`
    );
    const read = today.items.slice(0, 5).map((i, n) => {
      const t = i.kind === 'busy' ? `${i.title} (busy)` : sayTitle(i.title);
      return `${n === 0 ? 'At' : n === today.items.length - 1 && n < 5 ? 'And at' : 'At'} ${sayTime(i.start)}, ${t}.`;
    });
    parts.push(read.join(' '));
    if (today.items.length > 5) parts.push(`And ${today.items.length - 5} more after that.`);
  } else {
    const next = days.find((d, i) => i > 0 && d.items.some((x) => x.kind === 'task'));
    shown = next ?? null;
    if (next) {
      const first = next.items.find((x) => x.kind === 'task')!;
      parts.push(`Nothing else is planned today. ${next.name}, the first thing is ${sayTitle(first.title)} at ${sayTime(first.start)}.`);
    } else {
      parts.push('Nothing is planned for the next 7 days.');
    }
  }
  if (opts.dueCards) parts.push(`${opts.dueCards} review card${opts.dueCards === 1 ? ' is' : 's are'} due, about ${Math.max(1, Math.ceil((opts.dueCards * 20) / 60))} minute${opts.dueCards * 20 > 60 ? 's' : ''}.`);
  for (const d of (opts.deadlines ?? []).slice(0, 2)) {
    parts.push(`${d.title} closes ${new Date(d.at).toLocaleDateString('en-US', { weekday: 'long' })} at ${sayTime(d.at)}.`);
  }
  if (opts.atRiskTitles?.length) parts.push(`${list(opts.atRiskTitles.slice(0, 2).map(sayTitle))} ${opts.atRiskTitles.length === 1 ? "doesn't" : "don't"} fit this week.`);
  if (opts.close) parts.push(opts.close);
  return { text: parts.join(' '), day: shown };
}

/** The next 7 days, in a few spoken sentences */
export function weekBrief(days: AgendaDay[], opts: { freeMinutes?: number; atRiskTitles?: string[]; close?: string } = {}): string {
  const planned = days.reduce((s, d) => s + d.plannedMinutes, 0);
  const parts: string[] = [];
  parts.push(
    planned
      ? `This week you have ${sayDuration(planned)} planned${opts.freeMinutes ? ` in ${sayDuration(opts.freeMinutes)} of free time` : ''}.`
      : 'Nothing is planned this week yet.'
  );
  const free: string[] = [];
  for (const d of days) {
    const tasks = d.items.filter((i) => i.kind === 'task');
    const busy = d.items.filter((i) => i.kind === 'busy');
    if (!tasks.length && !busy.length) {
      free.push(d.name);
      continue;
    }
    // In the order they happen: "gym class at 7 PM, then practice interview questions at 8 PM"
    const bits: { at: string; say: string }[] = [];
    if (tasks.length) {
      const first = tasks[0];
      bits.push({
        at: first.start,
        say:
          tasks.length === 1
            ? `${sayTitle(first.title)} at ${sayTime(first.start)}`
            : `${tasks.length} things from ${sayTime(first.start)}, starting with ${sayTitle(first.title)}`,
      });
    }
    if (busy.length) bits.push({ at: busy[0].start, say: `${busy[0].title.toLowerCase()} at ${sayTime(busy[0].start)}` });
    bits.sort((a, b) => a.at.localeCompare(b.at));
    parts.push(`${d.name}: ${bits.map((b) => b.say).join(', then ')}.`);
  }
  if (free.length) parts.push(`${list(free)} ${free.length === 1 ? 'is' : 'are'} free.`);
  parts.push(opts.atRiskTitles?.length ? `${list(opts.atRiskTitles.slice(0, 2).map(sayTitle))} ${opts.atRiskTitles.length === 1 ? "doesn't" : "don't"} fit. LifeShift can help.` : 'Everything fits.');
  if (opts.close) parts.push(opts.close);
  return parts.join(' ');
}
