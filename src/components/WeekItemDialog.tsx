/**
 * WeekItemDialog - everything you can do from the calendar.
 *
 * - add: click an empty spot (or "Add") to add something to do, which Ropi
 *   fits into your free time, or busy time, which Ropi plans around
 * - block: click a planned block to see when and why, then start it, mark it
 *   done or remove it
 * - event: click busy time to remove it
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, CalendarClock, CheckCircle2, Clock, Trash2, X } from '@/components/icons';
import { useWeek } from '@/hooks/useWeek';
import { parseQuickAdd } from '@/lib/week/quick-add';
import { formatDate } from '@/lib/scheduling/utils';
import type { Event, Task, TimeBlock } from '@/lib/scheduling/types';
import { cn } from '@/lib/utils';

export type WeekItem =
  | { kind: 'add'; date: Date; minute?: number }
  | { kind: 'block'; task: Task; block: TimeBlock }
  | { kind: 'event'; event: Event };

const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtDay = (d: Date | string) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const pad = (n: number) => String(n).padStart(2, '0');
const toHHMM = (minute: number) => `${pad(Math.floor(minute / 60) % 24)}:${pad(minute % 60)}`;
const LENGTHS = [15, 30, 45, 60, 90];

export function WeekItemDialog({ item, onClose }: { item: WeekItem | null; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[hsl(225_20%_8%/0.35)] backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 overflow-hidden rounded-2xl border bg-card shadow-float focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {item?.kind === 'add' && <AddForm key={`${item.date.toISOString()}-${item.minute}`} date={item.date} minute={item.minute} onDone={onClose} />}
          {item?.kind === 'block' && <BlockDetails task={item.task} block={item.block} onDone={onClose} />}
          {item?.kind === 'event' && <EventDetails event={item.event} onDone={onClose} />}
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-8 rounded-lg border px-2.5 text-[12.5px] font-medium tabular-nums transition-colors',
        active ? 'border-primary bg-accent text-primary' : 'bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function AddForm({ date, minute, onDone }: { date: Date; minute?: number; onDone: () => void }) {
  const { addTask, addEvent } = useWeek();
  const [type, setType] = useState<'todo' | 'busy'>('todo');
  const [title, setTitle] = useState('');
  const [length, setLength] = useState(30);
  const [byDay, setByDay] = useState(minute !== undefined);
  const start0 = minute ?? 18 * 60;
  const [day, setDay] = useState(formatDate(date));
  const [from, setFrom] = useState(toHHMM(start0));
  const [to, setTo] = useState(toHHMM(Math.min(start0 + 60, 23 * 60 + 59)));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, [type]);

  const dayName = new Date(`${day}T12:00`).toLocaleDateString('en-US', { weekday: 'long' });
  const isToday = day === formatDate(new Date());
  const busyValid = from < to;
  const valid = title.trim().length > 0 && (type === 'todo' || busyValid);

  const submit = () => {
    if (!valid) return;
    if (type === 'todo') {
      const deadline = byDay ? new Date(`${day}T23:00`) : undefined;
      const category = parseQuickAdd(title)?.category ?? 'life';
      addTask({
        title: title.trim(),
        duration: length,
        priority: 'P2',
        deadline: deadline?.toISOString(),
        category,
        tags: category === 'learning' ? ['study'] : undefined,
      });
    } else {
      addEvent({ title: title.trim(), startTime: new Date(`${day}T${from}`).toISOString(), endTime: new Date(`${day}T${to}`).toISOString() });
    }
    onDone();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="px-5 pt-5">
        <DialogPrimitive.Title className="text-[15px] font-semibold">
          Add to {isToday ? 'today' : dayName}
          <span className="ml-1.5 font-normal text-muted-foreground">
            {new Date(`${day}T12:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </DialogPrimitive.Title>
        <div className="mt-3 inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="What are you adding?">
          {(
            [
              ['todo', 'Something to do'],
              ['busy', 'Busy time'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={type === v}
              onClick={() => setType(v)}
              className={cn(
                'rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors',
                type === v ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(225_20%_8%/0.08)]' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <input
          ref={inputRef}
          aria-label={type === 'todo' ? 'What do you need to do?' : 'What are you busy with?'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={type === 'todo' ? 'Read chapter 4' : 'Shift at work'}
          className="h-11 w-full rounded-xl border bg-background px-3 text-[14.5px] placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        />

        {type === 'todo' ? (
          <>
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">How long</div>
              <div className="flex flex-wrap gap-1.5">
                {LENGTHS.map((m) => (
                  <Chip key={m} active={length === m} onClick={() => setLength(m)}>
                    {m < 60 ? `${m}m` : `${m / 60}h`.replace('1.5h', '1h 30m')}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">When</div>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={byDay} onClick={() => setByDay(true)}>
                  By {isToday ? 'tonight' : dayName}
                </Chip>
                <Chip active={!byDay} onClick={() => setByDay(false)}>
                  Any time this week
                </Chip>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground">Ropi puts it in your free time{byDay ? ` before ${isToday ? 'tonight ends' : `${dayName} ends`}` : ''}.</p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2">
              <label className="text-[12px] font-medium text-muted-foreground">
                Day
                <input
                  type="date"
                  value={day}
                  min={formatDate(new Date())}
                  onChange={(e) => e.target.value && setDay(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-[13px] text-foreground focus:border-primary focus:outline-none"
                />
              </label>
              <label className="text-[12px] font-medium text-muted-foreground">
                From
                <input
                  type="time"
                  step={900}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-[13px] text-foreground focus:border-primary focus:outline-none"
                />
              </label>
              <label className="text-[12px] font-medium text-muted-foreground">
                To
                <input
                  type="time"
                  step={900}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-[13px] text-foreground focus:border-primary focus:outline-none"
                />
              </label>
            </div>
            <p className={cn('text-[12px]', busyValid ? 'text-muted-foreground' : 'text-destructive')}>
              {busyValid ? 'Ropi keeps this time clear and moves anything planned here.' : 'End time needs to be after the start.'}
            </p>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t bg-background/60 px-5 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!valid}>
          {type === 'todo' ? 'Add' : 'Block this time'}
        </Button>
      </div>
    </form>
  );
}

function BlockDetails({ task, block, onDone }: { task: Task; block: TimeBlock; onDone: () => void }) {
  const navigate = useNavigate();
  const { checkIn, removeTask } = useWeek();
  const mine = task.source === 'you' || task.source === 'sample';
  const mins = Math.round((new Date(block.endTime).getTime() - new Date(block.startTime).getTime()) / 60000);
  const part = block.totalBlocks > 1 ? `Part ${block.blockIndex + 1} of ${block.totalBlocks}` : null;
  const deadline = useMemo(() => (task.deadline ? new Date(task.deadline) : null), [task.deadline]);

  return (
    <div>
      <div className="px-5 pb-4 pt-5">
        <div className="eyebrow mb-1.5">{task.category === 'career' ? 'Career' : task.category === 'learning' ? 'Learning' : 'Planned'}</div>
        <DialogPrimitive.Title className="pr-6 text-[17px] font-semibold leading-snug">{task.title}</DialogPrimitive.Title>
        <div className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" />
            {fmtDay(block.startTime)}, {fmtTime(block.startTime)} to {fmtTime(block.endTime)}
            <span className="tabular-nums">· {mins} min</span>
          </div>
          {deadline && (
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 shrink-0" />
              Due {fmtDay(deadline)}, {fmtTime(deadline)}
            </div>
          )}
          {part && <div className="pl-6 text-[12px]">{part}</div>}
        </div>
        {task.why && <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[12.5px] leading-relaxed">{task.why}</p>}
      </div>
      <div className="flex items-center gap-2 border-t bg-background/60 px-5 py-3">
        {mine && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              removeTask(task.id);
              onDone();
            }}
          >
            <Trash2 />
            Remove
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          {mine && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                checkIn(task.id, 'done');
                onDone();
              }}
            >
              <CheckCircle2 />
              Mark done
            </Button>
          )}
          {task.href && (
            <Button
              size="sm"
              onClick={() => {
                onDone();
                navigate(task.href!);
              }}
            >
              Start
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EventDetails({ event, onDone }: { event: Event; onDone: () => void }) {
  const removeEvent = useWeek((s) => s.removeEvent);
  return (
    <div>
      <div className="px-5 pb-4 pt-5">
        <div className="eyebrow mb-1.5">Busy</div>
        <DialogPrimitive.Title className="pr-6 text-[17px] font-semibold leading-snug">{event.title}</DialogPrimitive.Title>
        <div className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          {fmtDay(event.startTime)}, {fmtTime(event.startTime)} to {fmtTime(event.endTime)}
        </div>
        <p className="mt-3 text-[12.5px] text-muted-foreground">Ropi doesn't plan anything during this time.</p>
      </div>
      <div className="flex justify-end gap-2 border-t bg-background/60 px-5 py-3">
        <Button
          variant="outline"
          size="sm"
          className="hover:border-destructive/40 hover:text-destructive"
          onClick={() => {
            removeEvent(event.id);
            onDone();
          }}
        >
          <Trash2 />
          Remove busy time
        </Button>
      </div>
    </div>
  );
}
