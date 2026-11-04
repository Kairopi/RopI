/**
 * TodaysScheduleCard Component
 * 
 * Dashboard widget showing today's schedule snapshot
 * Click to open full LifeShift page
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ArrowRight, RefreshCw } from '@/components/icons';
import { formatDistanceToNow } from 'date-fns';
import type { Schedule, Task } from '@/lib/scheduling/types';
import { formatDate } from '@/lib/scheduling/utils';
import { itemVariants, staggerChildrenVariants } from '@/lib/animations/constants';

interface TodaysScheduleCardProps {
  currentSchedule: Schedule | null;
  tasks: Task[];
  lastRecalculationTime?: Date;
}

export default function TodaysScheduleCard({
  currentSchedule,
  tasks,
  lastRecalculationTime,
}: TodaysScheduleCardProps) {
  const navigate = useNavigate();

  // Today's blocks (block.date is a LOCAL calendar date)
  const today = formatDate(new Date());
  const allBlocks = [...(currentSchedule?.blocks ?? [])].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );
  const todayBlocks = allBlocks.filter(b => b.date === today);

  // Next 3 blocks today, or the next 3 coming up if today is free
  const showingToday = todayBlocks.length > 0;
  const upcomingBlocks = (showingToday ? todayBlocks : allBlocks).slice(0, 3);

  const getTask = (taskId: string) => tasks.find(t => t.id === taskId);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
    >
      <Card
        className="p-6 hover:border-primary/50 transition-colors cursor-pointer group"
        onClick={() => navigate('/schedule')}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">
                {showingToday || allBlocks.length === 0 ? "Today's Schedule" : 'Up Next'}
              </h3>
              {lastRecalculationTime && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="w-3 h-3" />
                  Updated {formatDistanceToNow(lastRecalculationTime, { addSuffix: true })}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {todayBlocks.length} block{todayBlocks.length !== 1 ? 's' : ''}
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>

        {/* Schedule Preview */}
        {upcomingBlocks.length > 0 ? (
          <motion.div
            variants={staggerChildrenVariants}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            {upcomingBlocks.map((block) => {
              const task = getTask(block.taskId);
              if (!task) return null;

              return (
                <motion.div
                  key={block.id}
                  variants={itemVariants}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    {!showingToday &&
                      new Date(block.startTime).toLocaleDateString('en-US', { weekday: 'short' }) + ' '}
                    {formatTime(block.startTime)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {task.title}
                    </div>
                  </div>
                  
                  {task.priority && (
                    <Badge variant="secondary" className="text-xs">
                      {task.priority}
                    </Badge>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Nothing scheduled in the next 7 days
          </div>
        )}

        {/* View All CTA */}
        {todayBlocks.length > 3 && (
          <div className="mt-4 pt-4 border-t text-center">
            <span className="text-xs text-muted-foreground">
              +{todayBlocks.length - 3} more task{todayBlocks.length - 3 !== 1 ? 's' : ''} today
            </span>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
