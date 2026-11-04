/**
 * Flashcard Viewer Component
 * 
 * 3D flip animation with FSRS rating integration
 * Keyboard shortcuts: Space (flip), 1/2/3/4 (rate), Arrow keys (navigate)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, RotateCw, Shuffle } from '@/components/icons';
import type { FlashcardDB } from '@/lib/learning/study-materials-db';

interface FlashcardViewerProps {
  flashcards: FlashcardDB[];
  onComplete?: () => void;
  onRate?: (flashcardId: string, rating: 0 | 1 | 2 | 3) => Promise<void>;
}

export function FlashcardViewer({ 
  flashcards, 
  onComplete,
  onRate 
}: FlashcardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedCards, setStudiedCards] = useState<Set<number>>(new Set());
  const [isRating, setIsRating] = useState(false);
  
  const currentCard = flashcards[currentIndex];
  const progress = `${currentIndex + 1} / ${flashcards.length}`;
  const hasStudiedCurrent = studiedCards.has(currentIndex);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      
      if (e.key === ' ') {
        e.preventDefault();
        handleFlip();
      }
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      
      // Rating shortcuts (1=Again, 2=Hard, 3=Good, 4=Easy)
      if (isFlipped && !isRating && ['1', '2', '3', '4'].includes(e.key)) {
        const rating = (parseInt(e.key) - 1) as 0 | 1 | 2 | 3;
        handleRating(rating);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, currentIndex, isRating]);
  
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };
  
  const handleRating = async (rating: 0 | 1 | 2 | 3) => {
    if (!onRate || isRating) return;
    
    setIsRating(true);
    
    try {
      await onRate(currentCard.id, rating);
      
      // Mark as studied
      setStudiedCards(prev => new Set(prev).add(currentIndex));
      
      // Auto-advance to next card
      setTimeout(() => {
        setIsFlipped(false);
        setIsRating(false);
        
        if (currentIndex < flashcards.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          // Session complete!
          if (onComplete) onComplete();
        }
      }, 300);
    } catch (error) {
      console.error('Rating failed:', error);
      setIsRating(false);
    }
  };
  
  const next = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };
  
  const prev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };
  
  const shuffleCards = () => {
    // TODO: Implement shuffle
    console.log('Shuffle not yet implemented');
  };
  
  if (!currentCard) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No flashcards available
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Progress */}
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground">
          {progress}
        </div>
        {hasStudiedCurrent && (
          <Badge variant="secondary" className="text-xs">
            Reviewed
          </Badge>
        )}
      </div>
      
      {/* Card */}
      <div 
        className="relative w-full max-w-2xl h-96 cursor-pointer"
        style={{ perspective: '1000px' }}
        onClick={handleFlip}
      >
        <motion.div
          className="w-full h-full"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 bg-card border-2 border-border rounded-xl p-8 flex flex-col items-center justify-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="text-xs text-muted-foreground mb-4 uppercase tracking-wide">
              Question
            </div>
            <p className="text-2xl text-center font-medium">
              {currentCard.front}
            </p>
            <div className="mt-8 text-xs text-muted-foreground">
              Click or press Space to flip
            </div>
          </div>
          
          {/* Back */}
          <div
            className="absolute inset-0 bg-primary/5 border-2 border-primary rounded-xl p-8 flex flex-col items-center justify-center"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <div className="text-xs text-primary mb-4 uppercase tracking-wide font-medium">
              Answer
            </div>
            <p className="text-xl text-center">
              {currentCard.back}
            </p>
            
            {currentCard.tags && currentCard.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6">
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
      
      {/* Navigation Controls */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={prev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        
        <Button onClick={handleFlip} size="sm">
          <RotateCw className="w-4 h-4" />
          Flip
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={next}
          disabled={currentIndex === flashcards.length - 1}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={shuffleCards}
        >
          <Shuffle className="w-4 h-4" />
        </Button>
      </div>
      
      {/* FSRS Rating Buttons (shown after flip) */}
      <AnimatePresence>
        {isFlipped && onRate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex gap-3"
          >
            <Button 
              variant="outline"
              size="sm"
              className="border-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleRating(0)}
              disabled={isRating}
            >
              Again (1)
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className="border-warning hover:bg-warning/10 hover:text-warning-ink"
              onClick={() => handleRating(1)}
              disabled={isRating}
            >
              Hard (2)
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className="border-success hover:bg-success/10 hover:text-success"
              onClick={() => handleRating(2)}
              disabled={isRating}
            >
              Good (3)
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className="border-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => handleRating(3)}
              disabled={isRating}
            >
              Easy (4)
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Study Progress Bar */}
      <div className="w-full max-w-2xl">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(studiedCards.size / flashcards.length) * 100}%` }}
          />
        </div>
        <div className="text-xs text-center text-muted-foreground mt-2">
          {studiedCards.size} of {flashcards.length} reviewed
        </div>
      </div>
    </div>
  );
}
