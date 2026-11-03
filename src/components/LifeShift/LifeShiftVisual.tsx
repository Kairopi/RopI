import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { LifeShiftAnalysis } from '../../types/lifeshift';
import { ScheduleColumn } from './ScheduleColumn';

interface LifeShiftVisualProps {
  analysis: LifeShiftAnalysis;
  onApplyOptimization?: () => void;
}

export function LifeShiftVisual({ analysis, onApplyOptimization }: LifeShiftVisualProps) {
  const [showComparison, setShowComparison] = useState(false);

  const improvements = analysis.improvements;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header with improvements */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-accent to-purple-600 text-white rounded-xl p-4 sm:p-6 mb-4 sm:mb-6"
      >
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Your LifeShift Analysis</h2>
        <p className="text-sm sm:text-base opacity-90 mb-4">
          AI-powered schedule optimization for peak performance
        </p>

        {/* Improvement metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-xs sm:text-sm opacity-80">Productivity</div>
            <div className="text-xl sm:text-2xl font-bold">+{improvements.productiveTime}%</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-xs sm:text-sm opacity-80">Energy Alignment</div>
            <div className="text-xl sm:text-2xl font-bold">+{improvements.energyAlignment}%</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-xs sm:text-sm opacity-80">Balance</div>
            <div className="text-xl sm:text-2xl font-bold">+{improvements.balance}%</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <div className="text-xs sm:text-sm opacity-80">Focus Time</div>
            <div className="text-xl sm:text-2xl font-bold">+{improvements.focusTime}m</div>
          </div>
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="mt-4 bg-white text-accent px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-gray-100 transition-colors w-full sm:w-auto"
        >
          {showComparison ? 'Hide Comparison' : 'Show Before & After'}
        </button>
      </motion.div>

      {/* Schedule comparison */}
      <AnimatePresence mode="wait">
        {showComparison ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 flex-1 overflow-hidden"
          >
            <ScheduleColumn
              schedule={analysis.before}
              title="Before Optimization"
              subtitle="Your current schedule"
            />
            <ScheduleColumn
              schedule={analysis.after}
              title="After Optimization"
              subtitle="AI-optimized for peak performance"
              isOptimized
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-hidden"
          >
            <ScheduleColumn
              schedule={analysis.after}
              title="Optimized Schedule"
              subtitle="Your AI-enhanced daily flow"
              isOptimized
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 sm:mt-6 bg-surface rounded-xl p-4 sm:p-6 border border-border"
      >
        <h3 className="text-base sm:text-lg font-semibold text-ink mb-3">AI Insights</h3>
        <ul className="space-y-2">
          {analysis.insights.map((insight, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-start gap-2 text-xs sm:text-sm text-secondary"
            >
              <span className="text-accent font-bold mt-0.5">•</span>
              <span>{insight}</span>
            </motion.li>
          ))}
        </ul>

        {/* Apply button */}
        {onApplyOptimization && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onApplyOptimization}
            className="mt-4 w-full bg-accent text-white px-4 sm:px-6 py-3 sm:py-4 rounded-lg font-semibold text-sm sm:text-base hover:bg-accent/90 transition-colors shadow-lg"
          >
            Apply This Optimization
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}
