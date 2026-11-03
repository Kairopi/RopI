import { motion } from 'motion/react';
import { Clock, Zap, GripVertical } from 'lucide-react';
import type { TimeBlock as TimeBlockType } from '../../types/lifeshift';

interface TimeBlockProps {
  block: TimeBlockType;
  isOptimized?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onClick?: () => void;
}

const categoryStyles = {
  work: {
    bg: 'bg-accent',
    text: 'text-white',
    border: 'border-accent/20',
    icon: '💼'
  },
  learn: {
    bg: 'bg-purple-600',
    text: 'text-white',
    border: 'border-purple-600/20',
    icon: '📚'
  },
  health: {
    bg: 'bg-emerald-600',
    text: 'text-white',
    border: 'border-emerald-600/20',
    icon: '💪'
  },
  social: {
    bg: 'bg-pink-600',
    text: 'text-white',
    border: 'border-pink-600/20',
    icon: '👥'
  },
  rest: {
    bg: 'bg-slate-500',
    text: 'text-white',
    border: 'border-slate-500/20',
    icon: '☕'
  },
  other: {
    bg: 'bg-gray-600',
    text: 'text-white',
    border: 'border-gray-600/20',
    icon: '📌'
  },
};

const priorityIndicators = {
  high: { color: 'bg-red-500', size: 'w-1 h-full' },
  medium: { color: 'bg-amber-400', size: 'w-1 h-full' },
  low: { color: 'bg-emerald-400', size: 'w-1 h-full' },
};

const energyConfig = {
  peak: { dots: 3, color: 'text-amber-400' },
  moderate: { dots: 2, color: 'text-blue-400' },
  low: { dots: 1, color: 'text-slate-400' },
};

export function TimeBlock({ 
  block, 
  isOptimized = false,
  onDragStart,
  onDragEnd,
  onClick 
}: TimeBlockProps) {
  const style = categoryStyles[block.category];
  const priority = priorityIndicators[block.priority];
  const energy = energyConfig[block.energy];
  
  const heightInPixels = Math.max((block.duration / 60) * 72, 72); // Min 72px

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.05}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        group relative rounded-xl overflow-hidden cursor-grab active:cursor-grabbing
        ${style.bg} ${style.text}
        shadow-sm hover:shadow-md transition-shadow
        border border-white/10
        ${isOptimized ? 'ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-canvas' : ''}
      `}
      style={{ 
        minHeight: `${heightInPixels}px`,
      }}
    >
      {/* Priority indicator bar */}
      <div className={`absolute left-0 top-0 ${priority.size} ${priority.color}`} />

      {/* Content wrapper */}
      <div className="relative p-4 h-full flex flex-col">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">{style.icon}</span>
            <div className="min-w-0">
              <div className="font-semibold text-[15px] leading-tight truncate">
                {block.title}
              </div>
              <div className="flex items-center gap-1.5 mt-1 opacity-90">
                <Clock className="w-3 h-3" />
                <span className="text-xs font-medium">
                  {block.startTime} - {block.endTime}
                </span>
              </div>
            </div>
          </div>

          {/* Duration badge */}
          <div className="flex-shrink-0 px-2 py-0.5 bg-black/15 backdrop-blur-sm rounded-md text-xs font-semibold">
            {Math.round(block.duration)}m
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mt-auto pt-2">
          {/* Energy indicator */}
          <div className="flex items-center gap-1">
            <Zap className={`w-3.5 h-3.5 ${energy.color}`} />
            <div className="flex gap-0.5">
              {Array.from({ length: energy.dots }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1 h-1 rounded-full ${energy.color.replace('text-', 'bg-')}`}
                />
              ))}
            </div>
          </div>

          {/* Drag handle */}
          <GripVertical className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity" />
        </div>
      </div>

      {/* Optimization badge */}
      {isOptimized && (
        <motion.div
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-lg flex items-center gap-1"
        >
          <Zap className="w-3 h-3" />
          Optimized
        </motion.div>
      )}
    </motion.div>
  );
}
