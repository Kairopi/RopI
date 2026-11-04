/**
 * WeekCanvas - ROPI's signature view: "the week shifts"
 *
 * A 7-day calendar of the plan. Every time block has a stable layoutId
 * (task + chunk), so when the plan changes the SAME block travels from its
 * old slot to its new one (framer-motion shared layout animation).
 * A dashed ghost stays briefly where it used to be, shrunk free time is
 * visible in place, and a task that no longer fits drops into the at-risk tray.
 *
 * Only hours that contain free time, events or blocks are drawn, so short
 * evening slots stay readable instead of being lost in a 24-hour grid.
 */

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Plus } from '@/components/icons';
import type { Plan } from '@/lib/scheduling/plan';
import type { Event, Task, TimeBlock } from '@/lib/scheduling/types';
import { formatDate } from '@/lib/scheduling/utils';
import { windowsForDate } from '@/lib/scheduling/constraints';

interface WeekCanvasProps {
  plan: Plan;
  /** Plan before the last change: used to draw ghosts of moved blocks */
  previous?: Plan | null;
  movedTaskIds?: string[];
  /** Smaller rows, no at-risk tray (Dashboard) */
  compact?: boolean;
  /** Changes whenever a new replan happens, so ghosts re-appear */
  revision?: number;
  onBlockClick?: (task: Task, block: TimeBlock) => void;
  onEventClick?: (event: Event) => void;
  /** Click on an empty spot: the day and the minute of day (snapped to 30 min) */
  onAdd?: (date: Date, minute: number) => void;
}

/** Calendar date range shown, e.g. "Nov 4 – 10" or "Nov 28 – Dec 4" */
export function weekRangeLabel(days = DAYS) {
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + days - 1);
  const m = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  return start.getMonth() === end.getMonth()
    ? `${m(start)} ${start.getDate()} – ${end.getDate()}`
    : `${m(start)} ${start.getDate()} – ${m(end)} ${end.getDate()}`;
}

const DAYS = 7;

const minutesOfDay = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const hhmmToMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function blockKey(b: Pick<TimeBlock, 'taskId' | 'blockIndex'>) {
  return `${b.taskId}:${b.blockIndex}`;
}

