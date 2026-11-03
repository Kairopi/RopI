import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LifeShiftVisual } from '../components/LifeShift/LifeShiftVisual';
import type { LifeShiftAnalysis } from '../types/lifeshift';
import { generateLifeShiftAnalysis } from '../utils/lifeshiftEngine';

export default function LifeShift() {
  const [analysis, setAnalysis] = useState<LifeShiftAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setHasStarted(true);
    
    // Simulate AI analysis with Muse Wonder
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const result = generateLifeShiftAnalysis();
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleApplyOptimization = () => {
    // TODO: Save optimized schedule to Supabase
    alert('Optimization applied! Your schedule has been updated.');
  };

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full"
        >
          {/* Hero section */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-block"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-accent to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <span className="text-3xl sm:text-4xl">🔄</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-3xl sm:text-5xl font-bold text-ink mb-3 sm:mb-4"
            >
              LifeShift
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base sm:text-xl text-secondary max-w-lg mx-auto"
            >
              Transform your daily chaos into optimized flow. AI analyzes your schedule and creates the perfect day.
            </motion.p>
          </div>

          {/* Feature cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid sm:grid-cols-3 gap-4 mb-8"
          >
            <div className="bg-surface rounded-xl p-4 border border-border">
              <div className="text-2xl mb-2">⚡</div>
              <div className="font-semibold text-sm text-ink mb-1">Energy Aligned</div>
              <div className="text-xs text-secondary">Match tasks to your peak hours</div>
            </div>
            <div className="bg-surface rounded-xl p-4 border border-border">
              <div className="text-2xl mb-2">🎯</div>
              <div className="font-semibold text-sm text-ink mb-1">Auto-Optimized</div>
              <div className="text-xs text-secondary">AI reorders for maximum productivity</div>
            </div>
            <div className="bg-surface rounded-xl p-4 border border-border">
              <div className="text-2xl mb-2">⚖️</div>
              <div className="font-semibold text-sm text-ink mb-1">Balanced Life</div>
              <div className="text-xs text-secondary">Perfect work-rest-learn ratio</div>
            </div>
          </motion.div>

          {/* CTA button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startAnalysis}
            className="w-full bg-gradient-to-r from-accent to-purple-600 text-white py-4 sm:py-5 rounded-xl font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all"
          >
            Analyze My Schedule with AI
          </motion.button>

          {/* Info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs sm:text-sm text-secondary text-center mt-4"
          >
            Powered by Muse Wonder • Takes 2 seconds • Free forever
          </motion.p>
        </motion.div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4 sm:mb-6"
          />
          <h2 className="text-xl sm:text-2xl font-bold text-ink mb-2">Analyzing Your Schedule...</h2>
          <p className="text-sm sm:text-base text-secondary">Muse Wonder is optimizing your day</p>

          {/* Analysis steps */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 sm:mt-8 space-y-2 text-left max-w-md mx-auto"
          >
            {[
              'Analyzing your energy patterns...',
              'Identifying time blocks...',
              'Optimizing task order...',
              'Calculating improvements...'
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + idx * 0.2 }}
                className="flex items-center gap-3 text-sm text-secondary"
              >
                <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                {step}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {analysis && (
          <LifeShiftVisual 
            analysis={analysis} 
            onApplyOptimization={handleApplyOptimization}
          />
        )}
      </div>
    </div>
  );
}
