/**
 * Quiz Results Page - the learning feedback loop
 *
 * One quiz attempt (text or voice) ->
 *   skill update with per-concept evidence -> weak spots -> targeted lesson
 *   + FSRS review cards for every missed question + quiz history row.
 */

import { useLoop } from '@/hooks/useLoop';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  Brain,
  AlertCircle,
  Loader2,
  Mic,
  RotateCcw,
} from '@/components/icons';
import { SkillUpdateCard } from '@/components/SkillUpdateCard';
import { WeakSpotsCard } from '@/components/WeakSpotsCard';
import { NextLessonCard } from '@/components/NextLessonCard';
import type { QuizResultState } from '@/lib/learning/quiz-result';
import type { AdaptiveLesson } from '@/lib/learning/adaptive-lessons';
import { processQuizAttempt, lessonForAttempt, type ProcessedQuiz } from '@/lib/learning/process-quiz';

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

const scoreColor = (score: number) =>
  score >= 85 ? 'text-success' : score >= 70 ? 'text-primary' : score >= 50 ? 'text-warning-ink' : 'text-destructive';

const scoreLabel = (score: number) =>
  score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs work';

export default function QuizResults() {
  const location = useLocation();
  const result = location.state as QuizResultState | null;

  if (!result?.answers?.length) {
    return <NoResults />;
  }
  return <Results result={result} />;
}

function NoResults() {
  const navigate = useNavigate();
  return (
    <DashboardLayout>
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-xl font-semibold mb-2">No quiz results to show</h1>
        <p className="text-sm text-muted-foreground mb-6">Results appear here right after you finish a quiz.</p>
        <Button onClick={() => navigate('/learning')}>Take a quiz</Button>
      </div>
    </DashboardLayout>
  );
}