export default function WeekCanvas({
  plan,
  previous,
  movedTaskIds = [],
  compact = false,
  revision = 0,
  onBlockClick,
  onEventClick,
  onAdd,
}: WeekCanvasProps) {
  const reduceMotion = useReducedMotion();
  const hourHeight = compact ? 56 : 80; // 15-min block = 14px compact, 20px full
  // Tall enough for one line of text: a 5-minute block is still readable
  const minBlock = compact ? 17 : 20;
  const frameHeight = compact ? 448 : 560; // ~8 hours visible, the rest scrolls

  // The 7 local days shown, starting today
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, []);
  const dayIndex = useMemo(() => new Map(days.map((d, i) => [formatDate(d), i])), [days]);

  // Free windows and events per day (for shading)
  const shading = useMemo(
    () =>
      days.map((d) => ({
        free: windowsForDate(plan.availability, d).map((w) => ({ start: hhmmToMin(w.startTime), end: hhmmToMin(w.endTime) })),
        events: plan.events
          .filter((e) => !e.isAllDay && formatDate(new Date(e.startTime)) === formatDate(d))
          .map((e) => ({ id: e.id, title: e.title, start: minutesOfDay(e.startTime), end: minutesOfDay(e.endTime) })),
      })),
    [days, plan.availability, plan.events]
  );

  // The full day, midnight to midnight, every hour the same height (like any calendar).
  // The grid scrolls inside a fixed-height frame and opens at the part of the day that matters.
  const segments = useMemo(
    () => Array.from({ length: 24 }, (_, h) => ({ hour: h, y: h * hourHeight, height: hourHeight, gapBefore: false })),
    [hourHeight]
  );

  // Where to open: an hour before the earliest of now (today) or the first block / free time
  const scrollRef = useRef<HTMLDivElement>(null);
  // Open where your plan is: half an hour before the earliest planned block this week
  // (else your earliest free time, else 6pm). Scroll for the rest of the 24 hours.
  const firstMinute = useMemo(() => {
    const blocks = plan.schedule.blocks.map((b) => minutesOfDay(b.startTime));
    const free = shading.flatMap((s) => s.free.map((f) => f.start));
    const earliest = blocks.length ? Math.min(...blocks) : free.length ? Math.min(...free) : 18 * 60;
    return Math.max(0, earliest - 30);
  }, [plan.schedule.blocks, shading]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = (firstMinute / 60) * hourHeight;
    // only on mount and when the view size changes, so it doesn't jump while you scroll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourHeight]);

  const last = segments[segments.length - 1];
  const totalHeight = last ? last.y + last.height : hourHeight;

  /** Minute of day -> y (px) using the variable-height hour segments */
  const yFor = (minute: number) => {
    const h = Math.floor(minute / 60);
    const seg = segments.find((s) => s.hour === h);
    if (seg) return seg.y + ((minute % 60) / 60) * seg.height;
    // Not visible: snap to the nearest visible edge
    const after = segments.find((s) => s.hour > h);
    return after ? after.y : totalHeight;
  };

  /** y (px) -> minute of day snapped to 30 min, or null in a gap between visible hours */
  const minuteAt = (y: number) => {
    const seg = segments.find((s) => y >= s.y && y < s.y + s.height);
    if (!seg) return null;
    const raw = seg.hour * 60 + ((y - seg.y) / seg.height) * 60;
    return Math.min(23 * 60 + 30, Math.floor(raw / 30) * 30);
  };
  const [hover, setHover] = useState<{ day: number; minute: number } | null>(null);

  // Phones get a one-day view
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [focusDay, setFocusDay] = useState(0);
  const pointer = (e: MouseEvent<HTMLDivElement>) => e.clientY - e.currentTarget.getBoundingClientRect().top;

  // Current-time line on today's column
  const [nowMin, setNowMin] = useState(() => minutesOfDay(new Date().toISOString()));
  useEffect(() => {
    const t = setInterval(() => setNowMin(minutesOfDay(new Date().toISOString())), 60_000);
    return () => clearInterval(t);
  }, []);
  const nowVisible = segments.some((s) => s.hour === Math.floor(nowMin / 60));

  const tasksById = useMemo(() => new Map(plan.tasks.map((t) => [t.id, t])), [plan.tasks]);
  const eventsById = useMemo(() => new Map(plan.events.map((e) => [e.id, e])), [plan.events]);
  const moved = useMemo(() => new Set(movedTaskIds), [movedTaskIds]);

  // Ghosts: previous position of moved blocks, shown for a few seconds after each replan
  const [showGhosts, setShowGhosts] = useState(false);
  useEffect(() => {
    if (!previous || movedTaskIds.length === 0) return;
    setShowGhosts(true);
    const t = setTimeout(() => setShowGhosts(false), 3500);
    return () => clearTimeout(t);
  }, [revision, previous, movedTaskIds.length]);

  const ghosts = showGhosts && previous
    ? previous.schedule.blocks.filter((b) => moved.has(b.taskId) && dayIndex.has(b.date))
    : [];

  const placed = plan.schedule.blocks.filter((b) => dayIndex.has(b.date));
  const scheduledTaskIds = new Set(plan.schedule.blocks.map((b) => b.taskId));
  const atRisk = plan.schedule.atRiskTasks;

  // Choreography: moved blocks travel one after another
  const movedOrder = new Map(
    [...placed].filter((b) => moved.has(b.taskId)).sort((a, b) => a.startTime.localeCompare(b.startTime)).map((b, i) => [blockKey(b), i])
  );
  const layoutTransition = (b: TimeBlock) =>
    reduceMotion
      ? { duration: 0 }
      : { type: 'spring' as const, stiffness: 170, damping: 24, mass: 0.9, delay: (movedOrder.get(blockKey(b)) ?? 0) * 0.09 };

  const today = formatDate(new Date());

  /** Back-to-back short blocks: each one starts below the last, so none hides another (the tooltip and dialog keep the exact time) */
  const stackDay = (blocks: TimeBlock[]) => {
    let floor = -Infinity;
    return [...blocks]
      .sort((a, c) => a.startTime.localeCompare(c.startTime))
      .map((b) => {
        const trueTop = yFor(minutesOfDay(b.startTime));
        const top = Math.max(trueTop, floor);
        const height = Math.max(minBlock, yFor(minutesOfDay(b.endTime)) - trueTop - 2);
        floor = top + height + 2;
        return { b, top, height };
      });
  };

  const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;

  const cols = `36px repeat(${narrow ? 1 : DAYS}, minmax(0, 1fr))`;

  return (
    <LayoutGroup id="week">
      {/* Phones: one day at a time, pick it from a date strip */}
      {narrow && (
        <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Day">
          {days.map((d, i) => {
            const isToday = formatDate(d) === today;
            const count = plan.schedule.blocks.filter((b) => b.date === formatDate(d)).length;
            return (
              <button
                key={d.toISOString()}
                role="tab"
                aria-selected={focusDay === i}
                aria-label={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                onClick={() => setFocusDay(i)}
                className={`flex min-w-[44px] flex-1 flex-col items-center rounded-lg py-1.5 transition-colors ${
                  focusDay === i ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className="text-[10.5px] font-medium uppercase tracking-[0.06em]">{d.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                <span className={`text-[14px] font-semibold tabular-nums ${isToday && focusDay !== i ? 'text-primary' : ''}`}>{d.getDate()}</span>
                <span className={`mt-0.5 h-1 w-1 rounded-full ${count ? (focusDay === i ? 'bg-background' : 'bg-primary') : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
      )}
      <div className={narrow ? '' : 'overflow-x-auto -mx-1 px-1'}>
        <div className={narrow ? '' : compact ? 'min-w-[640px]' : 'min-w-[660px]'}>
          {/* Day headers (the date strip replaces them on phones) */}
          <div className={narrow ? 'hidden' : 'grid'} style={{ gridTemplateColumns: cols }}>
            <div />
            {days.map((d, hi) => {
              if (narrow && hi !== focusDay) return null;
              const isToday = formatDate(d) === today;
              return (
                <div key={d.toISOString()} className="flex items-center gap-1.5 px-1.5 pb-2" aria-label={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}>
                  <span className={`text-[11px] font-medium uppercase tracking-[0.06em] ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span
                    className={`flex h-6 min-w-[24px] items-center justify-center rounded-full px-1 text-[13px] font-semibold tabular-nums ${
                      isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Grid: all 24 hours, scrolling inside a fixed frame */}
          <div
            ref={scrollRef}
            data-calendar-scroll
            className="relative overflow-y-auto overscroll-contain rounded-b-lg border-t border-border/70"
            style={{ maxHeight: frameHeight }}
          >
          <div className="grid" style={{ gridTemplateColumns: cols }}>
            {/* Hour labels */}
            <div className="relative" style={{ height: totalHeight }}>
              {segments.map((s) =>
                s.hour === 0 ? null : (
                  <div key={s.hour} className="absolute right-2 text-[10px] text-muted-foreground tabular-nums" style={{ top: s.y - 6 }}>
                    {hourLabel(s.hour)}
                  </div>
                )
              )}
            </div>

            {days.map((d, di) => narrow && di !== focusDay ? null : (
              <div
                key={d.toISOString()}
                data-day={formatDate(d)}
                className={`relative border-l border-border/70 ${onAdd ? 'cursor-pointer' : ''}`}
                style={{ height: totalHeight }}
                onMouseMove={
                  onAdd
                    ? (e) => {
                        const m = minuteAt(pointer(e));
                        setHover((h) => (m === null ? null : h?.day === di && h.minute === m ? h : { day: di, minute: m }));
                      }
                    : undefined
                }
                onMouseLeave={onAdd ? () => setHover(null) : undefined}
                onClick={
                  onAdd
                    ? (e) => {
                        const m = minuteAt(pointer(e));
                        if (m !== null) onAdd(d, m);
                      }
                    : undefined
                }
              >
                {/* Night hours (before 6am, after 11pm) are tinted so the day reads at a glance */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bg-muted/40" style={{ height: 6 * hourHeight }} />
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bg-muted/40" style={{ top: 23 * hourHeight, height: hourHeight }} />
                {/* Hour and half-hour lines */}
                {segments.map((s) => (
                  <div key={s.hour}>
                    <div className="absolute inset-x-0 border-t border-border/60" style={{ top: s.y }} />
                    <div className="absolute inset-x-0 border-t border-dashed border-border/30" style={{ top: s.y + s.height / 2 }} />
                  </div>
                ))}

                {/* Free time: shrinks/splits in place when a constraint applies */}
                {shading[di].free.map((f, i) => (
                  <motion.div
                    key={`free-${i}`}
                    layout={!reduceMotion}
                    transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute inset-x-0.5 rounded-md bg-primary/[0.06]"
                    style={{ top: yFor(f.start), height: Math.max(2, yFor(f.end) - yFor(f.start)) }}
                  />
                ))}

                {/* Hover target for adding */}
                {hover?.day === di && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 z-[1] flex items-start gap-1 rounded-md border border-dashed border-primary/50 bg-primary/[0.05] px-1.5 text-[10.5px] font-medium text-primary"
                    style={{ top: yFor(hover.minute), height: Math.max(minBlock, yFor(hover.minute + 30) - yFor(hover.minute) - 2) }}
                  >
                    <Plus className="mt-[3px] h-3 w-3 shrink-0" />
                    <span className="truncate leading-[18px]">{hourLabel(Math.floor(hover.minute / 60))}{hover.minute % 60 ? ':30' : ''}</span>
                  </div>
                )}

                {/* Fixed events (busy time) */}
                {shading[di].events.map((e) => {
                  const height = Math.max(minBlock, yFor(e.end) - yFor(e.start) - 2);
                  const event = eventsById.get(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (event) onEventClick?.(event);
                      }}
                      onMouseMove={(ev) => ev.stopPropagation()}
                      onMouseEnter={() => setHover(null)}
                      className="absolute inset-x-1 z-[2] overflow-hidden rounded-md border border-dashed border-foreground/20 bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_6px,hsl(var(--background))_6px_12px)] px-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ top: yFor(e.start), height }}
                      title={`${e.title} (busy)`}
                    >
                      {height >= 16 && <span className="block truncate text-[10px] font-medium leading-[16px] text-muted-foreground">{e.title}</span>}
                    </button>
                  );
                })}

                {/* Now */}
                {formatDate(d) === today && nowVisible && (
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[4] flex items-center" style={{ top: yFor(nowMin) - 4 }}>
                    <span className="-ml-1 h-2 w-2 rounded-full bg-destructive" />
                    <span className="h-px flex-1 bg-destructive" />
                  </div>
                )}

                {/* Ghosts of where moved blocks used to be */}
                <AnimatePresence>
                  {ghosts
                    .filter((g) => g.date === formatDate(d))
                    .map((g) => (
                      <motion.div
                        key={`ghost-${blockKey(g)}-${revision}`}
                        initial={{ opacity: 0.9 }}
                        animate={{ opacity: 0.55 }}
                        exit={{ opacity: 0, transition: { duration: 0.6 } }}
                        className="absolute inset-x-1 rounded-md border-2 border-dashed border-primary/50"
                        style={{ top: yFor(minutesOfDay(g.startTime)), height: Math.max(minBlock, yFor(minutesOfDay(g.endTime)) - yFor(minutesOfDay(g.startTime))) }}
                      />
                    ))}
                </AnimatePresence>

                {/* Time blocks */}
                {stackDay(placed.filter((b) => b.date === formatDate(d))).map(({ b, top, height }) => {
                    const task = tasksById.get(b.taskId);
                    if (!task) return null;
                    const tone =
                      task.category === 'learning'
                        ? 'bg-primary text-primary-foreground'
                        : task.category === 'career'
                          ? 'bg-foreground text-background'
                          : 'bg-card text-foreground border border-foreground/20';
                    const isMoved = moved.has(b.taskId);
                    return (
                      <motion.button
                        key={blockKey(b)}
                        layoutId={blockKey(b)}
                        transition={{ layout: layoutTransition(b) }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onBlockClick?.(task, b);
                        }}
                        onMouseMove={(ev) => ev.stopPropagation()}
                        onMouseEnter={() => setHover(null)}
                        title={`${task.title} · ${fmtTime(b.startTime)} - ${fmtTime(b.endTime)}`}
                        className={`absolute inset-x-1 rounded-md px-1.5 text-left overflow-hidden shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
                          ${tone}
                          ${isMoved ? 'ring-2 ring-offset-1 ring-offset-background ring-[hsl(var(--warning))]' : ''}`}
                        style={{ top, height, zIndex: isMoved ? 3 : 2 }}
                      >
                        <span
                          className={`block font-medium ${compact ? 'truncate text-[10px] leading-[14px]' : 'text-[11px] leading-[14px] pt-1'} ${
                            !compact && height >= 50 ? 'line-clamp-2' : 'truncate'
                          }`}
                        >
                          {task.title}
                        </span>
                        {!compact && height >= 50 && (
                          <span className="block truncate text-[10px] opacity-75 mt-0.5">{fmtTime(b.startTime)}</span>
                        )}
                      </motion.button>
                    );
                  })}
              </div>
            ))}
          </div>
          </div>

          {/* At-risk tray: tasks that no longer fit drop in here */}
          {!compact && (
            <div className="mt-4 min-h-[44px] rounded-lg border border-dashed border-border p-2 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                {atRisk.length ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> : <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                {atRisk.length ? 'Doesn’t fit this week' : 'Everything fits this week'}
              </span>
              {atRisk.map((r) => {
                const task = tasksById.get(r.taskId);
                if (!task) return null;
                // Same layoutId as the block it replaces, so it visibly drops into the tray
                const fullyUnscheduled = !scheduledTaskIds.has(r.taskId);
                return (
                  <motion.div
                    key={`risk-${r.taskId}`}
                    layoutId={fullyUnscheduled ? `${r.taskId}:0` : undefined}
                    transition={{ layout: reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 24 } }}
                    className="rounded-md px-2 py-1 text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/30"
                    title={r.reason}
                  >
                    {task.title}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </LayoutGroup>
  );
}

/** Legend explaining block colors (shared by LifeShift and Dashboard) */
export function WeekLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary" />Learning</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-foreground" />Career</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-card border border-foreground/30" />Other</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary/10 border border-primary/20" />Free time</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-dashed border-foreground/25 bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_2px,hsl(var(--background))_2px_4px)]" />Busy</span>
    </div>
  );
}
