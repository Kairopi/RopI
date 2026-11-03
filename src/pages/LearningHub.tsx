import DashboardLayout from '../components/DashboardLayout'

export default function LearningHub() {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">
          Learning Hub
        </h1>
        <p className="text-neutral-600 mb-8">
          Master skills with adaptive quizzes
        </p>
        <div className="bg-white p-8 rounded-lg shadow-md border border-neutral-200 text-center">
          <p className="text-neutral-500">Coming soon: Voice quizzes and spaced repetition</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
