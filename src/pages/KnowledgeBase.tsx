import DashboardLayout from '../components/DashboardLayout';

export default function KnowledgeBase() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conceptual understanding
        </p>
      </div>
      <div className="text-sm text-muted-foreground">
        Knowledge base coming soon...
      </div>
    </DashboardLayout>
  );
}
