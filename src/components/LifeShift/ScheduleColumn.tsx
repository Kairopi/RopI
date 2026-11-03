import { motion } from 'motion/react';
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
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full bg-surface rounded-xl p-4 sm:p-6 border border-border"
    >
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-ink">{title}</h3>
        {subtitle && (
          <p className="text-xs sm:text-sm text-secondary mt-1">{subtitle}</p>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-canvas rounded-lg p-2 sm:p-3">
            <div className="text-xs text-secondary">Productive</div>
            <div className="text-lg sm:text-xl font-semibold text-accent">
              {productiveHours}h
            </div>
          </div>
          <div className="bg-canvas rounded-lg p-2 sm:p-3">
            <div className="text-xs text-secondary">Rest</div>
            <div className="text-lg sm:text-xl font-semibold text-green-600">
              {restHours}h
            </div>
          </div>
        </div>

        {/* Score badges */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <div className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
            Energy: {schedule.energyScore}%
          </div>
          <div className="text-xs bg-green-500/10 text-green-700 px-2 py-1 rounded-full">
            Balance: {schedule.balanceScore}%
          </div>
        </div>
      </div>

      {/* Time blocks */}
      <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 pr-1">
        {schedule.blocks.map((block) => (
          <TimeBlock 
            key={block.id} 
            block={block} 
            isOptimized={isOptimized}
          />
        ))}
      </div>
    </motion.div>
  );
}
