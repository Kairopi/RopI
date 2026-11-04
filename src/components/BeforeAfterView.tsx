/**
 * BeforeAfterView Component
 *
 * Split-screen comparison of schedule before/after a constraint.
 * Highlights changed tasks and shows recalculation time.
 */

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, RefreshCw } from '@/components/icons';
import ScheduleTimeline from './ScheduleTimeline';
import type { Schedule, Task } from '@/lib/scheduling/types';

interface BeforeAfterViewProps {
  before: Schedule | null;
  after: Schedule | null;
  tasks: Task[];
  changedTaskIds: string[];
}

export default function BeforeAfterView({ before, after, tasks, changedTaskIds }: BeforeAfterViewProps) {
  if (!before && !after) {
    return (
      <Card className="p-12 text-center">
        <div className="text-muted-foreground">Add a change to see the before/after comparison</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {after && (
        <motion.div
          className="flex items-center justify-between gap-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Replanned in {after.calculationTime}ms</span>
          </div>
          <Badge variant={changedTaskIds.length > 0 ? 'secondary' : 'outline'}>
            {changedTaskIds.length === 0
              ? 'Nothing had to move'
              : `${changedTaskIds.length} task${changedTaskIds.length !== 1 ? 's' : ''} moved`}
          </Badge>
        </motion.div>
      )}

      <motion.div
        className="relative grid grid-cols-1 lg:grid-cols-2 gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="text-sm font-medium">Before</div>
            {before && (
              <Badge variant="outline" className="text-xs">
                {before.blocks.length} blocks
              </Badge>
            )}
          </div>
          {before ? (
            <ScheduleTimeline blocks={before.blocks} tasks={tasks} />
          ) : (
            <Card className="p-8 text-center text-muted-foreground text-sm">Original schedule</Card>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <ArrowRight className="w-4 h-4 text-primary" />
            <div className="text-sm font-medium">After</div>
            {after && (
              <Badge variant="outline" className="text-xs">
                {after.blocks.length} blocks
              </Badge>
            )}
          </div>
          {after ? (
            <ScheduleTimeline blocks={after.blocks} tasks={tasks} highlightChanges={changedTaskIds} />
          ) : (
            <Card className="p-8 text-center text-muted-foreground text-sm">Recalculated schedule</Card>
          )}
        </div>
      </motion.div>

      {after && after.atRiskTasks.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-2 text-sm font-medium mb-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              At risk
            </div>
            <div className="space-y-2">
              {after.atRiskTasks.map((atRisk) => {
                const task = tasks.find((t) => t.id === atRisk.taskId);
                return (
                  <div key={atRisk.taskId} className="text-xs">
                    <span className="font-medium">{task?.title || atRisk.taskId}</span>
                    <span className="text-muted-foreground"> - {atRisk.reason}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
