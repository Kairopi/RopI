import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Zap, Target, TrendingUp, Clock, ArrowRight, Loader2 } from 'lucide-react';
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
    
    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const result = generateLifeShiftAnalysis();
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleApplyOptimization = () => {
    // TODO: Save to Supabase
    alert('✅ Optimization applied! Your schedule has been updated.');
  };

  // Hero Landing State
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-canvas via-surface/30 to-canvas flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl w-full relative z-10"
        >
          {/* Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="flex justify-center mb-8"
          >
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-accent to-purple-600 rounded-[28px] flex items-center justify-center shadow-2xl">
                <Sparkles className="w-12 h-12 text-white" />
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-4 bg-gradient-to-r from-accent/20 to-purple-600/20 rounded-[36px] -z-10 blur-xl"
              />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl lg:text-7xl font-bold text-ink mb-4 tracking-tight">
              LifeShift
            </h1>
            <p className="text-xl lg:text-2xl text-secondary max-w-2xl mx-auto leading-relaxed">
              Transform your daily chaos into optimized flow.{' '}
              <span className="text-ink font-semibold">AI analyzes your schedule</span> and creates the perfect day.
            </p>
          </motion.div>

          {/* Feature Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid sm:grid-cols-3 gap-4 mb-12"
          >
            <div className="bg-surface rounded-2xl p-6 border border-border hover:border-accent/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-ink mb-2">Energy Aligned</h3>
              <p className="text-sm text-secondary leading-relaxed">
                Match tasks to your peak hours automatically
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-6 border border-border hover:border-accent/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-ink mb-2">Auto-Optimized</h3>
              <p className="text-sm text-secondary leading-relaxed">
                AI reorders for maximum productivity
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-6 border border-border hover:border-accent/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-ink mb-2">Balanced Life</h3>
              <p className="text-sm text-secondary leading-relaxed">
                Perfect work-rest-learn ratio guaranteed
              </p>
            </div>
          </motion.div>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startAnalysis}
              className="group inline-flex items-center gap-3 bg-gradient-to-r from-accent to-purple-600 text-white px-10 py-5 rounded-2xl font-semibold text-lg shadow-2xl hover:shadow-accent/20 transition-all"
            >
              <Sparkles className="w-6 h-6" />
              Analyze My Schedule
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            <p className="text-sm text-secondary mt-6 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Takes 2 seconds • Powered by Muse Wonder • Free forever
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Analyzing State
  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          {/* Spinner */}
          <motion.div className="flex justify-center mb-8">
            <div className="relative">
              <Loader2 className="w-16 h-16 text-accent animate-spin" />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-accent/20 rounded-full blur-xl"
              />
            </div>
          </motion.div>

          <h2 className="text-3xl font-bold text-ink mb-3 tracking-tight">
            Analyzing Your Schedule
          </h2>
          <p className="text-lg text-secondary mb-8">
            Muse Wonder is optimizing your day...
          </p>

          {/* Progress Steps */}
          <div className="space-y-4 text-left">
            {[
              { icon: Zap, text: 'Analyzing energy patterns', delay: 0 },
              { icon: Clock, text: 'Identifying time blocks', delay: 0.3 },
              { icon: Target, text: 'Optimizing task order', delay: 0.6 },
              { icon: TrendingUp, text: 'Calculating improvements', delay: 0.9 },
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: step.delay }}
                className="flex items-center gap-4 p-4 bg-surface rounded-xl border border-border"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-5 h-5 text-accent" />
                </div>
                <span className="text-sm font-medium text-ink">{step.text}</span>
                <Loader2 className="w-4 h-4 text-secondary animate-spin ml-auto" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // Results State
  return (
    <div className="min-h-screen bg-canvas p-6 lg:p-10">
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
