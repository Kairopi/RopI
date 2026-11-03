import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  hours: string;
  description: string;
  subtasks?: string[];
}

const tasks: Task[] = [
  {
    id: '1',
    title: 'Hour 0-2: Project Setup',
    status: 'done',
    priority: 'high',
    hours: '0-2',
    description: 'Initialize Vite + React + TypeScript, install dependencies',
    subtasks: [
      '✅ Initialize Vite + React + TypeScript',
      '✅ Install TailwindCSS + shadcn/ui',
      '✅ Install Supabase client',
      '✅ Create folder structure',
      '✅ Test dev server runs'
    ]
  },
  {
    id: '2',
    title: 'Hour 4-6: Auth + Layout',
    status: 'done',
    priority: 'high',
    hours: '4-6',
    description: 'Login, AuthContext, DashboardLayout, navigation',
    subtasks: [
      '✅ Create Login page',
      '✅ Create AuthContext provider',
      '✅ Create DashboardLayout',
      '✅ Create placeholder pages',
      '✅ Test navigation works'
    ]
  },
  {
    id: '3',
    title: 'Hour 6-8: Design System Setup',
    status: 'in-progress',
    priority: 'high',
    hours: '6-8',
    description: 'ROPI 6-token color system, shadcn components, custom components',
    subtasks: [
      '✅ Install shadcn/ui (Button, Card, Badge, Input)',
      '✅ Apply 6-token color system',
      '✅ Fix HSL conversions',
      '⏳ Create custom ROPI components',
      '⏳ Document component patterns'
    ]
  },
  {
    id: '4',
    title: 'Hour 8-16: LifeShift WOW Moment',
    status: 'todo',
    priority: 'high',
    hours: '8-16',
    description: 'AI schedule optimizer - THE jaw-dropping demo',
    subtasks: [
      'TimeBlock component',
      'LifeShiftTimeline with Motion',
      'Before/After visualization',
      'Muse Wonder integration',
      'DecisionDiff component'
    ]
  },
  {
    id: '5',
    title: 'Hour 16-24: Learning Loop WOW',
    status: 'todo',
    priority: 'high',
    hours: '16-24',
    description: 'Adaptive quiz system with concept cards',
    subtasks: [
      'ConceptCard component',
      'Quiz generation logic',
      'Spaced repetition algorithm',
      'Progress tracking',
      'Muse Spark integration'
    ]
  },
  {
    id: '6',
    title: 'Hour 24-32: Job Discovery Core',
    status: 'todo',
    priority: 'high',
    hours: '24-32',
    description: 'Job matching → approval → application flow',
    subtasks: [
      'OpportunityPanel component',
      'Job matching algorithm',
      'Evidence generation',
      'Application approval flow',
      'Document preparation'
    ]
  }
];

const statusConfig = {
  'todo': { icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'To Do' },
  'in-progress': { icon: Clock, color: 'text-primary', bg: 'bg-primary/10', label: 'In Progress' },
  'done': { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Done' },
  'blocked': { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-500/10', label: 'Blocked' }
};

export default function TaskBoard() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Task Board</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Meta Hackathon 2026 • Deadline: Nov 4, 9PM EST • ~53 hours remaining
        </p>
      </div>

      {/* Progress bar */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall Progress</span>
          <span className="text-sm text-muted-foreground">2 of 6 complete</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: '33%' }} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task List */}
        <div className="space-y-3">
          {tasks.map((task) => {
            const config = statusConfig[task.status];
            const StatusIcon = config.icon;
            
            return (
              <Card
                key={task.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedTask?.id === task.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedTask(task)}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${config.bg}`}>
                    <StatusIcon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold">{task.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {task.hours}h
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {task.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {config.label}
                      </Badge>
                      {task.priority === 'high' && (
                        <Badge className="text-xs bg-red-500 text-white border-0">
                          High Priority
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Task Details */}
        <div>
          {selectedTask ? (
            <Card className="p-6 sticky top-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-xl ${statusConfig[selectedTask.status].bg}`}>
                  {(() => {
                    const StatusIcon = statusConfig[selectedTask.status].icon;
                    return <StatusIcon className={`w-6 h-6 ${statusConfig[selectedTask.status].color}`} />;
                  })()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{selectedTask.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    Hours {selectedTask.hours}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTask.description}
                </p>
              </div>

              {selectedTask.subtasks && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Subtasks</h3>
                  <div className="space-y-2">
                    {selectedTask.subtasks.map((subtask, idx) => {
                      const isDone = subtask.startsWith('✅');
                      const isInProgress = subtask.startsWith('⏳');
                      
                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 p-2 rounded-lg ${
                            isDone ? 'bg-emerald-500/5' : isInProgress ? 'bg-primary/5' : 'bg-muted'
                          }`}
                        >
                          {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />}
                          {isInProgress && <Clock className="w-4 h-4 text-primary mt-0.5" />}
                          {!isDone && !isInProgress && <Circle className="w-4 h-4 text-muted-foreground mt-0.5" />}
                          <span className={`text-sm ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                            {subtask.replace(/^[✅⏳]\s/, '')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <div className="text-muted-foreground">
                <Circle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">Click a task to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
