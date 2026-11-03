import DashboardLayout from '../components/DashboardLayout'

export default function JobBoard() {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">
          Job Board
        </h1>
        <p className="text-neutral-600 mb-8">
          Discover jobs matched to your goals
        </p>
        <div className="bg-white p-8 rounded-lg shadow-md border border-neutral-200 text-center">
          <p className="text-neutral-500">Coming soon: Job discovery and application system</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