function Results({ result }: { result: QuizResultState }) {
  const navigate = useNavigate();

  const total = result.answers.length;
  const correct = result.answers.filter((a) => a.correct).length;
  const wrongCount = total - correct;
  const score = Math.round((correct / total) * 100);

  const [processed, setProcessed] = useState<ProcessedQuiz | null>(null);
  const [lesson, setLesson] = useState<AdaptiveLesson | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);

  // Process the attempt exactly once (safe under StrictMode and page refresh)
  useEffect(() => {
    let active = true;
    processQuizAttempt(result).then((p) => {
      if (!active) return;
      setProcessed(p);
      useLoop.setState({ loadedFor: null }); // weak spots and new cards change the week
      if (p.skill?.updated.weakSpots.length) {
        loadLesson(p, undefined, () => active);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.attemptId]);

  function loadLesson(p: ProcessedQuiz, concept?: string, isActive: () => boolean = () => true) {
    if (!p.skill) return;
    setLessonLoading(true);
    setLessonError(null);
    lessonForAttempt(result, p.skill, concept)
      .then((l) => isActive() && setLesson(l))
      .catch((e) => isActive() && setLessonError(e instanceof Error ? e.message : 'Lesson generation failed'))
      .finally(() => isActive() && setLessonLoading(false));
  }

  const skill = processed?.skill ?? null;
  // Lowest-scoring concept from this quiz, offered when there is no confirmed weak spot
  const practiceCandidate =
    skill && skill.updated.weakSpots.length === 0
      ? [...skill.changes]
          .filter((c) => c.thisQuiz.correct < c.thisQuiz.total)
          .sort((a, b) => a.thisQuiz.correct / a.thisQuiz.total - b.thisQuiz.correct / b.thisQuiz.total)[0]?.concept
      : undefined;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl">
      {/* Score hero: ring + verdict + the three numbers */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}>
        <Card className="mb-6 flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <ScoreRing score={score} />
          <div className="min-w-0 flex-1">
            <div className="eyebrow mb-2 flex items-center gap-2">
              Quiz complete
              {result.mode === 'voice' && (
                <Badge variant="outline" className="gap-1 normal-case tracking-normal">
                  <Mic className="h-3 w-3" />
                  Voice
                </Badge>
              )}
            </div>
            <h1 className="text-[28px] font-semibold leading-tight">{scoreLabel(score)}</h1>
            <p className="mt-1 truncate text-[14px] text-muted-foreground">{result.quizTitle}</p>
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              <Stat icon={<CheckCircle className="h-4 w-4 text-success" />} value={correct} label="Correct" />
              <Stat icon={<XCircle className="h-4 w-4 text-destructive" />} value={wrongCount} label="Missed" />
              <Stat icon={<Clock className="h-4 w-4 text-muted-foreground" />} value={formatTime(result.timeElapsed)} label="Time" />
            </dl>
          </div>
        </Card>
      </motion.div>
      {/* Saving / errors */}
      {!processed && (
        <Card className="p-4 mb-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Updating your skill profile...
        </Card>
      )}
      {processed?.skillError && (
        <Card className="p-4 mb-6 border-destructive/30 bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-destructive">Your skill profile could not be updated</div>
            <div className="text-muted-foreground mt-1">{processed.skillError}</div>
          </div>
        </Card>
      )}

      {/* Feedback loop */}
      {skill && (
        <>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-6">
            <SkillUpdateCard previousSkill={skill.previous} currentSkill={skill.updated} changes={skill.changes} />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              <WeakSpotsCard
                weakSpots={skill.updated.weakSpots}
                conceptStats={skill.concepts}
                onPractice={(concept) =>
                  navigate(
                    result.sourceId
                      ? `/quiz/new?source=${result.sourceId}&focus=${encodeURIComponent(concept)}`
                      : `/quiz/new?topic=${encodeURIComponent(result.topic)}&focus=${encodeURIComponent(concept)}`
                  )
                }
                onPracticeVoice={(concept) =>
                  navigate(
                    result.sourceId
                      ? `/voice-quiz?quiz=new&source=${result.sourceId}&focus=${encodeURIComponent(concept)}`
                      : `/voice-quiz?quiz=new&topic=${encodeURIComponent(result.topic)}&focus=${encodeURIComponent(concept)}`
                  )
                }
              />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              <NextLessonCard
                lesson={lesson}
                isGenerating={lessonLoading}
                error={lessonError}
                onRetry={() => processed && loadLesson(processed, lesson?.targetConcept)}
                suggestedConcept={practiceCandidate}
                onGenerate={(concept) => processed && loadLesson(processed, concept)}
              />
            </motion.div>
          </div>
        </>
      )}

      {/* FSRS review cards */}
      {processed && wrongCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="mb-6 flex flex-wrap items-center gap-4 border-primary/25 bg-accent p-5 sm:p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <RotateCcw className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold">Review cards</h3>
              {processed.cardsError ? (
                <p className="text-[13px] text-destructive">Review cards could not be saved: {processed.cardsError}</p>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  {processed.cardsCreated} card{processed.cardsCreated !== 1 ? 's' : ''} added. First review: now. After that FSRS
                  brings each one back right before you would forget it.
                </p>
              )}
            </div>
            {!processed.cardsError && (
              <Button onClick={() => navigate('/reviews', { state: { filter: 'new', topic: result.topic } })}>
                <Brain />
                Review {processed.cardsCreated} now
              </Button>
            )}
          </Card>
        </motion.div>
      )}

      {/* Answer review */}
      <Card className="mb-8 overflow-hidden">
        <div className="border-b px-6 py-4">
          <h3 className="text-[15px] font-semibold">Your answers</h3>
        </div>
        <ol className="divide-y">
          {result.answers.map((a, i) => (
            <li key={a.questionId} className="flex items-start gap-4 px-6 py-4">
              <span className="num mt-0.5 w-6 shrink-0 text-[12px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-medium leading-snug">{a.question}</p>
                  {a.correct ? (
                    <CheckCircle className="h-5 w-5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                  )}
                </div>
                <Badge variant="outline" className="mt-1.5">{a.concept}</Badge>
                {!a.correct && (
                  <div className="mt-2.5 grid gap-1 text-[12.5px] sm:grid-cols-2">
                    <div className="rounded-md bg-destructive/[0.06] px-2.5 py-1.5">
                      <span className="text-muted-foreground">You chose </span>
                      <span className="text-destructive">{a.selectedIndex >= 0 ? a.options[a.selectedIndex] : 'No answer'}</span>
                    </div>
                    <div className="rounded-md bg-success/[0.07] px-2.5 py-1.5">
                      <span className="text-muted-foreground">Correct </span>
                      <span className="text-success">{a.options[a.correctAnswerIndex]}</span>
                    </div>
                  </div>
                )}
                {a.voiceInput && <p className="mt-1.5 text-[12px] text-muted-foreground">Heard: "{a.voiceInput}"</p>}
                {a.explanation && <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{a.explanation}</p>}
                {a.source && (
                  <figure className="mt-2.5 rounded-lg border-l-2 border-primary bg-accent/60 px-3 py-2">
                    <blockquote className="text-[12.5px] leading-relaxed text-foreground">"{a.source.quote}"</blockquote>
                    <figcaption className="mt-1 text-[11px] text-muted-foreground">
                      From your notes · {a.source.title}
                      {a.source.page ? `, page ${a.source.page}` : ''} · quote verified word for word
                    </figcaption>
                  </figure>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Card>
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" onClick={() => navigate('/learning')}>
          Back to Learning
        </Button>
        <Button variant="outline" onClick={() => navigate(result.retakePath || `/quiz/${result.quizId}`)}>
          <RotateCcw className="w-4 h-4" />
          Retake quiz
        </Button>
      </div>
      </div>
    </DashboardLayout>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-[22px] font-semibold tabular-nums tracking-[-0.02em]">{value}</dd>
    </div>
  );
}

/** Score as a ring that fills on mount */
function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const stroke = score >= 85 ? 'hsl(var(--success))' : score >= 70 ? 'hsl(var(--primary))' : score >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';
  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="9" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 0.9, ease: [0.2, 0, 0, 1], delay: 0.1 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span data-score className={`font-display text-[34px] font-semibold tabular-nums tracking-[-0.04em] ${scoreColor(score)}`}>
          {score}%
        </span>
      </div>
    </div>
  );
}