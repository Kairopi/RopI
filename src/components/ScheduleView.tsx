/**
 * Schedule View Component
 * 
 * Shows spaced repetition schedule for flashcards
 * Calendar view with due cards breakdown
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, TrendingUp } from '@/components/icons';

interface ScheduleViewProps {
  studyGuideId: string;
}

export function ScheduleView({ studyGuideId }: ScheduleViewProps) {
  // TODO: Fetch actual schedule data from database
  
  // Mock data for now
  const dueToday = 5;
  const dueTomorrow = 3;
  const dueThisWeek = 12;
  const mastery = 67;
  
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Due Today</div>
              <div className="text-2xl font-semibold">{dueToday}</div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Due This Week</div>
              <div className="text-2xl font-semibold">{dueThisWeek}</div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Mastery</div>
              <div className="text-2xl font-semibold">{mastery}%</div>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Calendar Placeholder */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Review Schedule</h3>
        
        <div className="text-sm text-muted-foreground text-center py-12">
          Calendar view coming soon
        </div>
      </Card>
      
      {/* Upcoming Reviews */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Upcoming Reviews</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <div className="font-medium text-sm">Today</div>
              <div className="text-xs text-muted-foreground">
                {dueToday} cards ready for review
              </div>
            </div>
            <Badge>{dueToday}</Badge>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <div className="font-medium text-sm">Tomorrow</div>
              <div className="text-xs text-muted-foreground">
                {dueTomorrow} cards scheduled
              </div>
            </div>
            <Badge variant="outline">{dueTomorrow}</Badge>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
            <div>
              <div className="font-medium text-sm">This Week</div>
              <div className="text-xs text-muted-foreground">
                {dueThisWeek} cards total
              </div>
            </div>
            <Badge variant="secondary">{dueThisWeek}</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
