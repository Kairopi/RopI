/**
 * WeakSpotsCard - confirmed weak spots with the numbers behind them
 *
 * A weak spot = under 50% accuracy across at least 2 questions.
 */

import { AlertTriangle, CheckCircle, Target, Mic } from '@/components/icons';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ConceptStats } from '@/lib/learning/skill-tracker';
import { WEAK_SPOT_MAX_ACCURACY, WEAK_SPOT_MIN_ATTEMPTS } from '@/lib/learning/skill-tracker';

interface WeakSpotsCardProps {
  weakSpots: string[];
  conceptStats?: ConceptStats[];
  onPractice?: (concept: string) => void;
  /** Same practice quiz, taken hands-free */
  onPracticeVoice?: (concept: string) => void;
}

export function WeakSpotsCard({ weakSpots, conceptStats = [], onPractice, onPracticeVoice }: WeakSpotsCardProps) {
  if (weakSpots.length === 0) {
    return (
      <Card className="p-6 h-full">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
          <h3 className="text-[17px] font-semibold">No weak spots</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          A concept becomes a weak spot when you score under {WEAK_SPOT_MAX_ACCURACY}% across at least{' '}
          {WEAK_SPOT_MIN_ATTEMPTS} questions. None of your concepts are there right now.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 h-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-warning/15 rounded-xl flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-warning-ink" />
        </div>
        <div>
          <h3 className="text-[17px] font-semibold">Weak spots</h3>
          <p className="text-sm text-muted-foreground">
            {weakSpots.length} concept{weakSpots.length === 1 ? '' : 's'} under {WEAK_SPOT_MAX_ACCURACY}%
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {weakSpots.map((concept) => {
          const stats = conceptStats.find((c) => c.concept === concept);
          const accuracy = stats?.accuracy ?? 0;

          return (
            <div key={concept} className="flex items-center justify-between gap-3 p-4 rounded-xl border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium truncate">{concept}</span>
                  <span className="num text-[11px] px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive">
                    {Math.round(accuracy)}%
                  </span>
                </div>
                <div className="w-full bg-border rounded-full h-1.5 mb-2" aria-hidden="true">
                  <div
                    className="h-1.5 rounded-full bg-destructive transition-all duration-500"
                    style={{ width: `${Math.max(accuracy, 4)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {stats ? `${stats.correct} of ${stats.attempts} correct` : 'Not enough data'}
                </div>
              </div>

              {onPractice && (
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => onPractice(concept)}>
                    <Target className="w-4 h-4" />
                    Practice
                  </Button>
                  {onPracticeVoice && (
                    <Button size="sm" variant="ghost" onClick={() => onPracticeVoice(concept)}>
                      <Mic className="w-4 h-4" />
                      By voice
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onPractice && (
        <p className="text-xs text-muted-foreground mt-4">
          Practice writes a new 6-question quiz on just that concept.
        </p>
      )}
    </Card>
  );
}
