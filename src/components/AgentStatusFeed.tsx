/**
 * AgentStatusFeed Component
 * 
 * Shows real-time agent status updates during schedule recalculation
 * Staggers animations for visual polish
 */

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Calendar, GraduationCap, Briefcase } from '@/components/icons';
import { itemVariants, staggerChildrenVariants } from '@/lib/animations/constants';
import type { Constraint, Schedule } from '@/lib/scheduling/types';

export interface AgentStatus {
  agent: 'scheduler' | 'job_agent' | 'study_agent' | 'system';
  action: string;
  timestamp: number;
}

interface AgentStatusFeedProps {
  updates: AgentStatus[];
}

const AGENT_CONFIG = {
  scheduler: {
    icon: Calendar,
    label: 'Scheduler',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  job_agent: {
    icon: Briefcase,
    label: 'Job Agent',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  study_agent: {
    icon: GraduationCap,
    label: 'Study Agent',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  system: {
    icon: Bot,
    label: 'System',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
} as const;

export default function AgentStatusFeed({ updates }: AgentStatusFeedProps) {
  if (updates.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="eyebrow mb-3">What Ropi did</div>
      <motion.ol
        variants={staggerChildrenVariants}
        initial="hidden"
        animate="visible"
        className="relative space-y-3 before:absolute before:left-[13px] before:top-3 before:bottom-3 before:w-px before:bg-border"
      >
        {updates.map((update, i) => {
          const config = AGENT_CONFIG[update.agent];
          const Icon = config.icon;
          return (
            <motion.li key={i} variants={itemVariants} className="relative flex items-start gap-3">
              <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${config.bgColor}`}>
                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold">{config.label}</span>
                  {update.timestamp > 0 && <span className="num text-[11px] text-muted-foreground">{update.timestamp}ms</span>}
                </div>
                <div className="text-[13px] leading-snug text-muted-foreground">{update.action}</div>
              </div>
            </motion.li>
          );
        })}
      </motion.ol>
    </Card>
  );
}
/**
 * Describe what actually happened during a recalculation.
 * Every line comes from real data (the parsed constraint and the new schedule).
 */
export function generateStatusUpdates(
  constraint: Constraint,
  schedule: Schedule,
  changedTasksCount: number
): AgentStatus[] {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const updates: AgentStatus[] = [
    {
      agent: 'system',
      action:
        constraint.parsedBy === 'muse'
          ? 'Meta Muse turned your sentence into a structured change'
          : 'Understood your sentence with built-in rules (Muse unavailable)',
      timestamp: 0,
    },
    {
      agent: 'scheduler',
      action: `Found ${plural(schedule.freeSlotCount ?? 0, 'free slot')} in the next 7 days`,
      timestamp: 0,
    },
    {
      agent: 'scheduler',
      action: `Placed ${plural(schedule.blocks.length, 'time block')}, moved ${plural(changedTasksCount, 'task')}`,
      timestamp: schedule.calculationTime,
    },
  ];

  if (schedule.atRiskTasks.length > 0) {
    updates.push({
      agent: 'scheduler',
      action: `${plural(schedule.atRiskTasks.length, 'task')} at risk: not enough time before the deadline`,
      timestamp: schedule.calculationTime,
    });
  }

  return updates;
}
