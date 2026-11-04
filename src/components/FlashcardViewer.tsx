/**
 * Flashcard viewer: flip a card, then say how well you knew it.
 * The rating schedules the card (onRate). Keyboard: Space flips, 1-4 rate,
 * arrows move between cards.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, RotateCw, Shuffle, Loader2 } from '@/components/icons';
import type { FlashcardDB } from '@/lib/learning/study-materials-db';

interface FlashcardViewerProps {
  flashcards: FlashcardDB[];
  onComplete?: () => void;
  /** 0 = Again, 1 = Hard, 2 = Good, 3 = Easy */
  onRate?: (flashcardId: string, rating: 0 | 1 | 2 | 3) => Promise<void>;
}

const RATINGS = [
  { label: 'Again', hint: 'Forgot it', tone: 'hover:border-destructive/40 hover:bg-destructive/[0.04]', bar: 'bg-destructive' },
  { label: 'Hard', hint: 'Got there slowly', tone: 'hover:border-warning/50 hover:bg-warning/[0.06]', bar: 'bg-warning' },
  { label: 'Good', hint: 'Knew it', tone: 'hover:border-success/40 hover:bg-success/[0.05]', bar: 'bg-success' },
  { label: 'Easy', hint: 'Instantly', tone: 'hover:border-primary/40 hover:bg-accent', bar: 'bg-primary' },
] as const;

export function FlashcardViewer({ flashcards, onComplete, onRate }: FlashcardViewerProps) {
  const [order, setOrder] = useState<number[]>(() => flashcards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [rated, setRated] = useState<Map<string, number>>(new Map());
  const [isRating, setIsRating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrder(flashcards.map((_, i) => i));
    setPos(0);
  }, [flashcards]);

  const currentCard = flashcards[order[pos] ?? 0];
  const ratedCount = rated.size;
  const currentRating = currentCard ? rated.get(currentCard.id) : undefined;
  const firstUnrated = useMemo(() => order.findIndex((i) => !rated.has(flashcards[i]?.id)), [order, rated, flashcards]);

  const go = (to: number) => {
    if (to < 0 || to >= order.length) return;
    setPos(to);
    setIsFlipped(false);
    setError(null);
  };

  const handleRating = async (rating: 0 | 1 | 2 | 3) => {
    if (!onRate || isRating || !currentCard) return;
    setIsRating(true);
    setError(null);
    try {
      await onRate(currentCard.id, rating);
      const next = new Map(rated).set(currentCard.id, rating);
      setRated(next);
      setTimeout(() => {
        setIsRating(false);
        const nextPos = order.findIndex((i, p) => p > pos && !next.has(flashcards[i].id));
        const wrap = order.findIndex((i) => !next.has(flashcards[i].id));
        if (nextPos !== -1) go(nextPos);
        else if (wrap !== -1) go(wrap);
        else {
          setIsFlipped(false);
          onComplete?.();
        }
      }, 250);
    } catch (e) {
      console.error('Rating failed:', e);
      setError('Couldn’t save that rating. Try again.');
      setIsRating(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ') {
        e.preventDefault();
        setIsFlipped((f) => !f);
      }
      if (e.key === 'ArrowLeft') go(pos - 1);
      if (e.key === 'ArrowRight') go(pos + 1);
      if (isFlipped && !isRating && ['1', '2', '3', '4'].includes(e.key)) void handleRating((Number(e.key) - 1) as 0 | 1 | 2 | 3);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const shuffle = () => {
    const next = [...order];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setOrder(next);
    setPos(0);
    setIsFlipped(false);
  };

  if (!currentCard) {
    return <div className="py-12 text-center text-muted-foreground">No flashcards available</div>;
  }

  return (
    <div className="flex flex-col items-center gap-5 py-6">
      {/* Progress */}
      <div className="w-full max-w-2xl">
        <div className="mb-1.5 flex items-center justify-between text-[12.5px] text-muted-foreground">
          <span className="num">
            Card {pos + 1} of {order.length}
          </span>
          {onRate && (
            <span className="num">
              {ratedCount} of {flashcards.length} rated
              {firstUnrated !== -1 && firstUnrated !== pos && ratedCount > 0 && (
                <button onClick={() => go(firstUnrated)} className="ml-2 font-medium text-primary hover:underline">
                  Next unrated
                </button>
              )}
            </span>
          )}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(ratedCount / flashcards.length) * 100}%` }} />
        </div>
      </div>

      {/* Card */}
      <div
        className="relative h-80 w-full max-w-2xl cursor-pointer sm:h-96"
        style={{ perspective: '1000px' }}
        onClick={() => setIsFlipped((f) => !f)}
        role="button"
        aria-label={isFlipped ? 'Show the question' : 'Show the answer'}
      >
        <motion.div
          className="h-full w-full"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border-2 border-border bg-card p-8" style={{ backfaceVisibility: 'hidden' }}>
            <div className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">Question</div>
            <p className="max-h-full overflow-auto text-center text-xl font-medium sm:text-2xl">{currentCard.front}</p>
            <div className="mt-8 text-xs text-muted-foreground">Think of the answer, then tap or press Space</div>
            {currentRating !== undefined && (
              <Badge variant="secondary" className="absolute right-4 top-4 text-xs">
                Rated {RATINGS[currentRating].label}
              </Badge>
            )}
          </div>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border-2 border-primary bg-primary/5 p-8"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="mb-4 text-xs font-medium uppercase tracking-wide text-primary">Answer</div>
            <p className="max-h-full overflow-auto whitespace-pre-wrap text-center text-[16px] leading-relaxed sm:text-lg">{currentCard.back}</p>
            {currentCard.tags && currentCard.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {currentCard.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Rate (after flipping) */}
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait" initial={false}>
          {isFlipped && onRate ? (
            <motion.div key="rate" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="mb-2 text-center text-[12.5px] text-muted-foreground">How well did you know it?</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RATINGS.map((r, i) => (
                  <button
                    key={r.label}
                    onClick={() => handleRating(i as 0 | 1 | 2 | 3)}
                    disabled={isRating}
                    className={`flex flex-col items-start rounded-xl border bg-card px-3.5 py-2.5 text-left transition-colors disabled:opacity-50 ${r.tone} ${
                      currentRating === i ? 'ring-2 ring-primary/40' : ''
                    }`}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className="text-[14px] font-semibold">{r.label}</span>
                      <kbd aria-hidden="true" className="num rounded border px-1 text-[10.5px] text-muted-foreground">
                        {i + 1}
                      </kbd>
                    </span>
                    <span className="mt-0.5 text-[12px] text-muted-foreground">{r.hint}</span>
                    <span className={`mt-2 h-1 w-6 rounded-full ${r.bar}`} />
                  </button>
                ))}
              </div>
              {isRating && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scheduling
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div key="nav" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={() => go(pos - 1)} disabled={pos === 0}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button onClick={() => setIsFlipped(true)} size="sm">
                <RotateCw className="h-4 w-4" />
                Show answer
              </Button>
              <Button variant="outline" size="sm" onClick={() => go(pos + 1)} disabled={pos === order.length - 1}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={shuffle} aria-label="Shuffle the cards" title="Shuffle">
                <Shuffle className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        {error && <p className="mt-2 text-center text-[12.5px] text-destructive">{error}</p>}
      </div>
    </div>
  );
}
