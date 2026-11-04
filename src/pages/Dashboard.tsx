/**
 * Today - the answer to "what do I do with the time I have, and why?"
 *
 * Got a few minutes (dead time, right now), then up next + add, then the week (click any empty time to add to it), then what
 * Ropi added from your quizzes and jobs, and what you actually did.
 * Every section below the fold can be collapsed.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Brain, Target, Briefcase, Plus, Clock, CalendarClock, CheckCircle2 } from '@/components/icons';
import DashboardLayout from '../components/DashboardLayout';
import WeekCanvas, { WeekLegend, weekRangeLabel } from '../components/WeekCanvas';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '@/components/Panel';
import { QuickAdd } from '@/components/QuickAdd';
import { SpareMinutes } from '@/components/SpareMinutes';
import { CheckIn } from '@/components/CheckIn';
import { WeekInReview } from '@/components/WeekInReview';
import { WeekItemDialog, type WeekItem } from '@/components/WeekItemDialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSchedule } from '@/hooks/useSchedule';
import { useWeek } from '@/hooks/useWeek';
import { usePlan } from '@/hooks/usePlan';
import { useLoop } from '@/hooks/useLoop';
import { scheduledMinutes, weeklyFreeMinutes } from '@/lib/scheduling/plan';
import type { Task, TimeBlock } from '@/lib/scheduling/types';

const SOURCE_ICON = { reviews: Brain, 'weak-spot': Target, job: Briefcase } as const;

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return d.getHours() >= 17 ? 'Tonight' : 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const hours = (min: number) => Math.round((min / 60) * 10) / 10;

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, displayName } = useAuth();
  const userId = user?.id ?? '';
  const week = useWeek();
  const { lastRecalculatedAt } = useSchedule();
  const { plan } = usePlan();
  const loopLoading = useLoop((s) => s.loading || s.loadedFor === null);
  const [item, setItem] = useState<WeekItem | null>(null);

  const tasksById = useMemo(() => new Map(plan.tasks.map((t) => [t.id, t])), [plan.tasks]);
  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...plan.schedule.blocks]
      .filter((b) => new Date(b.endTime).getTime() > now)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [plan.schedule.blocks]);
  const next = upcoming[0];
  const nextTask = next ? tasksById.get(next.taskId) : undefined;
  const loopAdded = plan.tasks.filter((t) => t.source === 'reviews' || t.source === 'weak-spot' || t.source === 'job');

  const plannedH = hours(scheduledMinutes(plan.schedule));
  const freeH = hours(weeklyFreeMinutes(week.windows));
  const atRisk = plan.schedule.atRiskTasks.length;

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const daysLeft = week.goal?.targetDate
    ? Math.ceil((new Date(week.goal.targetDate + 'T23:59:59').getTime() - Date.now()) / 86_400_000)
    : null;

  const weekSummary = (
    <>
      <span className="tabular-nums">{plannedH}h</span> planned of <span className="tabular-nums">{freeH}h</span> free
      {atRisk > 0 && (
        <>
          {' · '}
          <button onClick={() => navigate('/tasks')} className="font-medium text-destructive hover:underline">
            {atRisk} doesn’t fit
          </button>
        </>
      )}
    </>
  );

  return (
    <DashboardLayout>
      {week.isSample && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/[0.08] px-4 py-2.5">
          <p className="text-[13px] text-warning-ink">
            <span className="font-semibold">Sample week.</span> Tasks and free time are made up. Quizzes, reviews and jobs are real.
          </p>
          <Button size="sm" variant="outline" className="bg-card" onClick={() => { week.clear(); navigate('/setup'); }}>
            Set up my own week
          </Button>
        </div>
      )}

      <PageHeader
        eyebrow={today}
        title={
          <>
            {greeting}
            {displayName !== 'Guest' ? `, ${displayName}` : ''}
          </>
        }
        description={
          week.goal ? (
            <>
              Working toward <span className="font-medium text-foreground">{week.goal.title}</span>
              {daysLeft !== null && daysLeft >= 0 ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ''}
            </>
          ) : undefined
        }
        actions={
          <Button variant="outline" onClick={() => navigate('/schedule')}>
            Something changed?
          </Button>
        }
      />

      <SpareMinutes className="mb-6" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <UpNext block={next} task={nextTask} after={upcoming.slice(1, 3)} tasksById={tasksById} hasFreeTime={week.windows.length > 0} />
        <div className="flex flex-col gap-6">
          <CheckIn />
          <QuickAdd />
          {/* What you actually did */}
          <WeekInReview userId={userId} />
        </div>
      </div>

      {/* The week: click empty time to add, a block to see it */}
      <Panel
        id="today-week"
        className="mt-6"
        title="This week"
        meta={weekRangeLabel()}
        summary={weekSummary}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setItem({ kind: 'add', date: new Date() })}>
              <Plus />
              Add
            </Button>
            <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate('/schedule')}>
              LifeShift
              <ArrowRight />
            </Button>
          </>
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12.5px] text-muted-foreground">
          <span>
            {weekSummary}
            {lastRecalculatedAt && <> · replanned {formatDistanceToNow(new Date(lastRecalculatedAt), { addSuffix: true })}</>}
          </span>
          <WeekLegend />
        </div>
        <WeekCanvas
          plan={plan}
          compact
          onAdd={(date, minute) => setItem({ kind: 'add', date, minute })}
          onBlockClick={(task, block) => setItem({ kind: 'block', task, block })}
          onEventClick={(event) => setItem({ kind: 'event', event })}
        />
        <p className="mt-3 text-[11.5px] text-muted-foreground">Click any empty time to add something. Click a block to see it.</p>
      </Panel>

      {(loopAdded.length > 0 || loopLoading) && (
      <div className="mt-6">
        {/* What the loop added (hidden until there is something: Got a few minutes covers the start) */}
        <Panel
          id="today-loop"
          title="Added by Ropi"
          meta={loopAdded.length ? `${loopAdded.length} from your quizzes, reviews and jobs` : undefined}
          summary={loopAdded.length ? loopAdded.map((t) => t.title).join(' · ') : 'Nothing yet'}
        >
          {loopAdded.length === 0 && loopLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/70" />
              ))}
            </div>
          ) : loopAdded.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5">
              <p className="text-[13px] text-muted-foreground">
                Miss a question in a quiz and Ropi schedules practice for it. Add a job with a closing date and it finds time to apply.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate('/quiz/quiz-1')}>
                  <BookOpen />
                  Take a quiz
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/jobs')}>
                  <Briefcase />
                  Add a job
                </Button>
              </div>
            </div>
          ) : (
            <ul className="-mx-2.5 grid grid-cols-1 gap-1 md:grid-cols-2">
              {loopAdded.map((t) => {
                const Icon = SOURCE_ICON[t.source as keyof typeof SOURCE_ICON] ?? BookOpen;
                const block = plan.schedule.blocks.find((b) => b.taskId === t.id);
                const risk = plan.schedule.atRiskTasks.find((r) => r.taskId === t.id);
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => t.href && navigate(t.href)}
                      className="group flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-muted/60"
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.category === 'career' ? 'bg-foreground/[0.06]' : 'bg-accent text-primary'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{t.title}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{t.why}</span>
                        <span className={`mt-1 block text-[11.5px] ${risk ? 'text-destructive' : 'text-primary'}`}>
                          {risk ? 'Doesn’t fit this week' : block ? `${dayLabel(block.startTime)} ${fmtTime(block.startTime)}` : ''}
                        </span>
                      </span>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
      )}

      <WeekItemDialog item={item} onClose={() => setItem(null)} />
    </DashboardLayout>
  );
}

