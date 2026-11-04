/**
 * Tasks - everything on your plate, as one calm list grouped by when.
 *
 * Built from the same plan as Today and LifeShift. A row shows only what you
 * need to decide: what, when, how long. Click a row for the rest (sessions,
 * why Ropi added it, delete). Things that don't fit are pulled to the top with
 * the reason; finished tasks are folded away.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '@/components/Panel';
import { QuickAdd } from '@/components/QuickAdd';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Circle, Clock, Trash2 } from '@/components/icons';
import { usePlan } from '@/hooks/usePlan';
import { useWeek } from '@/hooks/useWeek';
import { formatDate } from '@/lib/scheduling/utils';
import { cn } from '@/lib/utils';
import type { Task, TimeBlock } from '@/lib/scheduling/types';

interface Row {
  task: Task;
  blocks: TimeBlock[];
  placedMinutes: number;
  risk?: string;
}

const SOURCE_LABEL: Partial<Record<NonNullable<Task['source']>, string>> = {
  reviews: 'From your reviews',
  'weak-spot': 'From your quiz',
  job: 'From your jobs',
};

const minutesOf = (b: TimeBlock) => (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000;
const time = (iso: string | Date) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const day = (iso: string | Date) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const hours = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10}h` : `${Math.round(m)}m`);

export default function TaskBoard() {
  const navigate = useNavigate();
  const { plan } = usePlan();
  const week = useWeek();
  const done = [...week.tasks.filter((t) => t.doneAt)].sort((a, b) => b.doneAt!.localeCompare(a.doneAt!));

  // Estimate accuracy (Super Productivity): how your real times compare with your plans
  const timed = done.filter((t) => t.actualMinutes !== undefined);
  const ratio = timed.length >= 2 ? timed.reduce((s, t) => s + t.actualMinutes!, 0) / timed.reduce((s, t) => s + t.duration + (t.workedMinutes ?? 0), 0) : null;
  const estimateNote =
    ratio === null ? null : Math.abs(ratio - 1) < 0.1 ? 'Your estimates are spot on' : `Tasks take you ${Math.round(Math.abs(ratio - 1) * 100)}% ${ratio > 1 ? 'longer' : 'less'} than planned`;

  const rows: Row[] = useMemo(
    () =>
      plan.tasks.map((task) => {
        const blocks = plan.schedule.blocks.filter((b) => b.taskId === task.id).sort((a, b) => a.startTime.localeCompare(b.startTime));
        return {
          task,
          blocks,
          placedMinutes: blocks.reduce((s, b) => s + minutesOf(b), 0),
          risk: plan.schedule.atRiskTasks.find((r) => r.taskId === task.id)?.reason,
        };
      }),
    [plan]
  );

  // Group by when the next session is
  const today = formatDate(new Date());
  const tomorrow = formatDate(new Date(Date.now() + 86_400_000));
  const groups = useMemo(() => {
    const g = { risk: [] as Row[], today: [] as Row[], tomorrow: [] as Row[], later: [] as Row[] };
    for (const r of rows) {
      const next = r.blocks.find((b) => new Date(b.endTime).getTime() > Date.now()) ?? r.blocks[0];
      if (r.risk) g.risk.push(r);
      else if (next?.date === today) g.today.push(r);
      else if (next?.date === tomorrow) g.tomorrow.push(r);
      else g.later.push(r);
    }
    const byStart = (a: Row, b: Row) => (a.blocks[0]?.startTime ?? '9').localeCompare(b.blocks[0]?.startTime ?? '9');
    Object.values(g).forEach((list) => list.sort(byStart));
    return g;
  }, [rows, today, tomorrow]);

  const totalMinutes = rows.reduce((s, r) => s + r.task.duration, 0);
  const placedMinutes = rows.reduce((s, r) => s + Math.min(r.placedMinutes, r.task.duration), 0);

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Tasks"
        title="What’s on your plate"
        description="Each task is placed in your free time before it’s due."
        actions={
          <Button variant="ghost" onClick={() => navigate('/setup')}>
            <Clock />
            Edit free time
          </Button>
        }
      />

      <div className="mx-auto max-w-3xl">
        <QuickAdd title={null} className="mb-3" />
        {rows.length > 0 && (
          <p className="mb-6 px-1 text-[12.5px] text-muted-foreground">
            {rows.length} task{rows.length === 1 ? '' : 's'} · <span className="tabular-nums">{hours(placedMinutes)}</span> of{' '}
            <span className="tabular-nums">{hours(totalMinutes)}</span> scheduled
            {groups.risk.length > 0 && <span className="text-destructive"> · {groups.risk.length} doesn’t fit</span>}
          </p>
        )}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
            <h3 className="text-[16px] font-semibold">Nothing on your plate</h3>
            <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-muted-foreground">Type a task above. Quizzes you miss and jobs with closing dates show up here too.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.risk.length > 0 && (
              <Group title="Doesn’t fit" tone="risk" action={<Button size="sm" variant="ghost" onClick={() => navigate('/schedule')}>Fix in LifeShift<ArrowRight /></Button>}>
                {groups.risk.map((r) => <TaskRow key={r.task.id} row={r} />)}
              </Group>
            )}
            {groups.today.length > 0 && <Group title="Today">{groups.today.map((r) => <TaskRow key={r.task.id} row={r} />)}</Group>}
            {groups.tomorrow.length > 0 && <Group title="Tomorrow">{groups.tomorrow.map((r) => <TaskRow key={r.task.id} row={r} />)}</Group>}
            {groups.later.length > 0 && <Group title="Later this week">{groups.later.map((r) => <TaskRow key={r.task.id} row={r} />)}</Group>}
          </div>
        )}

        {done.length > 0 && (
          <Panel id="tasks-done" variant="bare" defaultOpen={false} className="mt-8" title="Done" meta={estimateNote ?? `${done.length} done`} summary={`${done.length} done · ${estimateNote ?? 'open to see when'}`}>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {done.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button aria-label={`Mark ${t.title} not done`} onClick={() => week.toggleDone(t.id)}>
                    <CheckCircle2 className="h-[18px] w-[18px] text-success" />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-muted-foreground line-through">{t.title}</span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                    {day(t.doneAt!)}
                    {t.actualMinutes !== undefined && ` · took ${t.actualMinutes}m`}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </DashboardLayout>
  );
}

function Group({ title, tone, action, children }: { title: string; tone?: 'risk'; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <h2 className={cn('flex items-center gap-1.5 text-[13px] font-semibold', tone === 'risk' && 'text-destructive')}>
          {tone === 'risk' && <AlertTriangle className="h-3.5 w-3.5" />}
          {title}
        </h2>
        {action}
      </div>
      <ul className={cn('divide-y overflow-hidden rounded-xl border bg-card', tone === 'risk' && 'border-destructive/25')}>{children}</ul>
    </section>
  );
}

function TaskRow({ row }: { row: Row }) {
  const navigate = useNavigate();
  const { checkIn, removeTask } = useWeek();
  const [open, setOpen] = useState(false);
  const { task, blocks, risk } = row;
  const mine = task.source === 'you' || task.source === 'sample';
  const next = blocks.find((b) => new Date(b.endTime).getTime() > Date.now()) ?? blocks[0];
  const dot = task.category === 'learning' ? 'bg-primary' : task.category === 'career' ? 'bg-foreground' : 'bg-muted-foreground/50';

  return (
    <li>
      <div className="flex items-center gap-3 px-4 py-3">
        {mine ? (
          <button aria-label={`Mark ${task.title} done`} onClick={() => checkIn(task.id, 'done')} className="text-muted-foreground transition-colors hover:text-success">
            <Circle className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <span className={cn('mx-[5px] h-2 w-2 shrink-0 rounded-full', dot)} title={SOURCE_LABEL[task.source ?? 'you']} />
        )}
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium">{task.title}</span>
            <span className={cn('block truncate text-[12px]', risk ? 'text-destructive' : 'text-muted-foreground')}>
              {risk
                ? risk
                : [next ? `${time(next.startTime)}` : null, `${task.duration} min`, task.deadline ? `due ${day(task.deadline)}` : null, SOURCE_LABEL[task.source ?? 'you'] ?? null]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {task.href && (
          <Button size="sm" variant="ghost" onClick={() => navigate(task.href!)} className="shrink-0">
            Start
          </Button>
        )}
      </div>
      {open && (
        <div className="space-y-2 border-t border-dashed bg-background/60 px-4 py-3 pl-[46px] text-[12.5px]">
          {task.why && <p className="text-foreground/85">{task.why}</p>}
          {blocks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
              <span>{blocks.length === 1 ? 'Session:' : `${blocks.length} sessions:`}</span>
              {blocks.map((b) => (
                <span key={b.id} className="rounded-md border bg-card px-1.5 py-0.5 tabular-nums text-foreground">
                  {day(b.startTime)}, {time(b.startTime)}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-muted-foreground">
            {mine ? (
              <button onClick={() => removeTask(task.id)} className="inline-flex items-center gap-1 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : (
              <span>Ropi added this. It clears when you do it.</span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
