/**
 * Summary View Component
 * 
 * Shows AI-generated summary, key points, prerequisites, and learning objectives
 * Used in Study Guide viewer's Summary tab
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Target, BookOpen, Lightbulb } from '@/components/icons';
import type { StudyGuideDB } from '@/lib/learning/study-materials-db';

interface SummaryViewProps {
  guide: StudyGuideDB;
}

export function SummaryView({ guide }: SummaryViewProps) {
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Summary</h3>
        </div>
        
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {guide.summary}
        </p>
      </Card>
      
      {/* Key Points */}
      {guide.key_points && guide.key_points.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Key Points</h3>
          </div>
          
          <ul className="space-y-3">
            {guide.key_points.map((point, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">
                    {index + 1}
                  </span>
                </div>
                <span className="text-sm leading-relaxed flex-1">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      
      {/* Prerequisites */}
      {guide.prerequisites && guide.prerequisites.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Prerequisites</h3>
          </div>
          
          <p className="text-xs text-muted-foreground mb-3">
            Make sure you understand these concepts first:
          </p>
          
          <div className="flex flex-wrap gap-2">
            {guide.prerequisites.map((prereq, index) => (
              <Badge key={index} variant="secondary">
                {prereq}
              </Badge>
            ))}
          </div>
        </Card>
      )}
      
      {/* Learning Objectives */}
      {guide.learning_objectives && guide.learning_objectives.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Learning Objectives</h3>
          </div>
          
          <p className="text-xs text-muted-foreground mb-3">
            After studying this material, you will be able to:
          </p>
          
          <ul className="space-y-2">
            {guide.learning_objectives.map((objective, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      
      {/* Metadata */}
      <Card className="p-6 bg-muted/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Difficulty</div>
            <Badge variant={
              guide.difficulty === 'beginner' ? 'secondary' :
              guide.difficulty === 'intermediate' ? 'default' :
              'destructive'
            }>
              {guide.difficulty}
            </Badge>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1">Study Time</div>
            <div className="font-medium">
              {guide.estimated_study_time_minutes || 30} min
            </div>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1">Created</div>
            <div className="font-medium">
              {new Date(guide.created_at).toLocaleDateString()}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1">Source</div>
            <Badge variant="outline">
              {guide.source_type}
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
