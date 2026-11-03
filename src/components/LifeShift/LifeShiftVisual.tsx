import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Zap, Target, Clock, ChevronRight, Sparkles, BarChart3 } from 'lucide-react';
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
    <div className="w-full min-h-screen flex flex-col gap-6">
      {/* Hero Stats Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-accent via-blue-600 to-purple-600 rounded-3xl p-8 lg:p-10 text-white shadow-2xl overflow-hidden relative"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">LifeShift Analysis</h2>
              <p className="text-sm lg:text-base text-white/80 mt-0.5">
                AI-optimized for peak performance
              </p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-300" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  Productivity
                </span>
              </div>
              <div className="text-4xl font-bold tabular-nums">
                +{improvements.productiveTime}%
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-300" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  Energy Match
                </span>
              </div>
              <div className="text-4xl font-bold tabular-nums">
                +{improvements.energyAlignment}%
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-300" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  Balance
                </span>
              </div>
              <div className="text-4xl font-bold tabular-nums">
                +{improvements.balance}%
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-purple-300" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  Focus Time
                </span>
              </div>
              <div className="text-4xl font-bold tabular-nums">
                +{improvements.focusTime}<span className="text-xl">m</span>
              </div>
            </motion.div>
          </div>

          {/* Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowComparison(!showComparison)}
            className="mt-8 flex items-center gap-2 bg-white text-accent px-6 py-3.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <BarChart3 className="w-5 h-5" />
            {showComparison ? 'Hide Comparison' : 'Show Before & After'}
            <ChevronRight className={`w-4 h-4 transition-transform ${showComparison ? 'rotate-90' : ''}`} />
          </motion.button>
        </div>
      </motion.div>

      {/* Schedule Comparison */}
      <AnimatePresence mode="wait">
        {showComparison ? (
          <motion.div
            key="comparison"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <ScheduleColumn
              schedule={analysis.before}
              title="Before Optimization"
              subtitle="Your current schedule"
            />
            <ScheduleColumn
              schedule={analysis.after}
              title="After Optimization"
              subtitle="AI-enhanced for peak performance"
              isOptimized
            />
          </motion.div>
        ) : (
          <motion.div
            key="single"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-3xl mx-auto w-full"
          >
            <ScheduleColumn
              schedule={analysis.after}
              title="Your Optimized Schedule"
              subtitle="Ready to transform your day"
              isOptimized
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Insights Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-surface rounded-3xl p-8 border border-border shadow-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <h3 className="text-xl font-bold text-ink tracking-tight">AI Insights</h3>
        </div>

        <div className="space-y-4">
          {analysis.insights.map((insight, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + idx * 0.1 }}
              className="flex items-start gap-4 p-4 bg-canvas rounded-xl border border-border hover:border-accent/20 transition-colors"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-bold text-sm">
                {idx + 1}
              </div>
              <p className="text-sm text-secondary leading-relaxed pt-1">
                {insight}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Apply Button */}
        {onApplyOptimization && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onApplyOptimization}
            className="mt-8 w-full bg-gradient-to-r from-accent to-blue-600 text-white px-8 py-5 rounded-2xl font-semibold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Apply This Optimization
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}
