import DashboardLayout from '../components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, Clock } from 'lucide-react';

export default function Dashboard() {
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-5 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Active Jobs</div>
              <div className="text-2xl font-semibold tracking-tight">12</div>
            </div>
          </div>
        </Card>

        <Card className="p-5 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Skills Learned</div>
              <div className="text-2xl font-semibold tracking-tight">24</div>
            </div>
          </div>
        </Card>

        <Card className="p-5 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Hours This Week</div>
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
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border border-primary/20">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">AWS Lambda Quiz</div>
                <div className="text-xs text-muted-foreground mt-0.5">15 minutes</div>
              </div>
              <Badge>Next</Badge>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Review 2 Applications</div>
                <div className="text-xs text-muted-foreground mt-0.5">30 minutes</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Update Resume</div>
                <div className="text-xs text-muted-foreground mt-0.5">20 minutes</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <div className="flex-1 min-w-0">
                <div className="text-sm">Applied to Software Engineer at Vercel</div>
                <div className="text-xs text-muted-foreground mt-0.5">2 hours ago</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2" />
              <div className="flex-1 min-w-0">
                <div className="text-sm">Completed TypeScript Advanced course</div>
                <div className="text-xs text-muted-foreground mt-0.5">5 hours ago</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40 mt-2" />
              <div className="flex-1 min-w-0">
                <div className="text-sm">Updated schedule for this week</div>
                <div className="text-xs text-muted-foreground mt-0.5">Yesterday</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
