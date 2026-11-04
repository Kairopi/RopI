/**
 * Tasks - every task the scheduler is working with this week.
 *
 * Built from the same plan as LifeShift (buildPlan + the user's constraints),
 * so a change in LifeShift shows up here immediately: new sessions, moved
 * sessions, and tasks that no longer fit before their deadline.
 */

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '@/components/Panel';
import { QuickAdd } from '@/components/QuickAdd';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Briefcase, CalendarClock, Clock, AlertTriangle, CheckCircle2, Circle, Trash2, ArrowRight } from '@/components/icons';
import { usePlan } from '@/hooks/usePlan';
import { useWeek } from '@/hooks/useWeek';
import type { Task, TimeBlock } from '@/lib/scheduling/types';

const PRIORITY_LABEL: Record<Task['priority'], string> = { P1: 'Urgent', P2: 'High', P3: 'Normal', P4: 'Low' };

interface Row {
  task: Task;
  blocks: TimeBlock[];
  placedMinutes: number;
  risk?: string;
}

const minutesOf = (b: TimeBlock) => (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000;

const dayTime = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function TaskBoard() {
  const navigate = useNavigate();
  const { plan } = usePlan();
  const week = useWeek();
  const done = week.tasks.filter((t) => t.doneAt);
  // Estimate accuracy (Super Productivity): how your real times compare with your plans
  const timed = done.filter((t) => t.actualMinutes !== undefined);
  const ratio = timed.length >= 2 ? timed.reduce((s, t) => s + t.actualMinutes!, 0) / timed.reduce((s, t) => s + t.duration + (t.workedMinutes ?? 0), 0) : null;
  const estimateNote =
    ratio === null ? null : Math.abs(ratio - 1) < 0.1 ? `Your estimates are spot on (${timed.length} tasks)` : `Tasks take you ${Math.round(Math.abs(ratio - 1) * 100)}% ${ratio > 1 ? 'longer' : 'less'} than planned`;

  const rows: Row[] = plan.tasks
    .map((task) => {
      const blocks = plan.schedule.blocks
        .filter((b) => b.taskId === task.id)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      return {
        task,
        blocks,
        placedMinutes: blocks.reduce((s, b) => s + minutesOf(b), 0),
        risk: plan.schedule.atRiskTasks.find((r) => r.taskId === task.id)?.reason,
      };
    })
    .sort((a, b) => Number(!!b.risk) - Number(!!a.risk) || a.task.priority.localeCompare(b.task.priority));

  const atRisk = rows.filter((r) => r.risk);
  const onTrack = rows.filter((r) => !r.risk);
  const totalMinutes = rows.reduce((s, r) => s + r.task.duration, 0);
  const placedMinutes = rows.reduce((s, r) => s + Math.min(r.placedMinutes, r.task.duration), 0);
  const pct = totalMinutes ? Math.round((placedMinutes / totalMinutes) * 100) : 0;

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Tasks"
        title="This week’s tasks"
        description="Yours and Ropi’s, each placed in your free time before it’s due."
        actions={
          <Button variant="outline" onClick={() => navigate('/setup')}>
            <Clock />
            Edit free time
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <QuickAdd title={null} />

      {/* Coverage ledger */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[12.5px] font-medium text-muted-foreground">Scheduled this week</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-[34px] font-semibold leading-none tracking-[-0.035em] tabular-nums">{pct}</span>
              <span className="font-display text-[18px] font-semibold text-muted-foreground">%</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-muted-foreground">
            <span>
              <span className="tabular-nums font-medium text-foreground">{Math.round(placedMinutes / 6) / 10}h</span> of{' '}
              <span className="tabular-nums">{Math.round(totalMinutes / 6) / 10}h</span> placed
            </span>
            <span>
              <span className="tabular-nums font-medium text-foreground">{onTrack.length}</span> on track
            </span>
            <span className={atRisk.length ? 'text-destructive' : ''}>
              <span className="tabular-nums font-medium">{atRisk.length}</span> at risk
            </span>
          </div>
        </div>
        <div className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          {rows.map((r) => (
            <motion.div
              key={r.task.id}
              title={r.task.title}
              initial={false}
              animate={{ flexGrow: r.task.duration }}
              className="relative h-full basis-0 overflow-hidden bg-muted"
            >
              <motion.div
                initial={false}
                animate={{ width: `${Math.min(100, (r.placedMinutes / r.task.duration) * 100)}%` }}
                transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                className={`h-full ${r.risk ? 'bg-destructive' : r.task.category === 'career' ? 'bg-foreground' : 'bg-primary'}`}
              />
            </motion.div>
          ))}
        </div>
      </Card>
      </div>

      {atRisk.length > 0 && (
        <Panel
          id="tasks-risk"
          variant="bare"
          className="mb-6"
          title="Doesn’t fit"
          meta={<Badge variant="destructive">{atRisk.length}</Badge>}
          summary={atRisk.map((r) => r.task.title).join(' · ')}
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {atRisk.map((r) => (
              <TaskCard key={r.task.id} row={r} />
            ))}
          </div>
        </Panel>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
          <h3 className="text-[17px] font-semibold">Nothing on your plate yet</h3>
          <p className="mt-1 max-w-sm text-[13.5px] text-muted-foreground">
            Type one above, take a quiz, or add a job with a closing date. Ropi plans all of it in your free time.
          </p>
        </div>
      ) : (
        <Panel
          id="tasks-on-track"
          variant="bare"
          title="On track"
          meta={`${onTrack.length} task${onTrack.length === 1 ? '' : 's'}`}
          summary={onTrack.map((r) => r.task.title).join(' · ')}
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {onTrack.map((r) => (
              <TaskCard key={r.task.id} row={r} />
            ))}
          </div>
        </Panel>
      )}

      {done.length > 0 && (
        <Panel id="tasks-done" variant="bare" className="mt-6" title="Done" meta={estimateNote ?? `${done.length} done`} summary={`${done.length} done`}>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <button aria-label={`Mark ${t.title} not done`} onClick={() => week.toggleDone(t.id)}>
                  <CheckCircle2 className="h-[18px] w-[18px] text-success" />
                </button>
                <span className="flex-1 truncate text-[13.5px] text-muted-foreground line-through">{t.title}</span>
                <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                  {new Date(t.doneAt!).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
                {t.actualMinutes !== undefined && (
                  <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                    planned {t.duration + (t.workedMinutes ?? 0)} · took{' '}
                    <span className={t.actualMinutes > (t.duration + (t.workedMinutes ?? 0)) * 1.2 ? 'text-warning-ink' : ''}>{t.actualMinutes}</span> min
                  </span>
                )}
                <button aria-label={`Delete ${t.title}`} onClick={() => week.removeTask(t.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </DashboardLayout>
  );
}

const SOURCE_LABEL: Partial<Record<NonNullable<Task['source']>, string>> = {
  reviews: 'From your reviews',
  'weak-spot': 'From your quiz',
  job: 'From your jobs',
  sample: 'Sample',
};

function TaskCard({ row }: { row: Row }) {
  const navigate = useNavigate();
  const { checkIn, removeTask } = useWeek();
  const { task, blocks, placedMinutes, risk } = row;
  const mine = task.source === 'you' || task.source === 'sample';
  const career = task.category === 'career';
  const Icon = career ? Briefcase : BookOpen;
  const covered = Math.min(100, Math.round((placedMinutes / task.duration) * 100));

  return (
    <Card className={`p-5 ${risk ? 'border-destructive/30' : ''}`}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            career ? 'bg-foreground/[0.06] text-foreground' : 'bg-accent text-primary'
          }`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-sans text-[14.5px] font-semibold leading-snug tracking-normal">{task.title}</h3>
            <Badge variant={task.priority === 'P1' ? 'warning' : 'outline'} className="shrink-0">
              {PRIORITY_LABEL[task.priority]}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span className="tabular-nums">{task.duration} min</span>
            </span>
            {task.deadline && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                Due {dayTime(task.deadline)}
              </span>
            )}
            {SOURCE_LABEL[task.source ?? 'you'] ? (
              <span className="text-primary">{SOURCE_LABEL[task.source ?? 'you']}</span>
            ) : (
              <span className="capitalize">{task.category ?? 'task'}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={false}
          animate={{ width: `${covered}%` }}
          transition={{ type: 'spring', stiffness: 160, damping: 24 }}
          className={`h-full rounded-full ${risk ? 'bg-destructive' : career ? 'bg-foreground' : 'bg-primary'}`}
        />
      </div>

      {risk ? (
        <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-destructive">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          {risk}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <span className="text-[12px] text-muted-foreground">
            {blocks.length} session{blocks.length === 1 ? '' : 's'}
          </span>
          {blocks.slice(0, 3).map((b) => (
            <span key={b.id} className="num rounded-md border bg-background px-1.5 py-0.5 text-[11px]">
              {dayTime(b.startTime)}
            </span>
          ))}
          {blocks.length > 3 && <span className="text-[11px] text-muted-foreground">+{blocks.length - 3}</span>}
        </div>
      )}

      {task.why && !mine && <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{task.why}</p>}

      <div className="mt-4 flex items-center gap-1 border-t pt-3">
        {task.href && (
          <Button size="sm" variant="ghost" onClick={() => navigate(task.href!)}>
            Start
            <ArrowRight />
          </Button>
        )}
        {mine && (
          <>
            <Button size="sm" variant="ghost" onClick={() => checkIn(task.id, 'done')}>
              <Circle />
              Mark done
            </Button>
            <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground hover:text-destructive" aria-label={`Delete ${task.title}`} onClick={() => removeTask(task.id)}>
              <Trash2 />
            </Button>
          </>
        )}
        {!mine && <span className="ml-auto text-[11.5px] text-muted-foreground">Clears when you do it</span>}
      </div>
    </Card>
  );
}
