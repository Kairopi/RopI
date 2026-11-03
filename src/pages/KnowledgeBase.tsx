import DashboardLayout from '../components/DashboardLayout'

export default function KnowledgeBase() {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">
          Knowledge Base
        </h1>
        <p className="text-neutral-600 mb-8">
          Your notes become active learning resources
        </p>
        <div className="bg-white p-8 rounded-lg shadow-md border border-neutral-200 text-center">
          <p className="text-neutral-500">Coming soon: Document upload and search</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
