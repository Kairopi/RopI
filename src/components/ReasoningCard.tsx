/**
 * ReasoningCard Component
 * 
 * Explains what changed and why after schedule recalculation
 * Makes AI decisions transparent
 */

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, ArrowRight, CheckCircle2 } from '@/components/icons';
import { itemVariants, staggerChildrenVariants } from '@/lib/animations/constants';
import type { Constraint, Schedule, Task, TimeBlock } from '@/lib/scheduling/types';

interface ScheduleChange {
  taskId: string;
  task: Task;
  oldBlocks: TimeBlock[];
  newBlocks: TimeBlock[];
  reason: string;
}

interface ReasoningCardProps {
  changes: ScheduleChange[];
}

export default function ReasoningCard({ changes }: ReasoningCardProps) {
  if (changes.length === 0) {
    return (
      <Card className="flex items-start gap-3 p-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success" />
        </span>
        <div>
          <div className="text-sm font-semibold">No changes needed</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">Your week already had room for this.</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-5 py-3.5">
        <Lightbulb className="h-4 w-4 text-primary" />
        <h4 className="text-[14px] font-semibold">Here's what I did and why</h4>
      </div>

      <motion.ul variants={staggerChildrenVariants} initial="hidden" animate="visible" className="divide-y">
        {changes.map((change) => {
          const dropped = change.newBlocks.length === 0;
          return (
            <motion.li key={change.taskId} variants={itemVariants} className="px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-medium">{change.task.title}</span>
                <Badge variant={change.task.priority === 'P1' ? 'warning' : 'outline'} className="num">
                  {change.task.priority}
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] tabular-nums">
                <span className="text-muted-foreground line-through decoration-muted-foreground/40">
                  {formatBlockTime(change.oldBlocks[0])}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className={dropped ? 'text-destructive' : 'font-medium text-foreground'}>
                  {formatBlockTime(change.newBlocks[0])}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{change.reason}</p>
            </motion.li>
          );
        })}
      </motion.ul>
    </Card>
  );
}
/**
 * Explain each change using the actual constraint and the actual block times
 */
export function generateReasoning(
  changedTaskIds: string[],
  tasks: Task[],
  before: Schedule,
  after: Schedule,
  constraint: Constraint
): ScheduleChange[] {
  const changes: ScheduleChange[] = [];
  const byStart = (a: TimeBlock, b: TimeBlock) => a.startTime.localeCompare(b.startTime);

  for (const taskId of changedTaskIds) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) continue;

    const oldBlocks = before.blocks.filter(b => b.taskId === taskId).sort(byStart);
    const newBlocks = after.blocks.filter(b => b.taskId === taskId).sort(byStart);
    const atRisk = after.atRiskTasks.find(r => r.taskId === taskId);

    let reason: string;
    if (newBlocks.length === 0 || atRisk) {
      reason = atRisk ? `At risk: ${atRisk.reason}` : 'No free time left for this task this week';
    } else if (oldBlocks.length === 0) {
      reason = 'Found time for it after the change';
    } else {
      const movedEarlier = newBlocks[0].startTime < oldBlocks[0].startTime;
      switch (constraint.type) {
        case 'deadline_added':
          reason = movedEarlier
            ? 'Moved earlier so it is done before the new deadline'
            : 'Moved to make room for the task with the new deadline';
          break;
        case 'time_reduced':
          reason = movedEarlier
            ? 'Moved into time freed up elsewhere'
            : `Only ${constraint.availableMinutes} min free that day, so it moved to the next free slot`;
          break;
        case 'shift_conflict':
          reason = movedEarlier
            ? 'Moved earlier, before the busy period'
            : 'Clashed with the busy period, so it moved to the next free slot';
          break;
        default:
          reason = 'Moved to fit the new plan';
      }
      if (task.deadline && !movedEarlier) {
        reason += ` (still before its deadline)`;
      }
    }

    changes.push({
      taskId,
      task,
      oldBlocks,
      newBlocks,
      reason,
    });
  }

  return changes;
}

function formatBlockTime(block: TimeBlock | undefined): string {
  if (!block) return 'Unscheduled';
  
  const date = new Date(block.startTime);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  let dayStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (date.toDateString() === today.toDateString()) dayStr = 'Today';
  if (date.toDateString() === tomorrow.toDateString()) dayStr = 'Tomorrow';
  
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  
  return `${dayStr} ${timeStr}`;
}
