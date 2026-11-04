/**
 * NextLessonCard - the lesson ROPI generated for your weakest concept
 *
 * States: generating, error (with retry), no weak spot (optional on-demand
 * lesson), and the lesson itself with practice exercises you can work through.
 */

import { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  ChevronDown,
  Clock,
  Lightbulb,
  Loader2,
  RefreshCw,
} from '@/components/icons';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AdaptiveLesson, PracticeExercise } from '@/lib/learning/adaptive-lessons';

interface NextLessonCardProps {
  lesson: AdaptiveLesson | null;
  isGenerating?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Concept to offer a lesson on when there is no confirmed weak spot */
  suggestedConcept?: string;
  onGenerate?: (concept: string) => void;
}

export function NextLessonCard({
  lesson,
  isGenerating = false,
  error,
  onRetry,
  suggestedConcept,
  onGenerate,
}: NextLessonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isGenerating) {
    return (
      <Card className="p-6 h-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
          <div>
            <h3 className="text-[17px] font-semibold">Writing your next lesson</h3>
            <p className="text-sm text-muted-foreground">
              Meta Muse is building it from the questions you missed (about 10 seconds)
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 h-full">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Couldn't generate the lesson</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
        )}
      </Card>
    );
  }

  if (!lesson) {
    return (
      <Card className="p-6 h-full">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-[17px] font-semibold">Next lesson</h3>
        </div>
        {suggestedConcept && onGenerate ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              No confirmed weak spot yet, but you dropped points on <span className="font-medium text-foreground">{suggestedConcept}</span>.
            </p>
            <Button size="sm" onClick={() => onGenerate(suggestedConcept)}>
              Get a lesson on {suggestedConcept}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing to fix from this quiz. Keep your review cards going to hold on to it.
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-hidden">
      <div className="p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] font-semibold leading-snug mb-1">{lesson.title}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {lesson.estimatedMinutes} min
              </span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {lesson.difficulty}
              </Badge>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-3">Why this lesson: {lesson.reason}</p>
        <p className="text-sm text-muted-foreground line-clamp-3">{lesson.explanation}</p>

        <Button onClick={() => setIsExpanded(!isExpanded)} className="mt-4 w-full" variant={isExpanded ? 'outline' : 'default'}>
          {isExpanded ? 'Hide lesson' : 'Start lesson'}
          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {isExpanded && (
        <div className="border-t p-6 bg-background space-y-6 animate-slideDown">
          <Section title="Explanation">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{lesson.explanation}</p>
          </Section>

          {lesson.memoryTricks.length > 0 && (
            <Section title="Memory tricks">
              <ul className="space-y-2">
                {lesson.memoryTricks.map((trick, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Lightbulb className="w-4 h-4 text-warning-ink shrink-0 mt-0.5" />
                    <span>{trick}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {lesson.examples.length > 0 && (
            <Section title="Examples">
              <div className="space-y-3">
                {lesson.examples.map((ex, i) => (
                  <div key={i} className="bg-card p-4 rounded-lg border">
                    <div className="font-medium text-sm mb-1">{ex.title}</div>
                    {ex.description && <p className="text-xs text-muted-foreground mb-2">{ex.description}</p>}
                    <p className="text-sm">{ex.explanation}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {lesson.keyTakeaways.length > 0 && (
            <Section title="Key takeaways">
              <ul className="space-y-2">
                {lesson.keyTakeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {lesson.practiceExercises.length > 0 && (
            <Section title={`Practice (${lesson.practiceExercises.length})`}>
              <div className="space-y-3">
                {lesson.practiceExercises.map((ex, i) => (
                  <Exercise key={i} index={i} exercise={ex} />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="eyebrow mb-2.5">{title}</h4>
      {children}
    </div>
  );
}

/** Try it yourself first: hint and answer are revealed on demand */
function Exercise({ index, exercise }: { index: number; exercise: PracticeExercise }) {
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="bg-card p-4 rounded-lg border">
      <p className="text-sm font-medium mb-3">
        {index + 1}. {exercise.question}
      </p>
      <div className="flex flex-wrap gap-2">
        {exercise.hint && !showHint && (
          <Button size="sm" variant="ghost" onClick={() => setShowHint(true)}>
            Show hint
          </Button>
        )}
        {!showAnswer && (
          <Button size="sm" variant="outline" onClick={() => setShowAnswer(true)}>
            Show answer
          </Button>
        )}
      </div>
      {showHint && <p className="text-xs text-muted-foreground mt-2">Hint: {exercise.hint}</p>}
      {showAnswer && (
        <div className="mt-2 text-sm">
          <span className="font-medium text-success">{exercise.answer}</span>
          {exercise.explanation && <p className="text-xs text-muted-foreground mt-1">{exercise.explanation}</p>}
        </div>
      )}
    </div>
  );
}
