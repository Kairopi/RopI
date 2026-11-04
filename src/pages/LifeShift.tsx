/**
 * LifeShift Page - ROPI's signature moment
 *
 * Tell ROPI what changed ("Manager added shift, only 20min tonight").
 * The week calendar stays on screen and every affected block physically
 * travels to its new slot; a dashed ghost marks where it was; tasks that no
 * longer fit drop into the at-risk tray. The reasoning card says why.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import WeekCanvas, { WeekLegend, weekRangeLabel } from '@/components/WeekCanvas';
import ScheduleTimeline from '@/components/ScheduleTimeline';
import BeforeAfterView from '@/components/BeforeAfterView';
import ConstraintInput from '@/components/ConstraintInput';
import AgentStatusFeed, { type AgentStatus } from '@/components/AgentStatusFeed';
import ReasoningCard from '@/components/ReasoningCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, RotateCcw, CalendarDays, List, Loader2, AlertTriangle, X, Plus, ArrowRight, CheckCircle2 } from '@/components/icons';
import { WeekItemDialog, type WeekItem } from '@/components/WeekItemDialog';
import { useSchedule } from '@/hooks/useSchedule';
import { usePlan } from '@/hooks/usePlan';
import { buildPlan, changedTaskIds, explainChanges, suggestFixes, type Plan } from '@/lib/scheduling/plan';
import type { Adjustment, Constraint, PlanChange, Suggestion } from '@/lib/scheduling/types';
import { recordReceipt } from '@/lib/receipts';
import { delay } from '@/lib/animations/constants';

interface Comparison {
  before: Plan;
  after: Plan;
  label: string;
  changed: string[];
  changes: PlanChange[];
  updates: AgentStatus[];
  revision: number;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** What actually ran, in order. Every line is measured, nothing is decorative. */
function pipelineSteps(after: Plan, changed: number, constraint?: Constraint): AgentStatus[] {
  const steps: AgentStatus[] = [];
  if (constraint) {
    steps.push({
      agent: 'system',
      action: constraint.parsedBy === 'muse' ? 'Read your sentence' : 'Read your sentence with simple built-in rules',
      timestamp: 0,
    });
  }
  steps.push({ agent: 'scheduler', action: `Found ${plural(after.schedule.freeSlotCount ?? 0, 'free slot')} in the next 7 days`, timestamp: 0 });
  steps.push({
    agent: 'scheduler',
    action:
      after.strategy === 'stable'
        ? `Kept every block that still fits; re-placed ${plural(changed, 'task')}`
        : `Re-placed everything: that rescued more tasks than moving only ${plural(changed, 'task')}`,
    timestamp: after.schedule.calculationTime,
  });
  if (after.schedule.atRiskTasks.length) {
    steps.push({ agent: 'scheduler', action: `${plural(after.schedule.atRiskTasks.length, 'task')} still won't fit. Options below.`, timestamp: 0 });
  }
  return steps;
}

