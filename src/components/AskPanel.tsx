/**
 * Ask Ropi, inside a folder or subtopic: a conversation about just this topic.
 *
 * Questions are answered in the topic's context (your notes on it come along).
 * Every conversation is saved under the topic with the time of each message;
 * open an earlier one and keep going where you left off. Any answer can be
 * saved as a note with one tap (NotebookLM's "save to note", for your own topics).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Check, Loader2, MessageSquare, Mic, Plus } from '@/components/icons';
import { useUserId } from '@/contexts/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import { useWeek } from '@/hooks/useWeek';
import { useLoop } from '@/hooks/useLoop';
import { useAgenda } from '@/hooks/useAgenda';
import { respond, type Reply } from '@/lib/coach/brain';
import { newConversation, saveConversation, type Conversation, type Turn } from '@/lib/library/store';
import { addTo, makeNote } from '@/lib/library/notes';
import type { PlanContext } from '@/lib/knowledge/ask';
import { cn } from '@/lib/utils';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function AskPanel({
  folder,
  subtopic,
  topic,
  convoKey,
  conversations,
  notes,
  onChange,
}: {
  folder: { key: string; name: string };
  subtopic: string | null;
  /** The name quizzes use (what "Quiz me" is made on) */
  topic: string;
  /** Where conversations here are filed: the folder key, or "folder::subtopic" */
  convoKey: string;
  conversations: Conversation[];
  notes: string[];
  onChange: () => void;
}) {
  const navigate = useNavigate();
  const userId = useUserId();
  const { plan } = usePlan();
  const goal = useWeek((s) => s.goal?.title ?? null);
  const addTask = useWeek((s) => s.addTask);
  const dueCards = useLoop((s) => s.dueCards);
  const weakSpots = useLoop((s) => s.weakSpots);
  const jobs = useLoop((s) => s.jobs);
  const agenda = useAgenda();
  const name = subtopic ?? folder.name;

  const [convo, setConvo] = useState<Conversation | null>(null);
  const [replies, setReplies] = useState<Record<number, Reply>>({});
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const bottom = useRef<HTMLDivElement>(null);
  const mine = useMemo(() => conversations.filter((c) => (c.topic_key ?? '') === convoKey).slice(0, 6), [conversations, convoKey]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [convo?.turns.length, busy]);

  const planContext: PlanContext = useMemo(() => {
    const tasks = new Map(plan.tasks.map((t) => [t.id, t]));
    return {
      goal,
      upcoming: plan.schedule.blocks
        .filter((b) => new Date(b.endTime).getTime() > Date.now())
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .slice(0, 5)
        .map((b) => ({
          title: tasks.get(b.taskId)?.title ?? 'Task',
          when: new Date(b.startTime).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }),
          minutes: Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000),
        })),
      atRisk: [],
    };
  }, [plan, goal]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setText('');
    const base = convo ?? { ...newConversation('text'), topic_key: convoKey, title: question.slice(0, 80) };
    const you: Turn = { role: 'you', text: question, at: new Date().toISOString() };
    const withYou = { ...base, turns: [...base.turns, you] };
    setConvo(withYou);
    setBusy(true);
    try {
      const reply = await respond(question, {
        userId,
        plan: planContext,
        goal,
        history: withYou.turns,
        addTask,
        spare: { dueCards, weakSpots, jobs },
        agenda,
        focus: { topic, folderKey: folder.key, folderName: folder.name, subtopic, notes },
        library: [{ key: folder.key, name: folder.name, topic, subs: subtopic ? [subtopic] : [] }],
      });
      const ropi: Turn = { role: 'ropi', text: reply.text, at: new Date().toISOString(), kind: `${reply.intent}:${subtopic ?? topic}`, sources: reply.sources };
      const next = { ...withYou, topic_key: convoKey, turns: [...withYou.turns, ropi] };
      setReplies((r) => ({ ...r, [next.turns.length - 1]: reply }));
      setConvo(next);
      const stored = await saveConversation(next).catch(() => next);
      if (stored.id !== next.id) setConvo((c) => (c && c.id === next.id ? { ...c, id: stored.id } : c));
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const saveAsNote = async (i: number, body: string) => {
    await addTo(folder, subtopic, makeNote(body, null, 'ropi'));
    setSaved((s) => new Set(s).add(i));
    onChange();
  };

  const starters = subtopic
    ? [`Explain ${subtopic} simply`, 'Give me a real example', 'What do people usually get wrong here?', `Make a note of the key points of ${subtopic}`]
    : [`What should I learn first in ${folder.name}?`, `Explain the basics of ${topic}`, 'What have I been getting wrong?', `Make a note of the key ideas in ${topic}`];

  return (
    <Card className="overflow-hidden" data-ask-panel>
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4 sm:px-6">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Ask Ropi about {name}</h2>
        <div className="flex items-center gap-1">
          {convo && (
            <Button size="sm" variant="ghost" onClick={() => { setConvo(null); setReplies({}); setSaved(new Set()); }}>
              <Plus />
              New
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => navigate(`/talk?q=${encodeURIComponent(`Explain ${name} simply`)}`)}>
            <Mic />
            By voice
          </Button>
        </div>
      </div>

      {!convo && mine.length > 0 && (
        <div className="px-5 pb-2 sm:px-6">
          <div className="mb-1.5 text-[12px] text-muted-foreground">Pick up where you left off</div>
          <ul className="space-y-1">
            {mine.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setConvo(c);
                    setReplies({});
                    setSaved(new Set());
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-muted/60"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                    {day(c.started_at)} · {c.turns.length} msg
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {convo && (
        <div className="max-h-[420px] space-y-3 overflow-y-auto border-y bg-background/50 px-5 py-4 sm:px-6" aria-live="polite">
          {convo.turns.map((t, i) => (
            <div key={`${i}-${t.at}`} className={cn('flex', t.role === 'you' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[88%]', t.role === 'you' && 'text-right')}>
                <div
                  className={cn(
                    'inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left text-[13.5px] leading-relaxed',
                    t.role === 'you' ? 'rounded-br-md bg-foreground text-background' : 'rounded-bl-md border bg-card'
                  )}
                >
                  {t.text}
                </div>
                <div className="mt-1 flex items-center gap-3 px-1 text-[11px] text-muted-foreground">
                  <span>{time(t.at)}</span>
                  {t.role === 'ropi' && replies[i]?.intent !== 'note' && (
                    <button
                      disabled={saved.has(i)}
                      onClick={() => saveAsNote(i, t.text)}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:text-success disabled:no-underline"
                    >
                      {saved.has(i) ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {saved.has(i) ? 'Saved as a note' : 'Save as note'}
                    </button>
                  )}
                  {replies[i]?.open && (
                    <button onClick={() => navigate(replies[i].open!.href)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      {replies[i].open!.label}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Ropi is thinking
            </div>
          )}
          <div ref={bottom} />
        </div>
      )}

      {!convo && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-1 pt-1 sm:px-6">
          {starters.map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border bg-card px-3 py-1 text-[12.5px] text-foreground/85 transition-colors hover:border-primary/40 hover:bg-accent">
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex items-center gap-2 px-5 py-4 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={convo ? 'Ask a follow-up' : `Ask anything about ${name}`}
          aria-label={`Ask Ropi about ${name}`}
          className="h-10 min-w-0 flex-1 rounded-full border bg-background px-4 text-[13.5px] placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
        />
        <Button type="submit" className="rounded-full" disabled={!text.trim() || busy}>
          {busy ? <Loader2 className="animate-spin" /> : 'Ask'}
        </Button>
      </form>
    </Card>
  );
}
