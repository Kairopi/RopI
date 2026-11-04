/**
 * Quiz results - what happened, what it means, what to do next.
 *
 * One screen, three layers (no overload):
 *   1. The verdict: score, the one concept that tripped you up, ONE next step
 *   2. What this quiz showed: confidence before -> after and each concept's
 *      result, weak ones flagged with a practice link
 *   3. On demand: the lesson Meta Muse wrote, and your answers (missed first)
 * Behind it: skill update, weak spots, FSRS review cards and a History entry.
 */

import { useLoop } from '@/hooks/useLoop';
import { useWeek } from '@/hooks/useWeek';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertCircle, Loader2, Mic, RotateCcw, ArrowRight, ArrowLeft, ChevronDown } from '@/components/icons';
import { NextLessonCard } from '@/components/NextLessonCard';
import { Panel } from '@/components/Panel';
import type { QuizResultState } from '@/lib/learning/quiz-result';
import type { AdaptiveLesson } from '@/lib/learning/adaptive-lessons';
import { processQuizAttempt, lessonForAttempt, type ProcessedQuiz } from '@/lib/learning/process-quiz';
import { cn } from '@/lib/utils';

const formatTime = (seconds: number) => (seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`);
const tone = (pct: number) => (pct >= 85 ? 'success' : pct >= 70 ? 'primary' : pct >= 50 ? 'warning' : 'destructive');
const TEXT = { success: 'text-success', primary: 'text-primary', warning: 'text-warning-ink', destructive: 'text-destructive' } as const;
const FILL = { success: 'bg-success', primary: 'bg-primary', warning: 'bg-warning', destructive: 'bg-destructive' } as const;

export default function QuizResults() {
  const location = useLocation();
  const result = location.state as QuizResultState | null;
  if (!result?.answers?.length) return <NoResults />;
  return <Results result={result} />;
}

function NoResults() {
  const navigate = useNavigate();
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold">No quiz results to show</h1>
        <p className="mb-6 text-sm text-muted-foreground">Results appear here right after you finish a quiz.</p>
        <Button onClick={() => navigate('/learning')}>Take a quiz</Button>
      </div>
    </DashboardLayout>
  );
}

function Results({ result }: { result: QuizResultState }) {
  const navigate = useNavigate();
  const total = result.answers.length;
  const correct = result.answers.filter((a) => a.correct).length;
  const missed = total - correct;
  const score = Math.round((correct / total) * 100);

  const [processed, setProcessed] = useState<ProcessedQuiz | null>(null);
  const [lesson, setLesson] = useState<AdaptiveLesson | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);

  // The planned block for this quiz (e.g. "AWS Lambda quiz" tonight) is done now: take it off the week.
  // Local only, so it doesn't wait for the database; ticking twice is a no-op.
  useEffect(() => {
    useWeek.getState().completeByHref([`/quiz/${result.quizId}`, result.retakePath, `/voice-quiz?quiz=${result.quizId}`], result.timeElapsed / 60);
  }, [result.attemptId, result.quizId, result.retakePath, result.timeElapsed]);

  // Process the attempt exactly once (safe under StrictMode and page refresh)
  useEffect(() => {
    let active = true;
    processQuizAttempt(result).then((p) => {
      if (!active) return;
      setProcessed(p);
      useLoop.setState({ loadedFor: null }); // weak spots and new cards change the week
      if (p.skill?.updated.weakSpots.length) loadLesson(p, undefined, () => active);
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

  // Per-concept result for THIS quiz (works before the profile is saved, too)
  const concepts = useMemo(() => {
    const m = new Map<string, { correct: number; total: number }>();
    for (const a of result.answers) {
      const c = m.get(a.concept) ?? { correct: 0, total: 0 };
      c.total++;
      if (a.correct) c.correct++;
      m.set(a.concept, c);
    }
    return [...m.entries()].map(([concept, r]) => ({ concept, ...r })).sort((a, b) => a.correct / a.total - b.correct / b.total);
  }, [result.answers]);
  const weakest = concepts.find((c) => c.correct < c.total)?.concept;
  const weakSpots = new Set(skill?.updated.weakSpots ?? []);
  const practiceCandidate = skill && skill.updated.weakSpots.length === 0 ? weakest : undefined;

  const practicePath = (concept: string, voice = false) => {
    const base = result.sourceId ? `source=${result.sourceId}` : `topic=${encodeURIComponent(result.topic)}`;
    return voice ? `/voice-quiz?quiz=new&${base}&focus=${encodeURIComponent(concept)}` : `/quiz/new?${base}&focus=${encodeURIComponent(concept)}`;
  };

  const verdict =
    missed === 0 ? 'Every answer right.' : score >= 70 ? `Solid. ${weakest} tripped you up.` : score >= 50 ? `Halfway there. ${weakest} needs work.` : `${weakest} is the place to start.`;

  const cards = processed && !processed.cardsError ? processed.cardsCreated : 0;
  const before = skill?.previous?.confidence ?? null;
  const after = skill?.updated.confidence ?? null;
  const firstQuiz = (skill?.previous?.quizzesTaken ?? 0) === 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate('/learning')}
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Learn
        </button>

        {/* 1. The verdict and one next step */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}>
          <Card className="mb-5 p-6 sm:p-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <ScoreRing score={score} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                  <span className="truncate font-medium text-foreground/80">{result.quizTitle}</span>
                  <span>·</span>
                  <span className="tabular-nums">{formatTime(result.timeElapsed)}</span>
                  {result.mode === 'voice' && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Mic className="h-3 w-3" />
                        voice
                      </span>
                    </>
                  )}
                </div>
                <h1 className="mt-1.5 text-[26px] font-semibold leading-[1.15]">{verdict}</h1>
                <p className="mt-1.5 text-[14px] text-muted-foreground">
                  {correct} of {total} right
                  {cards > 0 && (
                    <>
                      {' · '}
                      {cards} cards added for review
                    </>
                  )}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {cards > 0 ? (
                    <Button onClick={() => navigate('/reviews', { state: { filter: 'new', topic: result.topic } })}>
                      Review {cards} now
                      <ArrowRight />
                    </Button>
                  ) : missed === 0 ? (
                    <Button onClick={() => navigate('/learning')}>
                      Pick the next quiz
                      <ArrowRight />
                    </Button>
                  ) : null}
                  {weakest && (
                    <Button variant="outline" onClick={() => navigate(practicePath(weakest))}>
                      Practice {weakest}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => navigate(result.retakePath || `/quiz/${result.quizId}`)}>
                    <RotateCcw />
                    Retake
                  </Button>
                </div>
              </div>
            </div>

            {!processed && (
              <p className="mt-5 flex items-center gap-2 border-t pt-4 text-[12.5px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Saving to your profile and making review cards
              </p>
            )}
            {processed?.skillError && (
              <p className="mt-5 flex items-start gap-2 border-t pt-4 text-[12.5px] text-destructive">
                <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                Your skill profile couldn’t be updated: {processed.skillError}
              </p>
            )}
            {processed?.cardsError && (
              <p className="mt-3 text-[12.5px] text-destructive">Review cards couldn’t be saved: {processed.cardsError}</p>
            )}
          </Card>
        </motion.div>

        {/* 2. What this quiz showed */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Card className="mb-5 p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15.5px] font-semibold">What this quiz showed</h2>
              {after !== null && (
                <span className="text-[12.5px] text-muted-foreground">
                  {result.topic} confidence{' '}
                  {firstQuiz || before === null ? (
                    <span className={cn('font-semibold tabular-nums', TEXT[tone(after)])}>{after}%</span>
                  ) : (
                    <>
                      <span className="tabular-nums">{before}%</span> → <span className={cn('font-semibold tabular-nums', TEXT[tone(after)])}>{after}%</span>
                      {after !== before && (
                        <span className={cn('ml-1.5 rounded-full px-1.5 py-px text-[11px] font-medium tabular-nums', after > before ? 'bg-success/10 text-success' : 'bg-warning/15 text-warning-ink')}>
                          {after > before ? '+' : ''}
                          {after - before}
                        </span>
                      )}
                    </>
                  )}
                </span>
              )}
            </div>
            <ul className="space-y-3.5">
              {concepts.map((c) => {
                const pct = Math.round((c.correct / c.total) * 100);
                const weak = weakSpots.has(c.concept);
                return (
                  <li key={c.concept}>
                    <div className="flex items-center gap-3 text-[13.5px]">
                      <span className="min-w-0 flex-1 truncate font-medium">{c.concept}</span>
                      {weak && <span className="rounded-full bg-destructive/10 px-2 py-px text-[11px] font-medium text-destructive">Weak spot</span>}
                      <span className="tabular-nums text-muted-foreground">
                        {c.correct}/{c.total}
                      </span>
                    </div>
                    <Bar pct={pct} />
                    {c.correct < c.total && (
                      <div className="mt-1.5 flex gap-3 text-[12px]">
                        <button onClick={() => navigate(practicePath(c.concept))} className="font-medium text-primary hover:underline">
                          Practice this
                        </button>
                        <button onClick={() => navigate(practicePath(c.concept, true))} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <Mic className="h-3 w-3" />
                          By voice
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </motion.div>

        {/* 3a. Lesson on the weak spot */}
        {skill && (lessonLoading || lesson || lessonError || practiceCandidate) && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-5">
            <NextLessonCard
              lesson={lesson}
              isGenerating={lessonLoading}
              error={lessonError}
              onRetry={() => processed && loadLesson(processed, lesson?.targetConcept)}
              suggestedConcept={practiceCandidate}
              onGenerate={(concept) => processed && loadLesson(processed, concept)}
            />
          </motion.div>
        )}

        {/* 3b. Answers, missed first */}
        <Answers result={result} />
      </div>
    </DashboardLayout>
  );
}

function Answers({ result }: { result: QuizResultState }) {
  const missed = result.answers.filter((a) => !a.correct);
  const [show, setShow] = useState<'missed' | 'all'>(missed.length ? 'missed' : 'all');
  const [open, setOpen] = useState<Set<string>>(() => new Set(missed.map((a) => a.questionId)));
  const list = (show === 'missed' ? missed : result.answers).map((a) => ({ a, n: result.answers.indexOf(a) + 1 }));

  return (
    <Panel
      id="quiz-answers"
      title="Your answers"
      meta={`${result.answers.length - missed.length} right · ${missed.length} missed`}
      summary="Open to see each question, the right answer and why"
      actions={
        missed.length > 0 ? (
          <div className="inline-flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Which answers">
            {(['missed', 'all'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={show === v}
                onClick={() => setShow(v)}
                className={cn(
                  'rounded-md px-2.5 py-0.5 text-[12px] font-medium transition-colors',
                  show === v ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(225_20%_8%/0.08)]' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {v === 'missed' ? `Missed ${missed.length}` : `All ${result.answers.length}`}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      <ol className="-mx-2 divide-y">
        {list.map(({ a, n }) => {
          const expanded = open.has(a.questionId);
          return (
            <li key={a.questionId}>
              <button
                onClick={() =>
                  setOpen((s) => {
                    const next = new Set(s);
                    if (next.has(a.questionId)) next.delete(a.questionId);
                    else next.add(a.questionId);
                    return next;
                  })
                }
                aria-expanded={expanded}
                className="flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left hover:bg-muted/40"
              >
                <span className="num mt-0.5 w-5 shrink-0 text-[11.5px] text-muted-foreground">{String(n).padStart(2, '0')}</span>
                {a.correct ? <CheckCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-success" /> : <XCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-destructive" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium leading-snug">{a.question}</span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">{a.concept}</span>
                </span>
                <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
              </button>
              {expanded && (
                <div className="space-y-2.5 pb-4 pl-[60px] pr-2">
                  {!a.correct && (
                    <div className="grid gap-1.5 text-[13px] sm:grid-cols-2">
                      <div className="rounded-lg bg-destructive/[0.06] px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">You chose</div>
                        <div className="text-destructive">{a.selectedIndex >= 0 ? a.options[a.selectedIndex] : 'No answer'}</div>
                      </div>
                      <div className="rounded-lg bg-success/[0.07] px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Right answer</div>
                        <div className="text-success">{a.options[a.correctAnswerIndex]}</div>
                      </div>
                    </div>
                  )}
                  {a.voiceInput && <p className="text-[12px] text-muted-foreground">Ropi heard: “{a.voiceInput}”</p>}
                  {a.explanation && <p className="text-[13px] leading-relaxed text-foreground/85">{a.explanation}</p>}
                  {a.source && (
                    <figure className="rounded-lg border-l-2 border-primary bg-accent/60 px-3 py-2">
                      <blockquote className="text-[12.5px] leading-relaxed text-foreground">"{a.source.quote}"</blockquote>
                      <figcaption className="mt-1 text-[11px] text-muted-foreground">
                        From your notes · {a.source.title}
                        {a.source.page ? `, page ${a.source.page}` : ''} · quote verified word for word
                      </figcaption>
                    </figure>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function Bar({ pct }: { pct: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <motion.div
        className={cn('h-full rounded-full', FILL[tone(pct)])}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(pct, 3)}%` }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 22, delay: 0.25 }}
      />
    </div>
  );
}

/** Score as a ring that fills on mount */
function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const stroke = { success: 'hsl(var(--success))', primary: 'hsl(var(--primary))', warning: 'hsl(var(--warning))', destructive: 'hsl(var(--destructive))' }[tone(score)];
  return (
    <div className="relative h-[120px] w-[120px] shrink-0">
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
        <span data-score className={`font-display text-[32px] font-semibold tabular-nums tracking-[-0.04em] ${TEXT[tone(score)]}`}>
          {score}%
        </span>
      </div>
    </div>
  );
}
