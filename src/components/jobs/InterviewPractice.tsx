/**
 * Interview Practice Component
 * 
 * AI-powered interview simulation with real-time feedback
 * Helps users prepare for actual interviews
 */

import { useState, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  SkipForward, 
  Check, 
  TrendingUp, 
  MessageSquare,
  Loader2,
  ChevronRight,
  Award
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  generateInterviewQuestions, 
  evaluateInterviewResponse,
  generateSessionSummary,
  type InterviewQuestion 
} from '@/lib/jobs/interview-coach';

interface InterviewPracticeProps {
  jobId: string;
  jobTitle: string;
  company: string;
  description: string;
  userId: string;
}

type SessionState = 'setup' | 'questioning' | 'answering' | 'feedback' | 'completed';

export function InterviewPractice({ 
  jobId, 
  jobTitle, 
  company, 
  description,
  userId 
}: InterviewPracticeProps) {
  const [state, setState] = useState<SessionState>('setup');
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [responses, setResponses] = useState<Array<{
    question: string;
    answer: string;
    feedback: string;
    score: number;
    strengths: string[];
    improvements: string[];
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any>(null);

  const apiKey = import.meta.env.VITE_MUSE_API_KEY;

  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  // Start interview session
  const startInterview = async () => {
    setLoading(true);
    setError(null);

    try {
      const generatedQuestions = await generateInterviewQuestions(
        jobTitle,
        company,
        description,
        apiKey
      );

      setQuestions(generatedQuestions);
      setState('questioning');
    } catch (err: any) {
      setError(err.message || 'Failed to generate interview questions');
      console.error('Interview start error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Submit answer and get feedback
  const submitAnswer = async () => {
    if (!currentAnswer.trim()) {
      setError('Please provide an answer before continuing');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const evaluation = await evaluateInterviewResponse(
        currentQuestion.question,
        currentQuestion.category,
        currentAnswer,
        jobTitle,
        apiKey
      );

      const newResponse = {
        question: currentQuestion.question,
        answer: currentAnswer,
        feedback: evaluation.feedback,
        score: evaluation.score,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
      };

      setResponses([...responses, newResponse]);
      setState('feedback');
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate answer');
      console.error('Evaluation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Move to next question
  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer('');
      setState('questioning');
      setError(null);
    } else {
      completeInterview();
    }
  };

  // Complete interview and generate summary
  const completeInterview = async () => {
    setLoading(true);

    try {
      const summary = await generateSessionSummary(
        {
          id: crypto.randomUUID(),
          jobId,
          jobTitle,
          company,
          questions,
          currentQuestionIndex,
          responses,
          startedAt: new Date().toISOString(),
        },
        apiKey
      );

      setSessionSummary(summary);
      setState('completed');
    } catch (err: any) {
      console.error('Summary generation error:', err);
      // Still complete the interview even if summary fails
      setState('completed');
    } finally {
      setLoading(false);
    }
  };

  // Toggle recording (placeholder for future voice integration)
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // TODO: Implement actual voice recording with Web Speech API
  };

  // Render setup screen
  if (state === 'setup') {
    return (
      <Card className="p-8">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div>
            <h3 className="font-display text-2xl font-semibold mb-2">Interview Practice</h3>
            <p className="text-muted-foreground">
              Practice for your {jobTitle} interview at {company}
            </p>
          </div>

          <div className="bg-muted rounded-lg p-6 text-left space-y-4">
            <h4 className="font-semibold">What to expect:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>8 tailored interview questions (behavioral, technical, situational)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Real-time AI feedback on your answers</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Specific strengths and improvement areas</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Overall performance score and summary</span>
              </li>
            </ul>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button 
            size="lg" 
            onClick={startInterview}
            disabled={loading}
            className="min-w-[200px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating Questions...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Start Practice Interview
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  // Render question/answer screen
  if (state === 'questioning' || state === 'answering' || state === 'feedback') {
    const latestResponse = responses[responses.length - 1];

    return (
      <div className="space-y-6">
        {/* Progress */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <Badge variant={
              currentQuestion.difficulty === 'easy' ? 'secondary' :
              currentQuestion.difficulty === 'medium' ? 'default' :
              'destructive'
            }>
              {currentQuestion.difficulty}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </Card>

        {/* Question */}
        {(state === 'questioning' || state === 'answering') && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <Badge variant="outline" className="mb-3">
                    {currentQuestion.category}
                  </Badge>
                  <h3 className="text-[17px] font-semibold mb-4">
                    {currentQuestion.question}
                  </h3>

                  <Textarea
                    placeholder="Type your answer here... (Use the STAR method for behavioral questions: Situation, Task, Action, Result)"
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    rows={8}
                    className="mb-4"
                  />

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={submitAnswer}
                      disabled={loading || !currentAnswer.trim()}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Evaluating...
                        </>
                      ) : (
                        <>
                          Submit Answer
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={toggleRecording}
                      title={isRecording ? "Stop recording" : "Start voice recording"}
                    >
                      {isRecording ? (
                        <MicOff className="w-4 h-4 text-destructive" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </Button>

                    {currentQuestionIndex < questions.length - 1 && (
                      <Button
                        variant="ghost"
                        onClick={nextQuestion}
                      >
                        Skip
                        <SkipForward className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {error && (
                    <div className="text-sm text-destructive mt-3">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Feedback */}
        {state === 'feedback' && latestResponse && (
          <Card className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-semibold">AI Feedback</h3>
                <div className="flex items-center gap-2">
                  <Award className={`w-5 h-5 ${
                    latestResponse.score >= 80 ? 'text-success' :
                    latestResponse.score >= 60 ? 'text-warning-ink' :
                    'text-destructive'
                  }`} />
                  <span className="font-display text-2xl font-semibold">{latestResponse.score}</span>
                  <span className="text-muted-foreground">/100</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-success">Strengths</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {latestResponse.strengths.map((strength, i) => (
                      <li key={i}>{strength}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2 text-warning-ink">Areas for Improvement</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {latestResponse.improvements.map((improvement, i) => (
                      <li key={i}>{improvement}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2">Overall Feedback</h4>
                  <p className="text-sm text-muted-foreground">
                    {latestResponse.feedback}
                  </p>
                </div>
              </div>

              <Button onClick={nextQuestion} className="w-full">
                {currentQuestionIndex < questions.length - 1 ? (
                  <>
                    Next Question
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Complete Interview
                    <Check className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Previous responses summary */}
        {responses.length > 0 && state !== 'feedback' && (
          <Card className="p-4">
            <h4 className="font-semibold text-sm mb-3">Your Progress</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {responses.map((response, i) => (
                <div key={i} className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Q{i + 1}</div>
                  <div className={`font-display text-2xl font-semibold ${
                    response.score >= 80 ? 'text-success' :
                    response.score >= 60 ? 'text-warning-ink' :
                    'text-destructive'
                  }`}>
                    {response.score}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // Render completion screen
  if (state === 'completed') {
    const avgScore = responses.reduce((sum, r) => sum + r.score, 0) / responses.length;

    return (
      <Card className="p-8">
        <div className="space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <Award className="w-10 h-10 text-primary" />
              </div>
            </div>
            <h3 className="font-display text-2xl font-semibold mb-2">Interview practice complete</h3>
            <p className="text-muted-foreground">
              Great job preparing for your {jobTitle} interview
            </p>
          </div>

          {/* Overall Score */}
          <div className="bg-primary/[0.06] border border-primary/15 rounded-xl p-6 text-center">
            <div className="text-sm text-muted-foreground mb-2">Overall Score</div>
            <div className="font-display text-5xl font-semibold tracking-[-0.04em] text-primary mb-2">
              {sessionSummary?.overallScore || Math.round(avgScore)}
            </div>
            <div className="text-sm text-muted-foreground">out of 100</div>
          </div>

          {/* Individual Scores */}
          <div>
            <h4 className="font-semibold mb-3">Question Breakdown</h4>
            <div className="space-y-2">
              {responses.map((response, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="text-sm font-medium min-w-[60px]">Q{i + 1}</div>
                  <div className="flex-1">
                    <Progress value={response.score} className="h-2" />
                  </div>
                  <div className={`num text-sm font-semibold min-w-[50px] text-right ${
                    response.score >= 80 ? 'text-success' :
                    response.score >= 60 ? 'text-warning-ink' :
                    'text-destructive'
                  }`}>
                    {response.score}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          {sessionSummary && (
            <>
              <div>
                <h4 className="font-semibold text-sm mb-2 text-success">Your Strengths</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {sessionSummary.strengths.map((strength: string, i: number) => (
                    <li key={i}>{strength}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 text-warning-ink">Focus Areas</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {sessionSummary.improvements.map((improvement: string, i: number) => (
                    <li key={i}>{improvement}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">Coach's Summary</h4>
                <p className="text-sm text-muted-foreground">
                  {sessionSummary.summary}
                </p>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                setState('setup');
                setCurrentQuestionIndex(0);
                setCurrentAnswer('');
                setResponses([]);
                setQuestions([]);
                setSessionSummary(null);
                setError(null);
              }}
            >
              Practice Again
            </Button>
            <Button className="flex-1">
              Back to Applications
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return null;
}
