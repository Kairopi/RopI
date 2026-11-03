import DashboardLayout from '../components/DashboardLayout'

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">
          Dashboard
        </h1>
        <p className="text-neutral-600 mb-8">
          Welcome to ROPI - Your AI Life Operating System
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Today's Focus Card */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-neutral-200">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              🎯 Today's Focus
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-primary-50 rounded-lg">
                <p className="text-sm font-medium text-primary-900">Next Quiz</p>
                <p className="text-xs text-primary-700">AWS Lambda • 15 min</p>
              </div>
              <div className="p-3 bg-success-50 rounded-lg">
                <p className="text-sm font-medium text-success-900">2 New Jobs</p>
                <p className="text-xs text-success-700">90%+ match</p>
              </div>
            </div>
          </div>

          {/* Active Agents Card */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-neutral-200">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              ⚡ Active Agents
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary-500 rounded-full animate-pulse"></div>
                <p className="text-sm text-neutral-700">Job Hunter</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-neutral-300 rounded-full"></div>
                <p className="text-sm text-neutral-500">Resume Writer</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-neutral-300 rounded-full"></div>
                <p className="text-sm text-neutral-500">Scheduler</p>
              </div>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-neutral-200">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              📋 Recent Activity
            </h3>
            <div className="space-y-2 text-sm text-neutral-600">
              <p>• Schedule recalculated (0.8s)</p>
              <p>• Quiz completed: 4/5 (80%)</p>
              <p>• 3 new jobs discovered</p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-primary-50 border border-primary-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-primary-900 mb-2">
            🎉 Setup Complete!
          </h3>
          <p className="text-primary-700">
            Your ROPI system is ready. Start by exploring jobs, taking quizzes, or setting up your schedule.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