export default function LifeShift() {
  const navigate = useNavigate();
  const { constraints, adjustments, addConstraint, addAdjustments, removeAdjustment, removeConstraint, reset } = useSchedule();
  const { plan: current, input: planInput, planWith, planWithAdjustments } = usePlan();

  const [replanning, setReplanning] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [view, setView] = useState<'week' | 'list'>('week');
  const [item, setItem] = useState<WeekItem | null>(null);
  const fixes = useMemo(() => suggestFixes(current), [current]);

  /** Show the change, then commit it: blocks travel from old slot to new */
  async function commit(after: Plan, label: string, save: () => void, receipt: () => void, constraint?: Constraint) {
    const before = current;
    setReplanning(true);
    const changed = changedTaskIds(before.schedule, after.schedule);
    await delay(250); // a beat so the change registers before blocks start moving
    save();
    setComparison({
      before,
      after,
      label,
      changed,
      changes: explainChanges(before, after, label),
      updates: pipelineSteps(after, changed.length, constraint),
      revision: Date.now(),
    });
    setReplanning(false);
    receipt();
  }

  const handleConstraintSubmit = (constraint: Constraint) => {
    const after = planWith(constraint);
    const moved = changedTaskIds(current.schedule, after.schedule).length;
    return commit(
      after,
      constraint.description,
      () => addConstraint(constraint),
      () =>
        recordReceipt({
          domain: 'plan',
          kind: 'plan.replanned',
          actor: constraint.parsedBy === 'muse' ? 'muse' : 'ropi',
          verification: 'system_recorded',
          title: `Week replanned: "${constraint.description}"`,
          detail: `${plural(moved, 'task')} moved, ${after.schedule.atRiskTasks.length} at risk, ${after.schedule.calculationTime} ms`,
          evidence: { constraint, moved, atRisk: after.schedule.atRiskTasks.length, strategy: after.strategy, calcMs: after.schedule.calculationTime },
        }),
      constraint
    );
  };

  const applySuggestion = (s: Suggestion) => {
    const after = planWithAdjustments(s.adjustments);
    return commit(
      after,
      s.label,
      () => addAdjustments(s.adjustments, s.label),
      () =>
        recordReceipt({
          domain: 'plan',
          kind: 'plan.adjusted',
          actor: 'user',
          verification: 'system_recorded',
          title: s.label,
          detail: s.detail,
          evidence: { adjustments: s.adjustments, atRisk: after.schedule.atRiskTasks.length },
        })
    );
  };

  const previewImpact = (c: Constraint) => {
    const after = planWith(c);
    return { moved: changedTaskIds(current.schedule, after.schedule).length, atRisk: after.schedule.atRiskTasks.length };
  };

  const handleReset = () => {
    if (!confirm('Undo every change you made this week? Your plan goes back to your usual free time.')) return;
    reset();
    setComparison(null);
  };

  /** Undo one change: the week is replanned without it, and the blocks travel back */
  const undoConstraint = (i: number) => {
    const c = constraints[i];
    const after = buildPlan(constraints.filter((_, j) => j !== i), planInput, new Date(), adjustments);
    void commit(
      after,
      `Undo: ${c.description}`,
      () => removeConstraint(i),
      () =>
        recordReceipt({
          domain: 'plan',
          kind: 'plan.replanned',
          actor: 'user',
          verification: 'system_recorded',
          title: `Undid "${c.description}"`,
          detail: `${plural(changedTaskIds(current.schedule, after.schedule).length, 'task')} moved back`,
          evidence: { undone: c },
        })
    );
  };

  // What the last change did, in one line, with the way back to Today
  const summary = comparison
    ? (() => {
        const moved = comparison.changed.length;
        const risk = comparison.after.schedule.atRiskTasks.length;
        const firstToday = comparison.after.schedule.blocks
          .filter((b) => b.date === new Date().toLocaleDateString('en-CA') && new Date(b.endTime) > new Date())
          .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
        const t = firstToday && comparison.after.tasks.find((x) => x.id === firstToday.taskId);
        // A deadline change: say which task it landed on
        const prevById = new Map(comparison.before.tasks.map((x) => [x.id, x]));
        const due = comparison.after.tasks.find((x) => x.deadline && (prevById.get(x.id)?.deadline?.getTime() ?? 0) !== x.deadline.getTime());
        const dueLine = due ? `"${due.title}" is now due ${due.deadline!.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}${prevById.has(due.id) ? '' : ' (new task)'}. ` : '';
        return {
          dueLine,
          head: moved === 0 ? 'Nothing needed to move.' : `${plural(moved, 'block')} moved${risk ? `, ${risk} still ${risk === 1 ? 'doesn’t' : 'don’t'} fit` : ', everything still fits'}.`,
          next: t ? `Next today: ${t.title} at ${new Date(firstToday.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.` : 'Nothing else planned for today.',
        };
      })()
    : null;

  const hasChanges = constraints.length > 0 || adjustments.length > 0;
  const schedule = current.schedule;
  const tasksById = new Map(current.tasks.map((t) => [t.id, t]));
  const adjLabel = (a: Adjustment) => (a.kind === 'skip' ? `Skip: ${a.title}` : `${a.title}: ${a.minutes} min`);

  return (
    <DashboardLayout>
      <PageHeader
        title="Say what changed."
        description="Only the blocks that lose their time move, and each one says why."
        actions={
          hasChanges && (
            <Button onClick={handleReset} variant="outline" size="sm">
              <RotateCcw />
              Undo all changes
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6">
        {/* Left: input, conflicts, what happened */}
        <div className="space-y-4 order-2 xl:order-1">
          <ConstraintInput onSubmit={handleConstraintSubmit} isLoading={replanning} previewImpact={previewImpact} />

          {schedule.atRiskTasks.length > 0 && (
            <Card className="overflow-hidden border-destructive/25">
              <div className="flex items-center gap-2 border-b bg-destructive/[0.04] px-5 py-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h4 className="text-[14px] font-semibold">Doesn't fit this week</h4>
              </div>
              <ul className="divide-y">
                {schedule.atRiskTasks.map((r) => {
                  const task = tasksById.get(r.taskId);
                  if (!task) return null;
                  return (
                    <li key={r.taskId} className="px-5 py-3.5">
                      <div className="text-[13.5px] font-medium">{task.title}</div>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">{r.reason}</p>
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        {(fixes.get(r.taskId) ?? []).map((s) => (
                          <button
                            key={s.label}
                            disabled={replanning}
                            onClick={() => applySuggestion(s)}
                            title={s.detail}
                            className="rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50"
                          >
                            <span className="block text-[12.5px] font-medium">{s.label}</span>
                            <span className="block text-[11.5px] text-muted-foreground">{s.detail}</span>
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <AnimatePresence mode="popLayout">
            {comparison && (
              <motion.div
                key={`feed-${comparison.revision}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {summary && (
                  <Card className="border-success/25 bg-success/[0.04] p-4">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold">{summary.head}</p>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                          {summary.dueLine}
                          {summary.next}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => navigate('/dashboard')}>
                        See today
                        <ArrowRight />
                      </Button>
                      {constraints.length > 0 && !comparison.label.startsWith('Undo') && constraints[constraints.length - 1].description === comparison.label && (
                        <Button size="sm" variant="ghost" onClick={() => undoConstraint(constraints.length - 1)}>
                          <RotateCcw />
                          Undo this change
                        </Button>
                      )}
                    </div>
                  </Card>
                )}
                {comparison.changes.length > 0 && <ReasoningCard changes={comparison.changes} />}
                <AgentStatusFeed updates={comparison.updates} />
              </motion.div>
            )}
          </AnimatePresence>

        </div>
        {/* Right: the week */}
        <Card className="p-5 sm:p-6 order-1 xl:order-2 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold">Next 7 days</h2>
              <span className="mr-1 text-[12.5px] text-muted-foreground">{weekRangeLabel()}</span>
              {comparison && <span className="text-[12px] text-muted-foreground">Replanned in {schedule.calculationTime} ms</span>}
              {comparison && comparison.changed.length > 0 && (
                <Badge variant="warning" className="tabular-nums">{comparison.changed.length} moved</Badge>
              )}
              {schedule.atRiskTasks.length > 0 && (
                <Badge variant="destructive" className="tabular-nums">{schedule.atRiskTasks.length} at risk</Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setItem({ kind: 'add', date: new Date() })}>
              <Plus />
              Add
            </Button>
            <div className="relative flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Schedule view">
              {(['week', 'list'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`relative flex items-center gap-1.5 px-3 py-1 rounded-md text-[12.5px] font-medium transition-colors ${
                    view === v ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {view === v && (
                    <motion.span
                      layoutId="lifeshift-view"
                      className="absolute inset-0 rounded-md bg-card shadow-[0_1px_2px_hsl(225_20%_8%/0.08)]"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    {v === 'week' ? <CalendarDays className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                    {v === 'week' ? 'Week' : 'List'}
                  </span>
                </button>
              ))}
            </div>
            </div>
          </div>

          {hasChanges && (
            <div className="flex flex-wrap gap-2 mb-4">
              {constraints.map((c, i) => (
                <span
                  key={`c${i}`}
                  className="inline-flex items-center gap-1.5 text-[12px] pl-2 pr-2.5 py-1 rounded-full border bg-background text-muted-foreground max-w-[22rem]"
                >
                  <MessageSquare className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{c.description}</span>
                  <button aria-label={`Undo "${c.description}"`} title="Undo this change" onClick={() => undoConstraint(i)} className="rounded-full p-0.5 hover:bg-muted hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {adjustments.map((a, i) => (
                <span
                  key={`a${i}`}
                  className="inline-flex items-center gap-1 text-[12px] pl-2.5 pr-1 py-1 rounded-full border border-dashed bg-background text-muted-foreground max-w-[22rem]"
                >
                  <span className="truncate">{adjLabel(a)}</span>
                  <button aria-label={`Undo ${adjLabel(a)}`} onClick={() => removeAdjustment(i)} className="rounded-full p-0.5 hover:bg-muted hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {view === 'week' ? (
            <>
              <WeekCanvas
                plan={current}
                previous={comparison?.before}
                movedTaskIds={comparison?.changed}
                revision={comparison?.revision}
                onAdd={(date, minute) => setItem({ kind: 'add', date, minute })}
                onBlockClick={(task, block) => setItem({ kind: 'block', task, block })}
                onEventClick={(event) => setItem({ kind: 'event', event })}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <WeekLegend />
                <span className="text-[11.5px] text-muted-foreground">Click empty time to add</span>
              </div>
            </>
          ) : comparison ? (
            <BeforeAfterView
              before={comparison.before.schedule}
              after={comparison.after.schedule}
              tasks={comparison.after.tasks}
              changedTaskIds={comparison.changed}
            />
          ) : (
            <ScheduleTimeline blocks={schedule.blocks} tasks={current.tasks} />
          )}

          {/* Replanning veil: the calendar stays visible underneath */}
          <AnimatePresence>
            {replanning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-start justify-center pt-24"
              >
                <div className="flex items-center gap-2 rounded-full bg-card border shadow-float px-4 py-2 text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Replanning your week
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
      <WeekItemDialog item={item} onClose={() => setItem(null)} />
    </DashboardLayout>
  );
}
