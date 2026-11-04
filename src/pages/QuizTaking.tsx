/**
 * Quiz Taking Page
 * 
 * Interactive quiz interface with timer and progress tracking
 */

import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  ArrowLeft,
  Trophy,
  Loader2,
  AlertCircle,
} from '@/components/icons';
import { useQuiz } from '@/hooks/useQuiz';
import { buildQuizResult } from '@/lib/learning/quiz-result';

export default function QuizTaking() {
  const { quizId } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const { quiz, stats, error, loading, retry } = useQuiz(quizId, params.get('topic'), params.get('focus'), params.get('source'));

  if (loading || error || !quiz) {
    return (
      <DashboardLayout>
        <QuizStatus
          loading={loading}
          error={error}
          topic={params.get('focus') || params.get('topic')}
          fromDocument={!!params.get('source')}
          onRetry={retry}
        />
      </DashboardLayout>
    );
  }

  // key resets all answer state when a different quiz loads
  return (
    <QuizRunner
      key={`${quizId}-${quiz.title}`}
      quiz={quiz}
      quizId={quizId ?? quiz.id}
      retakePath={location.pathname + location.search}
      verified={stats}
    />
  );
}

function QuizStatus({
  loading,
  error,
  topic,
  fromDocument,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  topic: string | null;
  fromDocument?: boolean;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="max-w-md mx-auto text-center py-16">
      {loading ? (
        <>
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-[17px] font-semibold mb-1">Writing your quiz</h2>
          <p className="text-sm text-muted-foreground">
            {fromDocument
              ? 'Writing questions from your document, then checking every answer against a quote from it. About 15 seconds.'
              : <>Writing questions{topic ? ` on ${topic}` : ''}. The first ones are usually ready in about 5 seconds.</>}
          </p>
        </>
      ) : (
        <>
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
          <h2 className="text-[17px] font-semibold mb-1">Couldn't load the quiz</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/learning')}>
              Back to Learning
            </Button>
            {(topic || fromDocument) && <Button onClick={onRetry}>Try again</Button>}
          </div>
        </>
      )}
    </div>
  );
}

