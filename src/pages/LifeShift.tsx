import DashboardLayout from '../components/DashboardLayout'

export default function LifeShift() {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">
          LifeShift
        </h1>
        <p className="text-neutral-600 mb-8">
          Your schedule adapts in real-time
        </p>
        <div className="bg-white p-8 rounded-lg shadow-md border border-neutral-200 text-center">
          <p className="text-neutral-500">Coming soon: Real-time schedule recalculation</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