function UpNext({
  block,
  task,
  after,
  tasksById,
  hasFreeTime,
}: {
  block?: TimeBlock;
  task?: Task;
  after: TimeBlock[];
  tasksById: Map<string, Task>;
  hasFreeTime: boolean;
}) {
  const navigate = useNavigate();
  const checkIn = useWeek((s) => s.checkIn);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!block || !task) {
    return (
      <Card className="flex flex-col justify-center p-7">
        <div className="eyebrow mb-3">Up next</div>
        <h2 className="text-[24px] font-semibold leading-tight">
          {hasFreeTime ? 'Nothing planned yet.' : 'Tell Ropi when you’re free.'}
        </h2>
        <p className="mt-2 max-w-md text-[14px] text-muted-foreground">
          {hasFreeTime
            ? 'Add something you need to do this week, or take a quiz so Ropi can find what to practise.'
            : 'Ropi plans only inside your free time, so it needs to know when that is.'}
        </p>
        <div className="mt-5">
          <Button onClick={() => navigate(hasFreeTime ? '/quiz/quiz-1' : '/setup')}>
            {hasFreeTime ? 'Take a 2-minute quiz' : 'Set my free time'}
            <ArrowRight />
          </Button>
        </div>
      </Card>
    );
  }

  const start = new Date(block.startTime).getTime();
  const end = new Date(block.endTime).getTime();
  const live = now >= start && now < end;
  const mins = Math.round((end - start) / 60000);
  const career = task.category === 'career';

  return (
    <Card className="relative overflow-hidden p-7">
      <div aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${career ? 'bg-foreground' : 'bg-primary'}`} />
      <div className="flex items-center gap-2">
        <span className="eyebrow">{live ? 'Now' : 'Up next'}</span>
        {live && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        )}
      </div>
      <motion.h2 key={task.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-[28px] font-semibold leading-[1.15]">
        {task.title}
      </motion.h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {dayLabel(block.startTime)} {fmtTime(block.startTime)}–{fmtTime(block.endTime)}
          <span className="tabular-nums">· {mins} min</span>
        </span>
        {task.deadline && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4" />
            Due {task.deadline.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
      {task.why && <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed">{task.why}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {task.href ? (
          <Button size="lg" onClick={() => navigate(task.href!)}>
            Start
            <ArrowRight />
          </Button>
        ) : (
          <Button size="lg" onClick={() => checkIn(task.id, 'done')}>
            <CheckCircle2 />
            Mark done
          </Button>
        )}
      </div>

      {after.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <div className="eyebrow mb-2">Then</div>
          <ul className="space-y-1.5">
            {after.map((b) => {
              const t = tasksById.get(b.taskId);
              if (!t) return null;
              return (
                <li key={b.id} className="flex items-center gap-3 text-[13px]">
                  <span className="w-[108px] shrink-0 whitespace-nowrap tabular-nums text-muted-foreground sm:w-[148px]">
                    {dayLabel(b.startTime)} {fmtTime(b.startTime)}
                  </span>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.category === 'learning' ? 'bg-primary' : t.category === 'career' ? 'bg-foreground' : 'bg-muted-foreground/50'}`} />
                  <span className="truncate">{t.title}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