function QuizRunner({
  quiz,
  quizId,
  retakePath,
  verified,
}: {
  quiz: NonNullable<ReturnType<typeof useQuiz>['quiz']>;
  quizId: string;
  retakePath: string;
  verified?: ReturnType<typeof useQuiz>['stats'];
}) {
  const navigate = useNavigate();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Map<string, number>>(new Map());
  const [timeElapsed, setTimeElapsed] = useState(0);
  
  // A generated quiz arrives in parts: start on the first questions while Muse writes the rest
  const total = Math.max(quiz.questions.length, quiz.expectedCount ?? 0);
  const currentQuestion = quiz.questions[currentQuestionIndex] as (typeof quiz.questions)[number] | undefined;
  const selectedAnswer = currentQuestion ? selectedAnswers.get(currentQuestion.id) : undefined;
  const isLastQuestion = currentQuestionIndex === total - 1;
  
  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleAnswerSelect = (answerIndex: number) => {
    if (!currentQuestion) return;
    const newAnswers = new Map(selectedAnswers);
    newAnswers.set(currentQuestion.id, answerIndex);
    setSelectedAnswers(newAnswers);
  };
  
  const handleNext = () => {
    if (currentQuestionIndex < total - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };
  
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };
  
  const handleSubmit = () => {
    // Every answer goes to the results page with its concept, so the skill
    // tracker can score each concept (not just the quiz as a whole)
    const result = buildQuizResult(quiz, quizId, selectedAnswers, timeElapsed, 'text', retakePath);
    navigate(`/quiz/results/${quizId}`, { state: result });
  };
    const progress = ((currentQuestionIndex + 1) / total) * 100;
  const answeredCount = selectedAnswers.size;

  // Keyboard: A-D or 1-4 picks an answer, Enter / arrow keys move
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      const pick = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : '1234'.indexOf(k);
      if (currentQuestion && pick >= 0 && pick < currentQuestion.options.length) handleAnswerSelect(pick);
      else if ((k === 'enter' || k === 'arrowright') && selectedAnswer !== undefined && !isLastQuestion) handleNext();
      else if (k === 'arrowleft') handlePrevious();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const allAnswered = quiz.questions.length === total && answeredCount === total;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="eyebrow mb-2 truncate">{quiz.title}</div>
            <h1 className="text-[26px] font-semibold leading-tight">
              Question <span className="num">{currentQuestionIndex + 1}</span>
              <span className="text-muted-foreground"> of {total}</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="capitalize">{quiz.difficulty}</Badge>
            <span className="num inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-[12px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(timeElapsed)}
            </span>
          </div>
        </div>

        {verified && quiz.questions[0]?.source && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-success/25 bg-success/[0.05] px-4 py-3 text-[12.5px]">
            <CheckCircle className="mt-px h-4 w-4 shrink-0 text-success" />
            <span>
              <span className="font-medium">Written from your document "{quiz.questions[0].source.title}".</span>{' '}
              <span className="text-muted-foreground">
                Every answer was checked against a word-for-word quote from it
                {verified.droppedUnverified ? `; ${verified.droppedUnverified} that couldn't be checked were thrown out` : ''}. You'll see the quotes when you finish.
              </span>
            </span>
          </div>
        )}

        {/* Segmented progress: one segment per question, click to jump */}
        <div className="mb-6 flex gap-1" aria-label={`${answeredCount} of ${total} answered`}>
          {Array.from({ length: total }, (_, i) => quiz.questions[i]).map((q, i) => {
            const answered = !!q && selectedAnswers.has(q.id);
            const current = i === currentQuestionIndex;
            return (
              <button
                key={q?.id ?? `pending-${i}`}
                tabIndex={-1}
                aria-label={`Go to question ${i + 1}`}
                onClick={() => setCurrentQuestionIndex(i)}
                className="group flex-1 py-1.5"
              >
                <span
                  className={`block h-1 rounded-full transition-colors ${
                    current ? 'bg-primary' : answered ? 'bg-primary/35' : 'bg-border group-hover:bg-muted-foreground/30'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {!currentQuestion ? (
            <Card key="writing" className="flex items-center gap-3 p-6 text-[14px] text-muted-foreground sm:p-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Writing question {currentQuestionIndex + 1}. It’ll be here in a moment.
            </Card>
          ) : (
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            <Card className="p-6 sm:p-8">
              <Badge variant="default" className="mb-4">{currentQuestion.concept}</Badge>
              <h2 className="text-[21px] font-semibold leading-snug tracking-[-0.015em]">{currentQuestion.question}</h2>

              <div className="mt-6 space-y-2" role="radiogroup" aria-label="Answers">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswer === index;
                  return (
                    <button
                      key={index}
                      data-option={index}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleAnswerSelect(index)}
                      className={`group flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-[border-color,background-color,box-shadow] duration-150 ${
                        isSelected
                          ? 'border-primary bg-accent ring-4 ring-primary/10'
                          : 'bg-card hover:border-primary/40 hover:bg-muted/40'
                      }`}
                    >
                      <span
                        className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[12px] font-medium transition-colors ${
                          isSelected ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground group-hover:text-foreground'
                        }`}
                      >
                        {'ABCD'[index]}
                      </span>
                      <span className="text-[14.5px] leading-snug">{option}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={handlePrevious} disabled={currentQuestionIndex === 0}>
            <ArrowLeft />
            Previous
          </Button>

          <span className="hidden text-[12px] text-muted-foreground sm:block">
            Press <kbd aria-hidden="true" className="num rounded border bg-card px-1 text-[11px]">A</kbd>–<kbd aria-hidden="true" className="num rounded border bg-card px-1 text-[11px]">D</kbd> to answer
          </span>

          {!isLastQuestion ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!allAnswered}>
              <Trophy />
              Submit Quiz
            </Button>
          )}
        </div>

        {isLastQuestion && !allAnswered && (
          <p className="mt-4 text-center text-[12.5px] text-warning-ink">
            {total - answeredCount} question{total - answeredCount === 1 ? '' : 's'} left
            unanswered. Tap a segment above to jump back.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
