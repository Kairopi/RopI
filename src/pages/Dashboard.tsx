import DashboardLayout from '../components/DashboardLayout'

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div>
        {/* Header - Responsive typography */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink mb-1 sm:mb-2 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm sm:text-base text-slate mb-6 sm:mb-8">
          Welcome to ROPI - Your AI Life Operating System
        </p>

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
