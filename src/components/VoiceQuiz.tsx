/**
 * Voice Quiz (hands-free)
 *
 * Turn-based loop, following the turn-taking ideas in LEARNINGS_FROM_3_VOICE_SYSTEMS
 * (Pipecat / LiveKit Agents), built on the browser Web Speech API:
 *   speak question + options -> listen (live transcript) -> understand
 *     - a command?  "repeat", "read the options", "skip", "stop"
 *     - an answer?  letter, number, or the option text (tries all 3 recogniser guesses)
 *     - unsure?     "I heard B, Lambda layers. Is that right?"  (yes / no)
 *     - nothing?    asks again twice, then skips, so it never stalls hands-free
 *   -> spoken feedback, with the explanation when you got it wrong -> next question
 *
 * Every async step checks a run token, so a newer sequence (a click, a command,
 * voice off, leaving the page) cancels the older one.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, RefreshCw, AlertCircle, CheckCircle, XCircle, Play, Pause } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  speechManager,
  parseVoiceAnswerFromAlternatives,
  parseVoiceCommand,
  SpeechError,
  type Heard,
} from '@/lib/voice/speech-manager';
import type { Quiz } from '@/lib/learning/quiz-generator';

export interface VoiceQuizCompletion {
  selected: Record<string, number>;
  voiceInputs: Record<string, string>;
  timeElapsed: number;
}

interface VoiceQuizProps {
  quiz: Quiz;
  onComplete: (result: VoiceQuizCompletion) => void;
  /** Start reading straight away (when the quiz was asked for by voice, hands are busy) */
  autoStart?: boolean;
}

type QuizState = 'ready' | 'idle' | 'speaking' | 'listening' | 'confirming' | 'feedback' | 'paused';

