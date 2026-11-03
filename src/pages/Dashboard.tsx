import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Sparkles, TrendingUp, Zap, Target, Clock, ArrowRight } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <DashboardLayout>
      <div>
        {/* Header - Responsive typography */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink mb-1 sm:mb-2 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm sm:text-base text-secondary mb-6 sm:mb-8">
          Welcome to ROPI - Your AI Life Operating System
        </p>

        {/* LifeShift WOW Banner - Featured */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8 bg-gradient-to-br from-accent via-blue-600 to-purple-600 rounded-3xl p-8 text-white cursor-pointer hover:shadow-2xl transition-all overflow-hidden relative group"
          onClick={() => navigate('/schedule')}
        >
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl" />
          </div>

          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1 tracking-tight">LifeShift</h2>
                <p className="text-sm text-white/90">Transform chaos into optimized flow</p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Productivity</span>
                </div>
                <div className="text-3xl font-bold tabular-nums">+47%</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Energy</span>
                </div>
                <div className="text-3xl font-bold tabular-nums">91%</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Balance</span>
                </div>
                <div className="text-3xl font-bold tabular-nums">+29%</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Focus</span>
                </div>
                <div className="text-3xl font-bold tabular-nums">+90<span className="text-lg">m</span></div>
              </div>
            </div>

            {/* CTA */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex items-center gap-2 bg-white text-accent px-6 py-3.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Optimize My Schedule
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </div>
        </motion.div>

        {/* Cards Grid - Responsive columns and gaps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {/* Today's Focus Card */}
          <div className="bg-paper p-4 sm:p-5 lg:p-6 rounded-lg shadow-card border border-line">
            <h3 className="text-base sm:text-lg font-semibold text-ink mb-3 sm:mb-4">
              🎯 Today's Focus
            </h3>
            <div className="space-y-2 sm:space-y-3">
              <div className="p-3 bg-ultramarine/5 rounded-lg border border-ultramarine/10">
                <p className="text-sm font-medium text-ink">Next Quiz</p>
                <p className="text-xs text-slate mt-0.5">AWS Lambda • 15 min</p>
              </div>
              <div className="p-3 bg-success/5 rounded-lg border border-success/10">
                <p className="text-sm font-medium text-ink">2 New Jobs</p>
                <p className="text-xs text-slate mt-0.5">90%+ match</p>
              </div>
            </div>
          </div>

          {/* Active Agents Card */}
          <div className="bg-paper p-4 sm:p-5 lg:p-6 rounded-lg shadow-card border border-line">
            <h3 className="text-base sm:text-lg font-semibold text-ink mb-3 sm:mb-4">
              ⚡ Active Agents
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 bg-ultramarine rounded-full animate-pulse"></div>
                <p className="text-sm text-ink">Job Hunter</p>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 bg-line rounded-full"></div>
                <p className="text-sm text-slate">Resume Writer</p>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 bg-line rounded-full"></div>
                <p className="text-sm text-slate">Scheduler</p>
              </div>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="bg-paper p-4 sm:p-5 lg:p-6 rounded-lg shadow-card border border-line sm:col-span-2 lg:col-span-1">
            <h3 className="text-base sm:text-lg font-semibold text-ink mb-3 sm:mb-4">
              📋 Recent Activity
            </h3>
            <div className="space-y-1.5 sm:space-y-2 text-sm text-slate">
              <p>• Schedule recalculated (0.8s)</p>
              <p>• Quiz completed: 4/5 (80%)</p>
              <p>• 3 new jobs discovered</p>
            </div>
          </div>
        </div>

        {/* Success Banner - Responsive padding and text */}
        <div className="mt-6 sm:mt-8 bg-ultramarine/5 border border-ultramarine/10 rounded-lg p-4 sm:p-5 lg:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-ink mb-1 sm:mb-2">
            🎉 Setup Complete!
          </h3>
          <p className="text-sm sm:text-base text-slate">
            Your ROPI system is ready. Start by exploring jobs, taking quizzes, or setting up your schedule.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
