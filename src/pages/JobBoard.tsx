import DashboardLayout from '../components/DashboardLayout';

export default function JobBoard() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-matched opportunities
        </p>
      </div>
      <div className="text-sm text-muted-foreground">
        Job board coming soon...
      </div>
    </DashboardLayout>
  );
}
