/**
 * Study Guide Card Component
 * 
 * Shows study guide summary with stats and progress ring
 * Used in Learning Hub grid
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Clock, ArrowRight, CreditCard as Cards } from '@/components/icons';
import type { StudyGuideDB } from '@/lib/learning/study-materials-db';

interface StudyGuideCardProps {
  guide: StudyGuideDB;
  onClick: () => void;
}

export function StudyGuideCard({ guide, onClick }: StudyGuideCardProps) {
  const flashcardCount = (guide.flashcards as any)?.length || 0;
  const summary = guide.summary?.trim() ?? '';

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
      className="group flex cursor-pointer flex-col p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="mb-4 flex items-start justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
          <BookOpen className="h-[18px] w-[18px] text-primary" />
        </span>
        {guide.difficulty && (
          <Badge variant="outline" className="capitalize">
            {guide.difficulty}
          </Badge>
        )}
      </div>
      <h3 className="font-sans text-[15px] font-semibold leading-snug tracking-normal line-clamp-2">{guide.title}</h3>
      {summary && <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground">{summary}</p>}
      <div className="mt-auto flex items-center gap-4 pt-5 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Cards className="h-3.5 w-3.5" />
          <span className="num">{flashcardCount}</span> cards
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span className="num">{guide.estimated_study_time_minutes || 30}</span> min
        </span>
        <ArrowRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Card>
  );
}