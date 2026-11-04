/**
 * Voice Quiz Page
 *
 * Any quiz, out loud: built-in (?quiz=quiz-1), any topic (?quiz=new&topic=X),
 * a weak spot (&focus=Y) or one of your documents (?quiz=new&source=<id>).
 * Results go through the same QuizResults page as text quizzes, so voice
 * answers update the skill profile, weak spots and FSRS review cards too.
 */

import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from '@/components/icons';
import DashboardLayout from '../components/DashboardLayout';
import { VoiceQuiz, type VoiceQuizCompletion } from '@/components/VoiceQuiz';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { BUILT_IN_QUIZ_LIST } from '@/lib/mock/quizzes';
import { buildQuizResult } from '@/lib/learning/quiz-result';
import { useQuiz } from '@/hooks/useQuiz';

export default function VoiceQuizPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const quizParam = params.get('quiz') || 'quiz-1';
  const topic = params.get('topic');
  const focus = params.get('focus');
  const source = params.get('source');
  const { quiz, loading, error, retry } = useQuiz(quizParam, topic, focus, source, { progressive: false });
  const builtIn = BUILT_IN_QUIZ_LIST.some((q) => q.id === quizParam);

  const handleComplete = ({ selected, voiceInputs, timeElapsed }: VoiceQuizCompletion) => {
    if (!quiz) return;
    const retake = `/voice-quiz?${params.toString()}`;
    const result = buildQuizResult(quiz, quizParam === 'new' ? quiz.id : quizParam, selected, timeElapsed, 'voice', retake, voiceInputs);
    navigate(`/quiz/results/${quizParam === 'new' ? 'voice' : quizParam}`, { state: result });
  };

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow={
          <button onClick={() => navigate('/learning')} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Learn · Voice quiz
          </button>
        }
        title={quiz?.title ?? 'Voice quiz'}
        description="Ropi reads each question, you answer out loud."
        actions={
          builtIn || !quiz ? (
            <div className="inline-flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Quiz topic">
              {BUILT_IN_QUIZ_LIST.map((q) => (
                <button
                  key={q.id}
                  role="tab"
                  aria-selected={q.id === quizParam}
                  onClick={() => setParams({ quiz: q.id })}
                  className={`rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors ${
                    q.id === quizParam ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(225_20%_8%/0.08)]' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {q.topic}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />

      {loading ? (
        <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <h2 className="text-[17px] font-semibold">Writing your voice quiz</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {source ? 'From your document, with every answer checked against a quote.' : `Writing questions${focus ? ` on ${focus}` : topic ? ` on ${topic}` : ''}.`}
          </p>
        </div>
      ) : error || !quiz ? (
        <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
          <AlertCircle className="mb-4 h-8 w-8 text-destructive" />
          <h2 className="text-[17px] font-semibold">Couldn't load the quiz</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{error}</p>
          <Button className="mt-5" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : (
        // key restarts the quiz cleanly when switching quizzes
        <VoiceQuiz key={`${quizParam}-${quiz.title}`} quiz={quiz} onComplete={handleComplete} autoStart={params.get('start') === '1'} />
      )}
    </DashboardLayout>
  );
}
