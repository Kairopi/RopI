/**
 * Today - the answer to "what do I do with the time I have, and why?"
 *
 * Got a few minutes (dead time, right now), then the next block in your plan + add,
 * what you did in the last 7 days, then the week (click any empty time to add to it).
 * Every section below the fold can be collapsed.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowRight, Plus, CheckCircle2 } from '@/components/icons';
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
import { scheduledMinutes, weeklyFreeMinutes } from '@/lib/scheduling/plan';
import type { Task, TimeBlock } from '@/lib/scheduling/types';


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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <UpNext block={next} task={nextTask} after={upcoming.slice(1, 3)} tasksById={tasksById} hasFreeTime={week.windows.length > 0} />
          <QuickAdd />
        </div>
        <div className="flex flex-col gap-6">
          <CheckIn />
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

      <WeekItemDialog item={item} onClose={() => setItem(null)} />
    </DashboardLayout>
  );
}

/** The next block in your plan: one compact card, the reason, and Start */
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
      <Card className="p-5">
        <div className="text-[12.5px] font-medium text-muted-foreground">Next in your plan</div>
        <h2 className="mt-1.5 text-[17px] font-semibold leading-snug">{hasFreeTime ? 'Nothing planned yet' : 'Tell Ropi when you’re free'}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {hasFreeTime ? 'Add something below, or take a quiz so Ropi knows what to practise.' : 'Ropi only plans inside your free time.'}
        </p>
        <Button size="sm" className="mt-4" onClick={() => navigate(hasFreeTime ? '/quiz/quiz-1' : '/setup')}>
          {hasFreeTime ? 'Take a 2-minute quiz' : 'Set my free time'}
          <ArrowRight />
        </Button>
      </Card>
    );
  }

  const start = new Date(block.startTime).getTime();
  const end = new Date(block.endTime).getTime();
  const live = now >= start && now < end;
  const mins = Math.round((end - start) / 60000);
  const dot = (t: Task) => (t.category === 'learning' ? 'bg-primary' : t.category === 'career' ? 'bg-foreground' : 'bg-muted-foreground/50');

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 text-[12.5px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          {live && <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />}
          {live ? 'Happening now' : 'Next in your plan'}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {dayLabel(block.startTime)} {fmtTime(block.startTime)} · {mins} min
        </span>
      </div>

      <div className="mt-2 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <motion.h2 key={task.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[18px] font-semibold leading-snug">
            {task.title}
          </motion.h2>
          {task.why && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{task.why}</p>}
          {!task.why && task.deadline && (
            <p className="mt-1 text-[13px] text-muted-foreground">
              Due {task.deadline.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>
        {task.href ? (
          <Button size="sm" className="shrink-0" onClick={() => navigate(task.href!)}>
            Start
            <ArrowRight />
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => checkIn(task.id, 'done')}>
            <CheckCircle2 />
            Mark done
          </Button>
        )}
      </div>

      {after.length > 0 && (
        <ul className="mt-4 space-y-1 border-t pt-3">
          {after.map((b) => {
            const t = tasksById.get(b.taskId);
            if (!t) return null;
            return (
              <li key={b.id} className="flex items-center gap-2.5 text-[12.5px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot(t)}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-foreground/80">{t.title}</span>
                <span className="shrink-0 tabular-nums">{fmtTime(b.startTime)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
