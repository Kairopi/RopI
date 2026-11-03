import DashboardLayout from '../components/DashboardLayout';

export default function LearningHub() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Learn</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Adaptive learning paths
        </p>
      </div>
      <div className="text-sm text-muted-foreground">
        Learning hub coming soon...
      </div>
    </DashboardLayout>
  );
}
