import DashboardLayout from '../components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, Clock } from 'lucide-react';

export default function Dashboard() {
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-[hsl(var(--secondary))] mt-1">
          Welcome back
        </p>
      </div>

      {/* Stats Grid - With accent colors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-5 border-[hsl(var(--border))] hover:border-[hsl(var(--accent))] transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--accent)_/_0.1)] flex items-center justify-center">
              <Target className="w-5 h-5 text-[hsl(var(--accent))]" />
            </div>
            <div>
              <div className="text-sm text-[hsl(var(--secondary))]">Active Jobs</div>
              <div className="text-2xl font-semibold tracking-tight">12</div>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-[hsl(var(--border))] hover:border-[hsl(var(--success))] transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--success)_/_0.1)] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[hsl(var(--success))]" />
            </div>
            <div>
              <div className="text-sm text-[hsl(var(--secondary))]">Skills Learned</div>
              <div className="text-2xl font-semibold tracking-tight">24</div>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-[hsl(var(--border))] hover:border-[hsl(var(--accent))] transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--accent)_/_0.1)] flex items-center justify-center">
              <Clock className="w-5 h-5 text-[hsl(var(--accent))]" />
            </div>
            <div>
              <div className="text-sm text-[hsl(var(--secondary))]">Hours This Week</div>
              <div className="text-2xl font-semibold tracking-tight">32</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Focus */}
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Today's Focus</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(var(--surface))] border border-[hsl(var(--accent)_/_0.2)]">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">AWS Lambda Quiz</div>
                <div className="text-xs text-[hsl(var(--secondary))] mt-0.5">15 minutes</div>
              </div>
              <Badge className="bg-[hsl(var(--accent))] text-white border-0">Next</Badge>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[hsl(var(--surface))] transition-colors cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Review 2 Applications</div>
                <div className="text-xs text-[hsl(var(--secondary))] mt-0.5">30 minutes</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[hsl(var(--surface))] transition-colors cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Update Resume</div>
                <div className="text-xs text-[hsl(var(--secondary))] mt-0.5">20 minutes</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--accent))] mt-2" />
              <div className="flex-1 min-w-0">
                <div className="text-sm">Applied to Software Engineer at Vercel</div>
                <div className="text-xs text-[hsl(var(--secondary))] mt-0.5">2 hours ago</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))] mt-2" />
              <div className="flex-1 min-w-0">
                <div className="text-sm">Completed TypeScript Advanced course</div>
                <div className="text-xs text-[hsl(var(--secondary))] mt-0.5">5 hours ago</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--secondary))] mt-2" />
              <div className="flex-1 min-w-0">
                <div className="text-sm">Updated schedule for this week</div>
                <div className="text-xs text-[hsl(var(--secondary))] mt-0.5">Yesterday</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
