/**
 * Daily Reviews Page - Production Grade
 * 
 * FSRS-powered spaced repetition review system
 * Reference: LEARNINGS_FROM_4_LEARNING_SYSTEMS.md - ts-fsrs pattern
 * 
 * Production improvements (Nov 1, 2026):
 * - Server-side due card queries
 * - Review log persistence
 * - Complete workflow with database updates
 * - Support for filtered views (new cards, by topic)
 */

import { useLoop } from '@/hooks/useLoop';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ThumbsUp, 
  ThumbsDown,
  Smile,
  Frown,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  Loader2
} from '@/components/icons';
import { 
  Rating, 
  reviewCardComplete, 
  getDueCardsFromDatabase,
  getCardsByState,
  getCardsByTopic,
  getCardState,
  getStateLabel,
  getStateColor,
  previewRatings,
  calculateRetrievability,
  formatInterval,
  type ConceptCard 
} from '@/lib/learning/spaced-repetition';
import { supabase } from '@/lib/supabase';
import { recordReceipt } from '@/lib/receipts';

export default function DailyReviews() {
  const location = useLocation();
  const navigate = useNavigate();
  const { filter, topic } = location.state || {};
  
  const [dueCards, setDueCards] = useState<ConceptCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewedToday, setReviewedToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewStartTime, setReviewStartTime] = useState<Date | null>(null);
  const [sessionStats, setSessionStats] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  
  // Load due cards on mount. The cancel flag stops a stale load (React StrictMode
  // runs effects twice in development) from flipping the page back to "Loading".
  useEffect(() => {
    let cancelled = false;
    loadCards(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [filter, topic]);
  
  const loadCards = async (isCancelled: () => boolean = () => false) => {
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user logged in');
        setDueCards([]);
        setIsLoading(false);
        return;
      }
      
      let cards: ConceptCard[] = [];
      
      // Handle filtered views from QuizResults
      if (filter === 'new' && topic) {
        // Get new cards from specific topic
        const allTopicCards = await getCardsByTopic(user.id, topic);
        cards = allTopicCards.filter(c => getCardState(c.fsrsCard) === 'new');
      } else if (filter === 'new') {
        // Get all new cards
        cards = await getCardsByState(user.id, 'new', 20);
      } else if (topic) {
        // Get due cards from specific topic
        const allTopicCards = await getCardsByTopic(user.id, topic);
        cards = allTopicCards.filter(c => c.nextReviewDue <= new Date());
      } else {
        // Default: Get all due cards
        cards = await getDueCardsFromDatabase(user.id, 20);
      }
      
      if (isCancelled()) return;
      setDueCards(cards);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load cards:', error);
      if (!isCancelled()) setIsLoading(false);
    }
  };
  
  const currentCard = dueCards[currentIndex];

  // FSRS preview: when each rating would bring this card back, and how likely you are to remember it now
  const [intervals, setIntervals] = useState<Record<'again' | 'hard' | 'good' | 'easy', string> | null>(null);
  const [memory, setMemory] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setIntervals(null);
    setMemory(null);
    if (!currentCard) return;
    const now = new Date();
    previewRatings(currentCard, now)
      .then((p) => {
        if (cancelled) return;
        setIntervals({
          again: formatInterval(p.again.nextReview, now),
          hard: formatInterval(p.hard.nextReview, now),
          good: formatInterval(p.good.nextReview, now),
          easy: formatInterval(p.easy.nextReview, now),
        });
      })
      .catch(() => undefined);
    calculateRetrievability(currentCard, now)
      .then((r) => !cancelled && setMemory(getCardState(currentCard.fsrsCard) === 'new' ? null : r))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentCard]);
  const hasMore = currentIndex < dueCards.length - 1;
  
  const handleReveal = () => {
    setShowAnswer(true);
    setReviewStartTime(new Date()); // Track time spent reviewing
  };
  
  const handleRating = async (rating: Rating) => {
    if (!currentCard || isReviewing) return;
    
    setIsReviewing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No user logged in');
        setIsReviewing(false);
        return;
      }
      
      // Calculate time spent on this card
      const timeSpentSeconds = reviewStartTime 
        ? Math.round((new Date().getTime() - reviewStartTime.getTime()) / 1000)
        : undefined;
      
      // Complete review workflow: Review + Update DB + Save session
      const result = await reviewCardComplete(
        currentCard, 
        rating, 
        user.id,
        timeSpentSeconds
      );
      
      // Update stats
      const newStats = { ...sessionStats };
      switch (rating) {
        case Rating.Again:
          newStats.again++;
          break;
        case Rating.Hard:
          newStats.hard++;
          break;
        case Rating.Good:
          newStats.good++;
          break;
        case Rating.Easy:
          newStats.easy++;
          break;
      }
      setSessionStats(newStats);
      
      console.log('✅ Review completed:', {
        card: currentCard.question.substring(0, 50) + '...',
        rating: ['Manual', 'Again', 'Hard', 'Good', 'Easy'][rating],
        nextReview: result.nextReviewDate,
        intervalDays: result.intervalDays,
        confidence: result.confidence + '%',
        stateBefore: getCardState(currentCard.fsrsCard),
        stateAfter: getCardState(result.updatedCard.fsrsCard!),
        timeSpent: timeSpentSeconds + 's',
      });
      
      // Move to next card
      setReviewedToday(prev => prev + 1);
      useLoop.setState({ loadedFor: null }); // fewer due cards = shorter review block
      
      if (hasMore) {
        setCurrentIndex(prev => prev + 1);
        setShowAnswer(false);
        setReviewStartTime(null);
      } else {
        // All done!
        const total = reviewedToday + 1;
        void recordReceipt({
          domain: 'study',
          kind: 'study.cards_reviewed',
          actor: 'user',
          verification: 'system_recorded',
          title: `Reviewed ${total} card${total === 1 ? '' : 's'}`,
          detail: `Again ${newStats.again} · Hard ${newStats.hard} · Good ${newStats.good} · Easy ${newStats.easy}`,
          evidence: { count: total, ratings: newStats, scheduler: 'FSRS-7 (ts-fsrs 6.0.0)' },
        });
        setDueCards([]);
      }
    } catch (error) {
      console.error('Failed to review card:', error);
      // TODO: Show error toast in production
    } finally {
      setIsReviewing(false);
    }
  };
  
  const formatNextReview = (intervalDays: number): string => {
    if (intervalDays === 0) return 'Later today';
    if (intervalDays === 1) return 'Tomorrow';
    if (intervalDays < 7) return `In ${intervalDays} days`;
    if (intervalDays < 30) return `In ${Math.round(intervalDays / 7)} weeks`;
    return `In ${Math.round(intervalDays / 30)} months`;
  };
  
  // Keyboard: Space reveals, 1-4 rates
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!currentCard || isLoading) return;
      if (!showAnswer && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        handleReveal();
      } else if (showAnswer && ['1', '2', '3', '4'].includes(e.key)) {
        handleRating(Number(e.key) as Rating);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <h2 className="text-[17px] font-semibold">Loading your review cards</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Finding what’s due</p>
        </div>
      </DashboardLayout>
    );
  }

  if (dueCards.length === 0) {
    const total = sessionStats.again + sessionStats.hard + sessionStats.good + sessionStats.easy;
    return (
      <DashboardLayout>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl py-12 text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
            <CheckCircle className="h-7 w-7 text-success" />
          </span>
          <h1 className="text-[28px] font-semibold">{reviewedToday > 0 ? 'All reviews complete' : 'Nothing due right now'}</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {reviewedToday > 0
              ? `You reviewed ${reviewedToday} concept${reviewedToday !== 1 ? 's' : ''} this session. Each one is scheduled to come back right before you would forget it.`
              : 'Take a quiz. Every question you miss becomes a review card here.'}
          </p>

          {reviewedToday > 0 && (
            <Card className="mt-8 overflow-hidden text-left">
              <div className="flex h-1.5">
                {RATINGS.map((r) => (
                  <div key={r.key} className={r.bar} style={{ width: `${total ? (sessionStats[r.key] / total) * 100 : 0}%` }} />
                ))}
              </div>
              <div className="grid grid-cols-4 divide-x">
                {RATINGS.map((r) => (
                  <div key={r.key} className="p-4">
                    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <span className={`h-2 w-2 rounded-full ${r.bar}`} />
                      {r.label}
                    </div>
                    <div className="mt-1 font-display text-[24px] font-semibold tabular-nums">{sessionStats[r.key]}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button className="mt-8" onClick={() => navigate('/learning')}>
            Back to Learning
          </Button>
        </motion.div>
      </DashboardLayout>
    );
  }

  const done = reviewedToday;
  const sessionTotal = dueCards.length + reviewedToday;
  const state = getCardState(currentCard.fsrsCard);
  const stateTone = getStateColor(state);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Daily reviews</div>
            <h1 className="text-[26px] font-semibold leading-tight">
              Card <span className="num">{done + 1}</span>
              <span className="text-muted-foreground"> of {sessionTotal}</span>
            </h1>
          </div>
          <span className="num text-[12px] text-muted-foreground">{done} done</span>
        </div>
        <div className="mb-6 h-1 overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${(done / sessionTotal) * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard.id}
            initial={{ opacity: 0, y: 10, rotateX: -4 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          >
            <Card className="overflow-hidden">
              <div className="p-6 sm:p-8">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <Badge variant="default">{currentCard.topic}</Badge>
                  {currentCard.subtopic && <Badge variant="outline">{currentCard.subtopic}</Badge>}
                  <Badge
                    variant={stateTone === 'yellow' ? 'warning' : stateTone === 'red' ? 'destructive' : stateTone === 'green' ? 'success' : 'secondary'}
                    className="ml-auto"
                  >
                    {getStateLabel(state)}
                  </Badge>
                  {memory !== null && (
                    <span
                      className="num rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                      title="How likely you are to remember this right now"
                    >
                      {memory}% recall
                    </span>
                  )}
                </div>
                <h2 className="text-[21px] font-semibold leading-snug tracking-[-0.015em]">{currentCard.question}</h2>
              </div>

              <AnimatePresence initial={false}>
                {showAnswer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-dashed bg-background px-6 py-5 sm:px-8">
                      <div className="eyebrow mb-2 flex items-center gap-1.5 !text-success">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Answer
                      </div>
                      <div className="whitespace-pre-wrap text-[14px] leading-relaxed">{currentCard.answer}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="border-t p-4 sm:p-5">
                {!showAnswer ? (
                  <Button onClick={handleReveal} className="w-full" size="lg">
                    Show Answer
                    <kbd aria-hidden="true" className="num ml-1 rounded border border-primary-foreground/30 px-1.5 text-[10.5px] font-normal opacity-80">Space</kbd>
                  </Button>
                ) : (
                  <div>
                    <div className="mb-3 text-center text-[12.5px] text-muted-foreground">How well did you know it?</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {RATINGS.map((r, i) => (
                        <button
                          key={r.key}
                          onClick={() => handleRating(r.rating)}
                          disabled={isReviewing}
                          className={`group flex flex-col items-start rounded-xl border bg-card px-3.5 py-3 text-left transition-colors disabled:opacity-50 ${r.hover}`}
                        >
                          <span className="flex w-full items-center justify-between">
                            <span className="text-[14px] font-semibold">{r.label}</span>
                            <kbd aria-hidden="true" className="num rounded border px-1 text-[10.5px] text-muted-foreground">{i + 1}</kbd>
                          </span>
                          <span className="mt-0.5 text-[12px] text-muted-foreground">{r.hint}</span>
                          <span className="mt-2.5 flex w-full items-center gap-2">
                            <span className={`h-1 w-6 rounded-full ${r.bar}`} />
                            {intervals && (
                              <span className="num ml-auto text-[11px] text-muted-foreground" title="When this card comes back">
                                back in {intervals[r.key]}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Card facts */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span className="num">{currentCard.reviewCount}</span> past reviews
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="num">{Math.round((Date.now() - currentCard.createdAt.getTime()) / (1000 * 60 * 60 * 24))}</span> days old
          </span>
          <span>Your rating decides when it comes back</span>
        </div>
      </div>
    </DashboardLayout>
  );
}

const RATINGS = [
  { key: 'again', label: 'Again', hint: 'Forgot it', rating: Rating.Again, bar: 'bg-destructive', hover: 'hover:border-destructive/40 hover:bg-destructive/[0.04]' },
  { key: 'hard', label: 'Hard', hint: 'Got there slowly', rating: Rating.Hard, bar: 'bg-warning', hover: 'hover:border-warning/50 hover:bg-warning/[0.06]' },
  { key: 'good', label: 'Good', hint: 'Knew it', rating: Rating.Good, bar: 'bg-success', hover: 'hover:border-success/40 hover:bg-success/[0.05]' },
  { key: 'easy', label: 'Easy', hint: 'Instantly', rating: Rating.Easy, bar: 'bg-primary', hover: 'hover:border-primary/40 hover:bg-accent' },
] as const;