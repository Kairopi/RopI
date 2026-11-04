/**
 * Ask Ropi (Ctrl/Cmd + K): a question box that answers from your own
 * history and notes, with citations you can check. See lib/knowledge/ask.ts.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, Loader2, ArrowRight, Brain, FileText, CalendarClock, Target, Mic, MicOff, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { askRopi, type Answer, type Evidence, type PlanContext } from '@/lib/knowledge/ask';
import { usePlan } from '@/hooks/usePlan';
import { useWeek } from '@/hooks/useWeek';
import { speechManager } from '@/lib/voice/speech-manager';

const SUGGESTIONS = ['What have I been getting wrong?', 'What should I do tonight?', 'Explain my weakest topic using my notes'];

const KIND = {
  history: { icon: Target, label: 'Quiz history' },
  attempt: { icon: Brain, label: 'Quiz' },
  card: { icon: Brain, label: 'Review card' },
  note: { icon: FileText, label: 'Your notes' },
  plan: { icon: CalendarClock, label: 'Your plan' },
} as const;

const fmt = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const label = d.toDateString() === today.toDateString() ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${label} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

export function useAskShortcut(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}

export function AskRopi({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { plan } = usePlan();
  const goal = useWeek((s) => s.goal);
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const planContext: PlanContext = useMemo(() => {
    const tasks = new Map(plan.tasks.map((t) => [t.id, t]));
    const now = Date.now();
    return {
      goal: goal?.title ?? null,
      upcoming: plan.schedule.blocks
        .filter((b) => new Date(b.endTime).getTime() > now)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .slice(0, 5)
        .map((b) => ({ title: tasks.get(b.taskId)?.title ?? 'Task', when: fmt(b.startTime), minutes: Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000) })),
      atRisk: plan.schedule.atRiskTasks.map((r) => ({ title: tasks.get(r.taskId)?.title ?? 'Task', reason: r.reason })),
    };
  }, [plan, goal]);

  useEffect(() => {
    if (!open) {
      speechManager.stopListening();
      setListening(false);
    }
  }, [open]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setAsked(text);
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      setAnswer(await askRopi(text, planContext));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const speak = async () => {
    if (listening) return speechManager.stopListening();
    setListening(true);
    try {
      const heard = await speechManager.listenDetailed({ onInterim: setQ });
      setQ(heard.transcript);
      await ask(heard.transcript);
    } catch {
      // silence or blocked mic: the box stays editable
    } finally {
      setListening(false);
    }
  };

  const go = (href: string) => {
    onOpenChange(false);
    navigate(href);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-2xl border bg-card shadow-float focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Ask Ropi</DialogPrimitive.Title>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
            className="flex items-center gap-2 border-b px-4"
          >
            <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask about your quizzes, notes or week"
              aria-label="Ask Ropi"
              className="h-14 w-full bg-transparent text-[15px] placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none"
            />
            {speechManager.getSupport().stt && (
              <button
                type="button"
                onClick={speak}
                aria-label={listening ? 'Stop listening' : 'Ask by voice'}
                className={`rounded-md p-1.5 transition-colors ${listening ? 'animate-pulse bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <DialogPrimitive.Close aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </form>

          <div className="max-h-[62vh] overflow-y-auto">
            {!answer && !busy && !error && (
              <div className="p-4">
                <div className="eyebrow mb-2 px-1">Try</div>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setQ(s);
                      ask(s);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-[13.5px] transition-colors hover:bg-muted"
                  >
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    {s}
                  </button>
                ))}
                <p className="mt-3 px-1 text-[11.5px] text-muted-foreground">
                  Ropi answers only from your quiz history, review cards, documents and plan, and shows you where each claim comes from.
                </p>
              </div>
            )}

            {busy && (
              <div className="flex items-center gap-2.5 p-6 text-[13.5px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Searching your history and notes for "{asked}"
              </div>
            )}

            {error && <p className="p-6 text-[13.5px] text-destructive">{error}</p>}

            <AnimatePresence>
              {answer && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-5">
                  <div className="eyebrow mb-2">{asked}</div>
                  <p className="text-[15px] leading-relaxed">
                    <CitedText text={answer.text} evidence={answer.retrieved} />
                  </p>

                  {answer.action && (
                    <Button className="mt-4" size="sm" onClick={() => go(answer.action!.href)}>
                      {answer.action.label}
                      <ArrowRight />
                    </Button>
                  )}

                  {(answer.cited.length ? answer.cited : answer.retrieved.slice(0, 3)).length > 0 && (
                    <div className="mt-5">
                      <div className="eyebrow mb-2">{answer.cited.length ? 'Sources' : 'What Ropi found'}</div>
                      <ul className="space-y-2">
                        {(answer.cited.length ? answer.cited : answer.retrieved.slice(0, 3)).map((e) => (
                          <EvidenceRow key={e.id} e={e} onOpen={go} />
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="mt-4 text-[11px] text-muted-foreground">
                    {answer.answeredBy === 'muse' ? 'Written by Meta Muse from' : 'Listed directly from'} {answer.retrieved.length} piece
                    {answer.retrieved.length === 1 ? '' : 's'} of your own data · {answer.cited.length} cited · {(answer.ms / 1000).toFixed(1)}s
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Render [H1, N2] markers as small chips */
function CitedText({ text, evidence }: { text: string; evidence: Evidence[] }) {
  const ids = new Set(evidence.map((e) => e.id));
  const parts = text.split(/(\[[A-Z]\d{1,2}(?:,\s*[A-Z]\d{1,2})*\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[A-Z]\d/.test(p) ? (
          p
            .slice(1, -1)
            .split(/,\s*/)
            .filter((id) => ids.has(id))
            .map((id) => (
              <sup key={`${i}-${id}`} className="num mx-0.5 rounded bg-accent px-1 py-px text-[10px] font-medium text-accent-foreground">
                {id}
              </sup>
            ))
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function EvidenceRow({ e, onOpen }: { e: Evidence; onOpen: (href: string) => void }) {
  const K = KIND[e.kind];
  const href = e.kind === 'note' && e.sourceId ? `/quiz/new?source=${e.sourceId}` : e.kind === 'plan' ? '/schedule' : e.kind === 'card' ? '/reviews' : '/learning';
  return (
    <li>
      <button onClick={() => onOpen(href)} className="group flex w-full items-start gap-3 rounded-xl border bg-background px-3.5 py-3 text-left transition-colors hover:border-primary/40">
        <span className="num mt-0.5 shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10.5px] font-medium text-accent-foreground">{e.id}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <K.icon className="h-3.5 w-3.5" />
            {K.label}
            {e.meta ? ` · ${e.meta}` : ''}
          </span>
          <span className="mt-0.5 block text-[13px] font-medium">{e.title}</span>
          <span className={`mt-0.5 block text-[12.5px] leading-snug text-muted-foreground ${e.kind === 'note' ? 'line-clamp-3 italic' : 'line-clamp-2'}`}>
            {e.kind === 'note' ? `"${e.text}"` : e.text}
          </span>
        </span>
      </button>
    </li>
  );
}
