import { motion } from 'motion/react';
import { Clock, TrendingUp, Activity, Award } from 'lucide-react';
import type { DaySchedule } from '../../types/lifeshift';
import { TimeBlock } from './TimeBlock';

interface ScheduleColumnProps {
  schedule: DaySchedule;
  title: string;
  subtitle?: string;
  isOptimized?: boolean;
}

export function ScheduleColumn({ schedule, title, subtitle, isOptimized = false }: ScheduleColumnProps) {
  const productiveHours = (schedule.totalProductiveTime / 60).toFixed(1);
  const restHours = (schedule.totalRestTime / 60).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, x: isOptimized ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 100 }}
      className="flex flex-col h-full"
    >
      {/* Header Card */}
      <div className="bg-surface rounded-2xl p-5 mb-4 border border-border shadow-sm">
        {/* Title */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            {isOptimized ? (
              <Activity className="w-5 h-5 text-accent" />
            ) : (
              <Clock className="w-5 h-5 text-secondary" />
            )}
            <h3 className="text-lg font-semibold text-ink tracking-tight">{title}</h3>
          </div>
          {subtitle && (
            <p className="text-sm text-secondary leading-relaxed">{subtitle}</p>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Productive Time */}
          <div className="bg-accent/5 rounded-xl p-3 border border-accent/10">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-medium text-secondary uppercase tracking-wide">
                Productive
              </span>
            </div>
            <div className="text-2xl font-bold text-ink tabular-nums">
              {productiveHours}<span className="text-base text-secondary">h</span>
            </div>
          </div>

          {/* Rest Time */}
          <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-medium text-secondary uppercase tracking-wide">
                Rest
              </span>
            </div>
            <div className="text-2xl font-bold text-ink tabular-nums">
              {restHours}<span className="text-base text-secondary">h</span>
            </div>
          </div>
        </div>

        {/* Score Badges */}
        <div className="flex gap-2 mt-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent rounded-full">
            <Zap className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold tabular-nums">{schedule.energyScore}%</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-700 rounded-full">
            <Award className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold tabular-nums">{schedule.balanceScore}%</span>
          </div>
        </div>
      </div>

      {/* Time Blocks Container */}
      <div className="flex-1 bg-surface rounded-2xl p-4 border border-border shadow-sm overflow-hidden">
        <div className="h-full overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {schedule.blocks.map((block, idx) => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <TimeBlock 
                block={block} 
                isOptimized={isOptimized}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Import Zap icon
import { Zap } from 'lucide-react';