const LETTERS = ['A', 'B', 'C', 'D'];
const LISTEN_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;
const LOW_CONFIDENCE = 0.55;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function VoiceQuiz({ quiz, onComplete, autoStart = false }: VoiceQuizProps) {
  const support = speechManager.getSupport();
  const questions = quiz.questions;

  const [index, setIndex] = useState(0);
  const [state, setState] = useState<QuizState>('ready');
  const [voiceEnabled, setVoiceEnabled] = useState(support.tts);
  const [live, setLive] = useState('');
  const [lastHeard, setLastHeard] = useState<{ text: string; confidence: number | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ chosen: number; correct: boolean } | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);

  const runId = useRef(0);
  const selected = useRef<Record<string, number>>({});
  const voiceInputs = useRef<Record<string, string>>({});
  const startedAt = useRef(0);
  const voiceOn = useRef(voiceEnabled);
  voiceOn.current = voiceEnabled;

  const question = questions[index];

  useEffect(
    () => () => {
      runId.current++;
      speechManager.stopSpeaking();
      speechManager.stopListening();
    },
    []
  );

  const isCurrent = (id: number) => runId.current === id;

  async function say(text: string, id: number): Promise<boolean> {
    if (!voiceOn.current || !support.tts) return isCurrent(id);
    try {
      await speechManager.speak(text);
    } catch (e) {
      console.warn('TTS failed:', e);
    }
    return isCurrent(id);
  }

  const optionsSentence = (i: number) => questions[i].options.map((o, k) => `${LETTERS[k]}: ${o}.`).join(' ');

  /** Read question i aloud, then listen */
  async function presentQuestion(i: number, withIntro = false, id = ++runId.current) {
    speechManager.stopListening();
    setIndex(i);
    setFeedback(null);
    setPending(null);
    setLive('');
    setNotice(null);
    setError(null);

    if (!voiceOn.current || !support.tts) {
      setState('idle');
      return;
    }
    setState('speaking');
    const q = questions[i];
    if (withIntro && !(await say('Say the letter of your answer. You can also say repeat, skip, or stop.', id))) return;
    if (!(await say(`Question ${i + 1} of ${questions.length}. ${q.question}`, id))) return;
    if (!(await say(optionsSentence(i), id))) return;
    if (support.stt) await listenFor(i, id, 0);
    else setState('idle');
  }

  async function listenOnce(id: number): Promise<Heard | 'timeout'> {
    setState('listening');
    setLive('');
    const timer = setTimeout(() => speechManager.stopListening(), LISTEN_TIMEOUT_MS);
    try {
      return await speechManager.listenDetailed({ onInterim: (t) => isCurrent(id) && setLive(t) });
    } catch (e) {
      if (e instanceof SpeechError && (e.code === 'no-speech' || e.code === 'aborted')) return 'timeout';
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Listen for an answer or a command to question i */
  async function listenFor(i: number, id = ++runId.current, retries = 0): Promise<void> {
    setError(null);
    let heard: Heard | 'timeout';
    try {
      heard = await listenOnce(id);
    } catch (e) {
      if (!isCurrent(id)) return;
      setState('idle');
      setError(`${e instanceof SpeechError ? e.message : 'Speech recognition failed.'} Click your answer, or press "Speak answer".`);
      return;
    }
    if (!isCurrent(id)) return;

    if (heard === 'timeout' || !heard.transcript) {
      if (retries < MAX_RETRIES) {
        setNotice("I didn't hear anything.");
        if (!(await say("I didn't catch that. Say A, B, C or D.", id))) return;
        return listenFor(i, id, retries + 1);
      }
      setNotice('Skipped after no answer.');
      return skip(i, id);
    }

    setLastHeard({ text: heard.transcript, confidence: heard.confidence });
    const command = parseVoiceCommand(heard.transcript);
    if (command === 'repeat') return presentQuestion(i, false, id);
    if (command === 'options') {
      if (!(await say(optionsSentence(i), id))) return;
      return listenFor(i, id, retries);
    }
    if (command === 'skip') return skip(i, id);
    if (command === 'stop') {
      setState('paused');
      await say('Paused. Press resume when you are ready.', id);
      return;
    }

    const { index: choice, heard: matched } = parseVoiceAnswerFromAlternatives(heard.alternatives, questions[i].options);
    if (choice === -1) {
      if (retries < MAX_RETRIES) {
        setNotice(`Heard "${heard.transcript}", which isn't one of the options.`);
        if (!(await say('Sorry, say the letter of your answer, or say skip.', id))) return;
        return listenFor(i, id, retries + 1);
      }
      setNotice(`Skipped: "${heard.transcript}" didn't match an option.`);
      return skip(i, id);
    }

    // Unsure? Read it back before marking it, so a misheard letter never costs a point
    if (heard.confidence !== null && heard.confidence < LOW_CONFIDENCE) {
      setPending(choice);
      setState('confirming');
      if (!(await say(`I heard ${LETTERS[choice]}, ${questions[i].options[choice]}. Is that right?`, id))) return;
      const reply = await listenOnce(id).catch(() => 'timeout' as const);
      if (!isCurrent(id)) return;
      const yesNo = reply === 'timeout' ? null : parseVoiceCommand(reply.transcript);
      if (yesNo === 'no') {
        setPending(null);
        if (!(await say('Okay. Say your answer again.', id))) return;
        return listenFor(i, id, retries);
      }
      // "yes", or silence, or anything else: keep the answer it read back
    }
    return answer(i, choice, matched || heard.transcript);
  }

  function skip(i: number, id: number) {
    speechManager.stopListening();
    const q = questions[i];
    delete selected.current[q.id];
    void say('Skipped.', id).then((ok) => ok && next(i, id));
  }

  function next(i: number, id: number) {
    if (!isCurrent(id)) return;
    if (i === questions.length - 1) {
      onComplete({
        selected: { ...selected.current },
        voiceInputs: { ...voiceInputs.current },
        timeElapsed: Math.round((Date.now() - startedAt.current) / 1000),
      });
    } else {
      void presentQuestion(i + 1, false, id);
    }
  }

  /** Record an answer (voice or click), give feedback, move on */
  async function answer(i: number, choice: number, heard?: string) {
    const id = ++runId.current;
    speechManager.stopListening();
    speechManager.stopSpeaking();

    const q = questions[i];
    selected.current[q.id] = choice;
    if (heard) voiceInputs.current[q.id] = heard;
    setAnsweredCount(Object.keys(selected.current).length);

    const correct = choice === q.correctAnswerIndex;
    setFeedback({ chosen: choice, correct });
    setPending(null);
    setState('feedback');
    setError(null);
    setNotice(null);

    const spoken = correct
      ? 'Correct.'
      : `Not quite. It's ${LETTERS[q.correctAnswerIndex]}, ${q.options[q.correctAnswerIndex]}. ${q.explanation ?? ''}`;
    await say(spoken, id);
    await delay(correct ? 500 : 900);
    next(i, id);
  }

  function start() {
    startedAt.current = Date.now();
    void presentQuestion(0, true);
  }

  // Asked for by voice: begin without waiting for a click
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStarted.current && state === 'ready') {
      autoStarted.current = true;
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  function resume() {
    void presentQuestion(index);
  }

  function toggleVoice() {
    runId.current++;
    speechManager.stopSpeaking();
    speechManager.stopListening();
    setVoiceEnabled((v) => !v);
    if (state !== 'ready') setState('idle');
  }

  const locked = state === 'feedback' || state === 'ready';

  return (
    <div className="mx-auto max-w-3xl">
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleVoice}
            disabled={!support.tts}
            aria-pressed={voiceEnabled}
            title={voiceEnabled ? 'Ropi reads questions aloud. Click to mute.' : 'Muted. Click to have questions read aloud.'}
            className="-ml-2 text-muted-foreground"
          >
            {voiceEnabled ? <Volume2 /> : <VolumeX />}
            {voiceEnabled ? 'Read aloud' : 'Muted'}
          </Button>
          {!support.tts && <Badge variant="destructive">Speech output not supported in this browser</Badge>}
          {!support.stt && <Badge variant="secondary">Voice answers need Chrome, Edge or Safari</Badge>}
        </div>
        <div className="text-[12.5px] tabular-nums text-muted-foreground">
          {index + 1} of {questions.length}
        </div>
      </div>

      <div className="mb-6 h-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
      </div>

      {/* Question */}
      <Card className="mb-6 p-6 sm:p-8">
        <div className="eyebrow mb-3">{question.concept}</div>
        <h2 className="mb-6 text-[21px] font-semibold leading-snug tracking-[-0.015em]">{question.question}</h2>

        <div className="space-y-2">
          {question.options.map((option, i) => {
            const isChosen = feedback?.chosen === i;
            const isAnswer = feedback && i === question.correctAnswerIndex;
            const isPending = pending === i;
            return (
              <button
                key={i}
                data-option={i}
                onClick={() => answer(index, i)}
                disabled={locked}
                className={`group flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-colors disabled:cursor-default
                  ${isAnswer ? 'border-success bg-success/[0.06]' : ''}
                  ${isChosen && !feedback?.correct ? 'border-destructive bg-destructive/[0.05]' : ''}
                  ${isPending ? 'border-primary bg-accent ring-4 ring-primary/10' : ''}
                  ${!feedback && !isPending ? 'bg-card hover:border-primary/40 hover:bg-muted/40' : ''}
                  ${feedback && !isAnswer && !isChosen ? 'opacity-50' : ''}`}
              >
                <span
                  className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[12px] font-medium ${
                    isAnswer ? 'border-success bg-success text-white' : isChosen ? 'border-destructive bg-destructive text-white' : isPending ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'
                  }`}
                >
                  {LETTERS[i]}
                </span>
                <span className="text-[14.5px] leading-snug">{option}</span>
              </button>
            );
          })}
        </div>

        {feedback && !feedback.correct && question.explanation && (
          <p className="mt-4 rounded-lg bg-muted/60 px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground">{question.explanation}</p>
        )}
      </Card>

      {/* Status */}
      <AnimatePresence mode="wait">
        {(state === 'speaking' || state === 'listening' || state === 'confirming' || state === 'paused') && (
          <motion.div key={state} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card className="p-6">
              <div className="flex flex-col items-center gap-3 text-center">
                {state === 'speaking' && (
                  <>
                    <Volume2 className="h-9 w-9 animate-pulse text-primary" />
                    <p className="font-medium">Reading the question</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const id = ++runId.current;
                        speechManager.stopSpeaking();
                        if (support.stt) void listenFor(index, id, 0);
                        else setState('idle');
                      }}
                    >
                      Skip to answering
                    </Button>
                  </>
                )}

                {(state === 'listening' || state === 'confirming') && (
                  <>
                    <div className="relative flex h-20 w-20 items-center justify-center">
                      {[0, 0.5].map((d) => (
                        <motion.span
                          key={d}
                          className="absolute inset-0 rounded-full bg-primary/20"
                          initial={{ scale: 0.7, opacity: 0.8 }}
                          animate={{ scale: 1.35, opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 1.6, delay: d, ease: 'easeOut' }}
                        />
                      ))}
                      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float">
                        <Mic weight="fill" className="h-6 w-6" />
                      </span>
                    </div>
                    <p className="font-medium">{state === 'confirming' ? `Did you say ${LETTERS[pending ?? 0]}? Say yes or no` : 'Listening'}</p>
                    {/* Live transcript: you see what Ropi hears while you speak */}
                    <p className="min-h-[24px] max-w-md text-[15px] text-foreground" aria-live="polite">
                      {live ? `“${live}”` : <span className="text-muted-foreground">Say A, B, C or D, or the answer itself</span>}
                    </p>
                    <div className="flex flex-wrap justify-center gap-1.5 text-[11.5px] text-muted-foreground">
                      {['repeat', 'read the options', 'skip', 'stop'].map((c) => (
                        <span key={c} className="rounded-full border px-2 py-0.5">
                          “{c}”
                        </span>
                      ))}
                    </div>
                    {state === 'confirming' && pending !== null && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => answer(index, pending, lastHeard?.text)}>
                          Yes, {LETTERS[pending]}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const id = ++runId.current;
                            speechManager.stopListening();
                            setPending(null);
                            void listenFor(index, id, 0);
                          }}
                        >
                          No
                        </Button>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        runId.current++;
                        speechManager.stopListening();
                        setState('idle');
                      }}
                    >
                      <MicOff />
                      Stop listening
                    </Button>
                  </>
                )}

                {state === 'paused' && (
                  <>
                    <Pause className="h-9 w-9 text-muted-foreground" />
                    <p className="font-medium">Paused</p>
                    <Button onClick={resume}>
                      <Play />
                      Resume from question {index + 1}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </motion.div>
        )}
        {state === 'feedback' && feedback && (
          <motion.div key="feedback" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card className="flex items-center justify-center gap-3 p-5">
              {feedback.correct ? <CheckCircle className="h-6 w-6 text-success" /> : <XCircle className="h-6 w-6 text-destructive" />}
              <p className="font-medium">{feedback.correct ? 'Correct' : `The answer is ${LETTERS[question.correctAnswerIndex]}`}</p>
              {lastHeard && (
                <p className="text-[12px] text-muted-foreground">
                  Heard “{lastHeard.text}”{lastHeard.confidence !== null ? ` · ${Math.round(lastHeard.confidence * 100)}% sure` : ''}
                </p>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {notice && !error && <p className="mt-3 text-center text-[12.5px] text-muted-foreground">{notice}</p>}

      {error && (
        <Card className="mt-4 border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm">{error}</p>
          </div>
        </Card>
      )}

      {/* Manual controls */}
      {state === 'idle' && (
        <div className="mt-6 flex items-center justify-center gap-3">
          {support.tts && voiceEnabled && (
            <Button variant="outline" onClick={() => presentQuestion(index)}>
              <RefreshCw />
              Repeat question
            </Button>
          )}
          {support.stt && (
            <Button onClick={() => listenFor(index)}>
              <Mic />
              Speak answer
            </Button>
          )}
        </div>
      )}

      {state === 'ready' && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button size="lg" onClick={start}>
            <Volume2 />
            Start voice quiz
          </Button>
          <p className="max-w-sm text-center text-[12px] text-muted-foreground">
            Say the letter or the answer. Your browser asks for the microphone once.{' '}
            <span
              className="cursor-help underline decoration-dotted underline-offset-2"
              title="Speech recognition runs in your browser: Chrome and Edge send the audio to Google or Microsoft, Safari to Apple. Ropi only stores the words it heard for each answer."
            >
              Where audio goes
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
