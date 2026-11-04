/**
 * ScheduleTimeline Component
 * 
 * Visual timeline showing scheduled time blocks
 * Color-coded by category, shows duration and time
 */

import type { TimeBlock, Task } from '@/lib/scheduling/types';
import { formatDate as localYmd } from '@/lib/scheduling/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from '@/components/icons';

interface ScheduleTimelineProps {
  blocks: TimeBlock[];
  tasks: Task[];
  highlightChanges?: string[]; // Task IDs that changed
}

const CATEGORY_COLORS: Record<string, string> = {
  learning: 'bg-primary/10 border-primary/30 text-primary',
  career: 'bg-primary/10 border-primary/30 text-primary',
  personal: 'bg-success/10 border-success/30 text-success',
  default: 'bg-muted border-border text-foreground',
};

export default function ScheduleTimeline({ 
  blocks, 
  tasks,
  highlightChanges = []
}: ScheduleTimelineProps) {
  // Group blocks by date
  const blocksByDate = blocks.reduce((acc, block) => {
    if (!acc[block.date]) acc[block.date] = [];
    acc[block.date].push(block);
    return acc;
  }, {} as Record<string, TimeBlock[]>);

  const dates = Object.keys(blocksByDate).sort();

  const getTask = (taskId: string) => tasks.find(t => t.id === taskId);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // block.date is a LOCAL calendar date, so compare with local dates (not UTC)
    if (dateString === localYmd(today)) return 'Today';
    if (dateString === localYmd(tomorrow)) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (blocks.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="text-muted-foreground">
          No scheduled blocks yet. Add constraints to generate a schedule.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {dates.map((date) => (
        <div key={date}>
          <div className="text-sm font-medium mb-3 text-muted-foreground">
            {formatDate(date)}
          </div>
          <div className="space-y-2">
            {blocksByDate[date]
              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
              .map((block) => {
                const task = getTask(block.taskId);
                if (!task) return null;

                const category = task.category || 'default';
                const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
                const isHighlighted = highlightChanges.includes(task.id);

                return (
                  <Card 
                    key={block.id}
                    className={`
                      p-4 border-l-4 transition-all duration-300
                      ${colorClass}
                      ${isHighlighted ? 'ring-2 ring-primary' : 'hover:border-primary/40'}
                    `}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium truncate">
                            {task.title}
                          </h4>
                          {block.totalBlocks > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {block.blockIndex + 1}/{block.totalBlocks}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(block.startTime)} - {formatTime(block.endTime)}
                          </div>
                          {task.priority && (
                            <Badge variant="secondary" className="text-xs">
                              {task.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex gap-1">
                          {task.tags.slice(0, 2).map((tag) => (
                            <Badge 
                              key={tag} 
                              variant="outline" 
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
