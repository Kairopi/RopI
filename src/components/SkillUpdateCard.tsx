/**
 * SkillUpdateCard - animated confidence change plus the evidence behind it
 *
 * Shows before -> after confidence, and for every concept in this quiz how
 * its accuracy moved (e.g. "Lambda cold starts  0% -> 50%  (1/2 this quiz)").
 */

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from '@/components/icons';
import { Card } from '@/components/ui/card';
import type { ConceptChange, SkillLevel } from '@/lib/learning/skill-tracker';
import { RECENT_WEIGHT, HISTORY_WEIGHT } from '@/lib/learning/skill-tracker';

interface SkillUpdateCardProps {
  previousSkill: SkillLevel | null;
  currentSkill: SkillLevel;
  changes?: ConceptChange[];
  animationDuration?: number; // ms
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SkillUpdateCard({
  previousSkill,
  currentSkill,
  changes = [],
  animationDuration = 1500,
}: SkillUpdateCardProps) {
  const previousConfidence = previousSkill?.confidence ?? 0;
  const currentConfidence = currentSkill.confidence;
  const isFirstQuiz = (previousSkill?.quizzesTaken ?? 0) === 0;
  const change = currentConfidence - previousConfidence;

  const [animated, setAnimated] = useState(previousConfidence);

  // Ease-out cubic count-up (respects reduced-motion)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimated(currentConfidence);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / animationDuration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(Math.round(previousConfidence + (currentConfidence - previousConfidence) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [previousConfidence, currentConfidence, animationDuration]);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-[17px] font-semibold">{currentSkill.topic} confidence</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isFirstQuiz
              ? 'First quiz on this topic: confidence = this score'
              : `${Math.round(RECENT_WEIGHT * 100)}% this quiz + ${Math.round(HISTORY_WEIGHT * 100)}% your previous confidence`}
          </p>
        </div>
        {!isFirstQuiz && change !== 0 && (
          <span
            className={`num text-[12px] font-medium px-2.5 py-1 rounded-full ${
              change > 0 ? 'bg-success/10 text-success' : 'bg-warning/15 text-warning-ink'
            }`}
          >
            {change > 0 ? '+' : ''}
            {change} pts
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-8 mb-6">
        <Ring value={previousConfidence} color="hsl(var(--muted-foreground))" label={isFirstQuiz ? 'Start' : 'Before'} muted />
        <ArrowRight className="w-6 h-6 text-muted-foreground" />
        <Ring value={animated} color={confidenceColor(currentConfidence)} label="Now" />
      </div>

      {/* Evidence: per-concept movement */}
      {changes.length > 0 && (
        <div className="border-t pt-4 mb-4">
          <div className="eyebrow mb-3">What this quiz showed</div>
          <div className="space-y-2">
            {changes.map((c) => (
              <div key={c.concept} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
                <span className="truncate">{c.concept}</span>
                {/* Same "shift" motion as the week view: the bar slides from old accuracy to new */}
                <ShiftBar before={c.before ?? 0} after={c.after} className="col-span-2 order-last" />
                <span className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span className="text-xs text-muted-foreground">
                    {c.thisQuiz.correct}/{c.thisQuiz.total} this quiz
                  </span>
                  <span className="text-muted-foreground">{c.before === null ? 'new' : `${Math.round(c.before)}%`}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="font-medium" style={{ color: confidenceColor(c.after) }}>
                    {Math.round(c.after)}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        <Fact value={currentSkill.quizzesTaken} label="Quizzes" />
        <Fact value={`${currentSkill.accuracy.toFixed(0)}%`} label="All-time accuracy" />
        <Fact value={`${currentSkill.correctAnswers}/${currentSkill.totalAnswers}`} label="Correct" />
      </div>
    </Card>
  );
}

function Ring({ value, color, label, muted = false }: { value: number; color: string; label: string; muted?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="48" r={RADIUS} stroke="hsl(var(--border))" strokeWidth="8" fill="none" />
          <circle
            cx="48"
            cy="48"
            r={RADIUS}
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, value)) / 100)}
            strokeLinecap="round"
            opacity={muted ? 0.5 : 1}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-display text-[22px] font-semibold tracking-[-0.03em] tabular-nums ${muted ? 'text-muted-foreground' : ''}`}>{value}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground mt-2">{label}</span>
    </div>
  );
}

/** Accuracy bar that slides from the old value to the new one, with a ghost tick at the old value */
function ShiftBar({ before, after, className = '' }: { before: number; after: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={`relative h-1.5 rounded-full bg-border overflow-visible ${className}`} aria-hidden="true">
      {before > 0 && before !== after && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-muted-foreground/50"
          style={{ left: `calc(${before}% - 1px)` }}
        />
      )}
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: confidenceColor(after) }}
        initial={{ width: `${before}%` }}
        animate={{ width: `${Math.max(after, 2)}%` }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 22, delay: 0.4 }}
      />
    </div>
  );
}

function Fact({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-[22px] font-semibold tracking-[-0.02em] tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function confidenceColor(confidence: number): string {
  if (confidence >= 85) return 'hsl(var(--success))';
  if (confidence >= 70) return 'hsl(var(--primary))';
  if (confidence >= 50) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}
