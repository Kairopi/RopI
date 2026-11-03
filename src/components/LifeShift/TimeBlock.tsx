import { motion } from 'motion/react';
import type { TimeBlock as TimeBlockType } from '../../types/lifeshift';

interface TimeBlockProps {
  block: TimeBlockType;
  isOptimized?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onClick?: () => void;
}

const categoryColors = {
  work: 'bg-accent text-white',
  learn: 'bg-purple-500 text-white',
  health: 'bg-green-500 text-white',
  social: 'bg-pink-500 text-white',
  rest: 'bg-slate-400 text-white',
  other: 'bg-secondary text-white',
};

const priorityBorders = {
  high: 'border-l-4 border-l-red-500',
  medium: 'border-l-4 border-l-yellow-500',
  low: 'border-l-4 border-l-green-500',
};

export function TimeBlock({ 
  block, 
  isOptimized = false,
  onDragStart,
  onDragEnd,
  onClick 
}: TimeBlockProps) {
  const heightInPixels = (block.duration / 60) * 80; // 80px per hour

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.1}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        relative rounded-lg p-3 sm:p-4 cursor-pointer
        ${categoryColors[block.category]}
        ${priorityBorders[block.priority]}
        ${isOptimized ? 'ring-2 ring-green-400 ring-offset-2' : ''}
        shadow-sm hover:shadow-md transition-shadow
        min-h-[60px] sm:min-h-[80px]
        touch-manipulation
      `}
      style={{ 
        minHeight: `${Math.max(heightInPixels, 60)}px`,
      }}
    >
      {/* Time indicator */}
      <div className="text-xs opacity-90 font-medium mb-1">
        {block.startTime} - {block.endTime}
      </div>

      {/* Title */}
      <div className="font-semibold text-sm sm:text-base line-clamp-2">
        {block.title}
      </div>

      {/* Duration badge */}
      <div className="absolute top-2 right-2 text-xs bg-black/20 px-2 py-0.5 rounded-full">
        {Math.round(block.duration)}m
      </div>

      {/* Energy indicator */}
      <div className="flex items-center gap-1 mt-2 text-xs">
        <span className="opacity-75">Energy:</span>
        <div className="flex gap-0.5">
          {block.energy === 'peak' && '⚡⚡⚡'}
          {block.energy === 'moderate' && '⚡⚡'}
          {block.energy === 'low' && '⚡'}
        </div>
      </div>

      {/* Optimization badge */}
      {isOptimized && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full shadow-lg"
        >
          ✓ Optimized
        </motion.div>
      )}
    </motion.div>
  );
}
