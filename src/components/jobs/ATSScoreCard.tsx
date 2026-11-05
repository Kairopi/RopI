/**
 * ATS Score Card Component
 * Pattern from Resume Matcher's ats-score-card.tsx
 */

import { useEffect, useState } from 'react';
import type { ATSScore } from '@/lib/jobs/ats-scorer';
import { cn } from '@/lib/utils';

interface ATSScoreCardProps {
  atsScore: ATSScore;
  previousScore?: number;
}

// Score bands (Resume Matcher pattern)
type Band = 'high' | 'mid' | 'low';
const band = (value: number): Band => (value >= 80 ? 'high' : value >= 60 ? 'mid' : 'low');

const BAND_TEXT: Record<Band, string> = {
  high: 'text-success',
  mid: 'text-warning-ink',
  low: 'text-destructive',
};

const BAND_FILL: Record<Band, string> = {
  high: 'bg-success',
  mid: 'bg-warning',
  low: 'bg-destructive',
};

const BAND_BG: Record<Band, string> = {
  high: 'bg-success/10',
  mid: 'bg-warning/10',
  low: 'bg-destructive/10',
};

const BAND_BORDER: Record<Band, string> = {
  high: 'border-success/25',
  mid: 'border-warning/25',
  low: 'border-destructive/25',
};

/**
 * Count-up animation for score changes
 */
function useCountUp(value: number, enabled: boolean): number {
  const [shown, setShown] = useState(value);
  
  useEffect(() => {
    if (!enabled) {
      setShown(value);
      return;
    }

    const startValue = shown;
    const diff = value - startValue;
    const duration = 800; // ms
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(startValue + diff * eased);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [value, enabled]);

  return shown;
}

/**
 * Score bar visualization
 */
function ScoreBar({ value }: { value: number }) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full transition-all duration-500', BAND_FILL[band(value)])}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}

/**
 * Sub-score row (Resume Matcher pattern)
 */
function SubScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12.5px] text-muted-foreground">{label}</span>
        <span className={cn('num text-[12.5px] font-semibold tabular-nums', BAND_TEXT[band(value)])}>{Math.round(value)}%</span>
      </div>
      <ScoreBar value={value} />
    </div>
  );
}

/**
 * Keyword list (missing or injectable)
 */
function KeywordList({
  title,
  keywords,
  tone,
}: {
  title: string;
  keywords: string[];
  tone: 'missing' | 'matched';
}) {
  if (keywords.length === 0) return null;

  return (
    <div>
      <p className="mb-2 eyebrow">
        {title}
      </p>
      <ul className="flex flex-wrap gap-2">
        {keywords.map((keyword, i) => (
          <li
            key={`${tone}-${i}-${keyword}`}
            className={cn(
              'rounded-md border px-2 py-0.5 text-[12px]',
              tone === 'missing'
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-success/40 bg-success/10 text-success'
            )}
          >
            {keyword}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Main ATS Score Card
 */
export function ATSScoreCard({ atsScore, previousScore }: ATSScoreCardProps) {
  const { overall_score, sub_scores, evidence } = atsScore;
  const shownScore = useCountUp(overall_score, previousScore != null);
  const currentBand = band(overall_score);

  return (
    <section className={cn('space-y-5 rounded-xl border bg-card p-5')}>
      {/* Header with score */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="mb-0.5 text-[15px] font-semibold">Resume fit</h3>
          <p className="text-[12.5px] text-muted-foreground">How your resume matches this job.</p>
        </div>
        <div className="flex items-end gap-1">
          {previousScore != null && previousScore !== overall_score && (
            <span className="mb-1 mr-2 font-mono text-sm tabular-nums text-muted-foreground line-through">
              {previousScore.toFixed(1)}
            </span>
          )}
          <span
            className={cn(
              'font-display text-4xl font-semibold tabular-nums tracking-[-0.035em]',
              BAND_TEXT[currentBand]
            )}
          >
            {Math.round(shownScore)}
          </span>
          <span className="mb-1 text-[13px] text-muted-foreground">/100</span>
        </div>
      </div>

      {/* Overall score bar */}
      <ScoreBar value={overall_score} />

      {/* Sub-scores (Resume Matcher components) */}
      <div className="space-y-3">
        <SubScoreRow label="Words from the job description" value={sub_scores.keyword_match} />
        <SubScoreRow label="Named skills and tools" value={sub_scores.skills_coverage} />
        <SubScoreRow label="Job title" value={sub_scores.title_match} />
        <SubScoreRow label="Resume sections" value={sub_scores.section_completeness} />
        <SubScoreRow label="Gaps between jobs" value={sub_scores.date_consistency} />
      </div>

      {/* Keyword lists */}
      <KeywordList title="Missing from your resume" keywords={evidence.missing_keywords} tone="missing" />
      <KeywordList title="Already in your resume" keywords={evidence.matched_keywords} tone="matched" />

      {/* Recommendations */}
      {evidence.recommendations.length > 0 && (
        <div>
          <p className="mb-2 eyebrow">
            Recommendations
          </p>
          <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground marker:text-primary">
            {evidence.recommendations.map((rec, i) => (
              <li key={`rec-${i}`}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
