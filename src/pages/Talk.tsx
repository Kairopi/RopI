/**
 * Talk to Ropi - hands-free, for the small gaps in a day.
 *
 * Tap once and talk: while you get dressed ("I'm lost, what does a project
 * charter mean?"), on the platform ("quiz me", "latest news on PMP",
 * "a podcast for my commute"), or between things ("find product manager jobs
 * in London", "help me answer 'why do you want this job'").
 *
 * Hands-free: after Ropi answers it listens again, until you say "stop" or go
 * quiet twice. Uses the browser's speech recognition and voices (pick one in
 * Voice); Meta Muse does the thinking. Every conversation is saved with the
 * time of each turn and filed under its topic.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, ExternalLink, Loader2, Mic, MicOff, Pause, Play, Plus, Volume2, VolumeX, X } from '@/components/icons';
import { useUserId } from '@/contexts/AuthContext';
import { usePlan } from '@/hooks/usePlan';
import { useWeek } from '@/hooks/useWeek';
import { speechManager, SpeechError } from '@/lib/voice/speech-manager';
import { respond, speakable, type Reply } from '@/lib/coach/brain';
import { newConversation, saveConversation, saveTopic, listTopics, topicKey, type Conversation, type Turn, type SavedLink } from '@/lib/library/store';
import { fetchJobDescription } from '@/lib/jobs/jobseek-client';
import { createJobApplication } from '@/lib/jobs/job-service';
import { SOURCES, type JobPosting } from '@/lib/jobs/sources';
import type { PlanContext } from '@/lib/knowledge/ask';
import { cn } from '@/lib/utils';

type State = 'idle' | 'listening' | 'thinking' | 'speaking';

const SUGGESTIONS = [
  'I’m lost. What does a project charter mean?',
  'Quiz me on my weakest topic',
  'Latest news on project management',
  'A podcast for my commute',
  'What should I do today?',
  'Find product manager jobs in London',
];

const STOP_WORDS = /^(stop|stop listening|that'?s all|thanks?,? (that'?s all|bye)|bye|goodbye|cancel|pause)\b/i;
const PLAY_WORDS = /\b(play (it|that|the (first|latest) one)|start (it|the episode))\b/i;

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// Voice preferences: which system voice and how fast
const PREF = 'ropi-voice-v1';
const loadPref = (): { voice?: string; rate: number; muted: boolean; handsFree: boolean } => {
  try {
    return { rate: 1, muted: false, handsFree: true, ...JSON.parse(localStorage.getItem(PREF) ?? '{}') };
  } catch {
    return { rate: 1, muted: false, handsFree: true };
  }
};

export default function Talk() {
  const navigate = useNavigate();
  const userId = useUserId();
  const reduce = useReducedMotion();
  const [params] = useSearchParams();
  const { plan } = usePlan();
  const goal = useWeek((s) => s.goal);
  const addTask = useWeek((s) => s.addTask);
  const support = speechManager.getSupport();

  const [state, setState] = useState<State>('idle');
  const [interim, setInterim] = useState('');
  const [typed, setTyped] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [convo, setConvo] = useState<Conversation>(() => newConversation('voice'));
  const [replies, setReplies] = useState<Record<number, Reply>>({});
  const [pref, setPref] = useState(loadPref);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showVoice, setShowVoice] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  const run = useRef(0);
  const silent = useRef(0);
  const repliesRef = useRef(replies);
  repliesRef.current = replies;
  const convoRef = useRef(convo);
  convoRef.current = convo;
  const prefRef = useRef(pref);
  prefRef.current = pref;
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(PREF, JSON.stringify(pref));
  }, [pref]);
  useEffect(() => {
    speechManager.getVoices().then((v) => setVoices(v.filter((x) => x.lang.toLowerCase().startsWith('en'))));
  }, []);
  // Braces matter: newer Chrome returns a Promise from scrollIntoView, and an effect must not return one
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [convo.turns.length, state, reduce]);
  // Leaving the page stops everything
  useEffect(
    () => () => {
      run.current++;
      speechManager.stopSpeaking();
      speechManager.stopListening();
    },
    []
  );

  const planContext: PlanContext = useMemo(() => {
    const tasks = new Map(plan.tasks.map((t) => [t.id, t]));
    const now = Date.now();
    return {
      goal: goal?.title ?? null,
      upcoming: plan.schedule.blocks
        .filter((b) => new Date(b.endTime).getTime() > now)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .slice(0, 5)
        .map((b) => ({
          title: tasks.get(b.taskId)?.title ?? 'Task',
          when: new Date(b.startTime).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }),
          minutes: Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000),
        })),
      atRisk: plan.schedule.atRiskTasks.map((r) => ({ title: tasks.get(r.taskId)?.title ?? 'Task', reason: r.reason })),
    };
  }, [plan, goal]);

  const say = useCallback(async (text: string, id: number) => {
    if (prefRef.current.muted || !support.tts) return;
    const voice = voices.find((v) => v.name === prefRef.current.voice);
    setState('speaking');
    try {
      await speechManager.speak(speakable(text), { rate: prefRef.current.rate, ...(voice ? { voice } : {}) });
    } catch {
      // speech output failed: the text is on screen
    }
    if (run.current !== id) return;
  }, [support.tts, voices]);

  /** Save the conversation and file it (and anything worth keeping) under its topic */
  const persist = useCallback(async (c: Conversation, reply?: Reply) => {
    try {
      const saved = await saveConversation(c);
      if (saved.id !== c.id) setConvo((cur) => (cur.id === c.id ? { ...cur, id: saved.id } : cur));
      if (reply?.topic && (reply.sources?.length || reply.podcasts?.length)) {
        const key = topicKey(reply.topic);
        const existing = (await listTopics()).find((t) => t.match_key === key && !t.parent_id);
        const now = new Date().toISOString();
        const links: SavedLink[] = [
          ...(reply.intent === 'news' ? (reply.sources ?? []).slice(0, 3).map((s) => ({ title: s.title, url: s.url, kind: 'article' as const, added_at: now, added_by: 'ropi' as const })) : []),
          ...(reply.podcasts ?? []).slice(0, 1).map((p) => ({ title: `${p.show}${p.episode ? `: ${p.episode.title}` : ''}`, url: p.episode?.url ?? p.showUrl, kind: 'podcast' as const, added_at: now, added_by: 'ropi' as const })),
        ];
        const have = new Set((existing?.links ?? []).map((l) => l.url));
        const fresh = links.filter((l) => !have.has(l.url));
        if (fresh.length) await saveTopic({ match_key: key, name: existing?.name ?? reply.topic, links: [...(existing?.links ?? []), ...fresh] });
      }
    } catch (e) {
      console.warn('Conversation not saved:', e);
    }
  }, []);

  const listen = useCallback(async () => {
    if (!support.stt) {
      setNotice('Voice needs Chrome, Edge or Safari. You can type below.');
      return;
    }
    const id = ++run.current;
    speechManager.stopSpeaking();
    setNotice(null);
    setInterim('');
    setState('listening');
    try {
      const heard = await speechManager.listenDetailed({ onInterim: setInterim });
      if (run.current !== id) return;
      silent.current = 0;
      setInterim('');
      await handleRef.current?.(heard.transcript, id);
    } catch (e) {
      if (run.current !== id) return;
      setInterim('');
      const code = e instanceof SpeechError ? e.code : '';
      if (code === 'no-speech' || code === 'aborted') {
        silent.current++;
        setState('idle');
        setNotice(silent.current >= 2 ? 'Paused while it’s quiet. Tap to talk again.' : 'I didn’t catch anything. Tap to try again.');
      } else if (code === 'not-allowed' || code === 'service-not-allowed') {
        setState('idle');
        setNotice('The microphone is blocked. Allow it in your browser’s address bar, or type below.');
      } else {
        setState('idle');
        setNotice('Voice stopped. Tap to talk again.');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [support.stt]);

  const handle = useCallback(
    async (raw: string, id = ++run.current) => {
      const text = raw.trim();
      if (!text) return;

      // Voice commands that don't need a reply
      if (STOP_WORDS.test(text)) {
        run.current++;
        speechManager.stopSpeaking();
        setState('idle');
        setNotice('Stopped. Tap to talk again.');
        return;
      }
      const lastReply = Object.entries(repliesRef.current).sort((a, b) => Number(b[0]) - Number(a[0]))[0]?.[1];
      if (PLAY_WORDS.test(text) && lastReply?.podcasts?.[0]?.episode?.audioUrl) {
        setPlaying(lastReply.podcasts[0].episode.audioUrl);
        setState('idle');
        return;
      }

      const you: Turn = { role: 'you', text, at: new Date().toISOString() };
      const withYou: Conversation = {
        ...convoRef.current,
        title: convoRef.current.turns.length ? convoRef.current.title : text.slice(0, 80),
        turns: [...convoRef.current.turns, you],
      };
      setConvo(withYou);
      setState('thinking');

      const reply = await respond(text, { userId, plan: planContext, goal: goal?.title ?? null, history: withYou.turns, addTask });
      if (run.current !== id) return;

      const ropi: Turn = { role: 'ropi', text: reply.text, at: new Date().toISOString(), kind: `${reply.intent}:${reply.topic ?? ''}`, sources: reply.sources };
      const next: Conversation = {
        ...withYou,
        topic_key: withYou.topic_key ?? (reply.topic ? topicKey(reply.topic) : null),
        turns: [...withYou.turns, ropi],
      };
      setReplies((r) => ({ ...r, [next.turns.length - 1]: reply }));
      setConvo(next);
      void persist(next, reply);

      await say(reply.text, id);
      if (run.current !== id) return;

      if (reply.open?.auto) {
        navigate(reply.open.href);
        return;
      }
      if (prefRef.current.handsFree && support.stt && !prefRef.current.muted) void listenRef.current?.();
      else setState('idle');
    },
    [userId, planContext, goal, addTask, persist, say, navigate, support.stt]
  );
  // listen() and handle() call each other: go through refs so neither holds stale state
  const handleRef = useRef(handle);
  handleRef.current = handle;
  const listenRef = useRef(listen);
  listenRef.current = listen;

  // Opened with ?q= (e.g. from a topic folder): ask it straight away
  const asked = useRef(false);
  useEffect(() => {
    const q = params.get('q');
    if (q && !asked.current && userId) {
      asked.current = true;
      void handle(q);
    }
  }, [params, userId, handle]);

  const stop = () => {
    run.current++;
    speechManager.stopSpeaking();
    speechManager.stopListening();
    setInterim('');
    setState('idle');
  };

  const fresh = () => {
    stop();
    setConvo(newConversation('voice'));
    setReplies({});
    setNotice(null);
  };

  const main = () => (state === 'idle' ? void listen() : stop());
  const empty = convo.turns.length === 0;

  return (
    <DashboardLayout>
      <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-2xl flex-col">
        {/* Header */}
        <div className="mb-2 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Talk to Ropi</div>
            {!empty && <div className="truncate text-[12.5px] text-muted-foreground">Started {fmtTime(convo.started_at)} · saved as you go</div>}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowVoice((s) => !s)} aria-expanded={showVoice}>
            {pref.muted ? <VolumeX /> : <Volume2 />}
            Voice
          </Button>
          {!empty && (
            <Button size="sm" variant="ghost" onClick={fresh}>
              <Plus />
              New
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showVoice && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mb-3 grid gap-3 rounded-xl border bg-card p-4 text-[12.5px] sm:grid-cols-[1.4fr_1fr_auto]">
                <label className="text-muted-foreground">
                  Ropi’s voice
                  <select
                    value={pref.voice ?? ''}
                    onChange={(e) => setPref((p) => ({ ...p, voice: e.target.value || undefined }))}
                    className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-[13px] text-foreground"
                  >
                    <option value="">Best available</option>
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name.replace(/^(Microsoft|Google)\s/, '')} ({v.lang})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-muted-foreground">
                  Speed
                  <select value={pref.rate} onChange={(e) => setPref((p) => ({ ...p, rate: Number(e.target.value) }))} className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-[13px] text-foreground">
                    <option value={0.85}>Slower</option>
                    <option value={1}>Normal</option>
                    <option value={1.15}>Faster</option>
                  </select>
                </label>
                <div className="flex flex-col justify-end gap-1.5">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={pref.handsFree} onChange={(e) => setPref((p) => ({ ...p, handsFree: e.target.checked }))} />
                    Keep listening
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={pref.muted} onChange={(e) => setPref((p) => ({ ...p, muted: e.target.checked }))} />
                    Text only
                  </label>
                </div>
                <button
                  className="text-left text-[12px] font-medium text-primary hover:underline sm:col-span-3"
                  onClick={() => {
                    const voice = voices.find((v) => v.name === pref.voice);
                    void speechManager.speak('Hi, I’m Ropi. Tell me what you need.', { rate: pref.rate, ...(voice ? { voice } : {}) });
                  }}
                >
                  Hear this voice
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation */}
        <div className="flex-1 space-y-5 py-4" aria-live="polite">
          {empty && (
            <div className="pt-6 text-center">
              <h1 className="text-[26px] font-semibold leading-tight">What do you need right now?</h1>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
                Tap the mic and talk. Ask what something means, get quizzed, catch up on news, find a podcast or jobs, or get help with an application.
              </p>
              <div className="mx-auto mt-6 flex max-w-lg flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => handle(s)} className="rounded-full border bg-card px-3 py-1.5 text-[12.5px] text-foreground/85 transition-colors hover:border-primary/40 hover:bg-accent">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {convo.turns.map((t, i) => (
            <motion.div key={`${i}-${t.at}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex', t.role === 'you' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[88%]', t.role === 'you' ? 'text-right' : '')}>
                <div
                  className={cn(
                    'inline-block rounded-2xl px-4 py-2.5 text-left text-[14.5px] leading-relaxed',
                    t.role === 'you' ? 'rounded-br-md bg-foreground text-background' : 'rounded-bl-md border bg-card'
                  )}
                >
                  {t.text}
                </div>
                <div className="mt-1 px-1 text-[11px] text-muted-foreground">{fmtTime(t.at)}</div>
                {t.role === 'ropi' && replies[i] && <ReplyExtras reply={replies[i]} userId={userId} playing={playing} setPlaying={setPlaying} onOpen={(href) => { stop(); navigate(href); }} />}
              </div>
            </motion.div>
          ))}

          {state === 'thinking' && (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Ropi is working on it
            </div>
          )}
          <div ref={bottom} />
        </div>

        {/* Mic: big and centred to start, a compact bar once you're talking */}
        <div className={cn('sticky bottom-0 z-10', empty ? 'pb-4 pt-6' : 'border-t bg-[hsl(60_8%_98.6%)]/95 pb-3 pt-3 backdrop-blur-sm')}>
          <div className={cn('flex flex-col', empty && 'items-center')}>
            <div className={cn('min-h-[20px] text-[13px]', empty ? 'mb-3 max-w-md text-center' : 'mb-2 px-1')}>
              {state === 'listening' ? (
                <span className={interim ? 'text-foreground' : 'text-muted-foreground'}>{interim || 'Listening…'}</span>
              ) : state === 'speaking' ? (
                <span className="text-muted-foreground">Ropi is talking. Tap the button to stop.</span>
              ) : notice ? (
                <span className="text-muted-foreground">{notice}</span>
              ) : (
                <span className="text-muted-foreground">{support.stt ? 'Tap the mic and talk' : 'Type your question below'}</span>
              )}
            </div>
            {empty && <MicButton state={state} onClick={main} disabled={!support.stt && state === 'idle'} big reduce={!!reduce} />}

            <form
              className={cn('flex w-full items-center gap-2 rounded-full border bg-card py-1 pl-4 pr-1', empty ? 'mt-4 max-w-md' : '')}
              onSubmit={(e) => {
                e.preventDefault();
                const t = typed;
                setTyped('');
                void handle(t);
              }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Or type here"
                aria-label="Type to Ropi"
                className="h-9 min-w-0 flex-1 bg-transparent text-[14px] placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none"
              />
              <Button type="submit" size="sm" variant={empty ? 'default' : 'ghost'} className="rounded-full" disabled={!typed.trim() || state === 'thinking'}>
                Send
              </Button>
              {!empty && <MicButton state={state} onClick={main} disabled={!support.stt && state === 'idle'} reduce={!!reduce} />}
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function MicButton({ state, onClick, disabled, big = false, reduce }: { state: State; onClick: () => void; disabled: boolean; big?: boolean; reduce: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={state === 'idle' ? 'Talk to Ropi' : 'Stop'}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full text-primary-foreground transition-transform active:scale-95 disabled:opacity-40',
        big ? 'h-20 w-20 shadow-float' : 'h-10 w-10',
        state === 'listening' ? 'bg-destructive' : state === 'idle' ? 'bg-primary' : 'bg-foreground'
      )}
    >
      {state === 'listening' && !reduce && <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />}
      {state === 'thinking' ? (
        <Loader2 className={cn('animate-spin', big ? 'h-8 w-8' : 'h-5 w-5')} />
      ) : state === 'idle' ? (
        <Mic className={big ? 'h-8 w-8' : 'h-5 w-5'} />
      ) : state === 'listening' ? (
        <MicOff className={big ? 'h-8 w-8' : 'h-5 w-5'} />
      ) : (
        <Pause className={big ? 'h-8 w-8' : 'h-5 w-5'} />
      )}
    </button>
  );
}

function ReplyExtras({
  reply,
  userId,
  playing,
  setPlaying,
  onOpen,
}: {
  reply: Reply;
  userId: string;
  playing: string | null;
  setPlaying: (u: string | null) => void;
  onOpen: (href: string) => void;
}) {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const saveJob = async (p: JobPosting) => {
    setSaving(p.key);
    try {
      const description = p.description ?? (p.jobSeekId ? await fetchJobDescription(p.jobSeekId) : null);
      await createJobApplication(userId, { job_title: p.title, company: p.company, location: p.location, description: description ?? '', job_url: p.url, source: p.source });
      setSaved((s) => new Set(s).add(p.key));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mt-2 space-y-2 text-left">
      {reply.added && (
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-2.5 py-1 text-[12px] text-success">
          <Check className="h-3.5 w-3.5" />
          Added to your week
        </div>
      )}

      {reply.draft && (
        <div className="rounded-xl border bg-card p-3">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{reply.draft}</p>
          <button
            className="mt-2 text-[12px] font-medium text-primary hover:underline"
            onClick={() => {
              void navigator.clipboard.writeText(reply.draft!);
              setCopied(true);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {reply.podcasts?.map((p) => (
        <div key={p.showUrl} className="flex items-start gap-3 rounded-xl border bg-card p-3">
          {p.artwork ? <img src={p.artwork} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" /> : <span className="h-12 w-12 shrink-0 rounded-lg bg-muted" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{p.show}</div>
            {p.episode && (
              <div className="truncate text-[12px] text-muted-foreground">
                {p.episode.title} · {p.episode.minutes} min · {new Date(p.episode.released).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
            {p.episode?.audioUrl && playing === p.episode.audioUrl && <audio src={p.episode.audioUrl} controls autoPlay className="mt-2 h-9 w-full" />}
          </div>
          {p.episode?.audioUrl && (
            <Button size="sm" variant="outline" onClick={() => setPlaying(playing === p.episode!.audioUrl ? null : p.episode!.audioUrl!)} aria-label={`Play ${p.episode.title}`}>
              {playing === p.episode.audioUrl ? <X /> : <Play />}
            </Button>
          )}
          <a href={p.episode?.url ?? p.showUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in Apple Podcasts" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ))}

      {reply.jobs && reply.jobs.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {reply.jobs.map((p) => (
            <li key={p.key} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{p.title}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">
                  {[p.company, p.location].filter(Boolean).join(' · ')} ·{' '}
                  <a href={p.url} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-foreground">
                    {SOURCES[p.source].name}
                  </a>
                </div>
              </div>
              <Button size="sm" variant={saved.has(p.key) ? 'ghost' : 'outline'} disabled={saved.has(p.key) || saving === p.key} onClick={() => saveJob(p)}>
                {saving === p.key ? <Loader2 className="animate-spin" /> : saved.has(p.key) ? <Check /> : <Plus />}
                {saved.has(p.key) ? 'Saved' : 'Save'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {reply.sources && reply.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {reply.sources.map((s) =>
            s.url.startsWith('/') ? (
              <button key={s.url} onClick={() => onOpen(s.url)} className="max-w-[260px] truncate rounded-full border bg-card px-2.5 py-1 text-[11.5px] text-muted-foreground hover:text-foreground">
                {s.title}
              </button>
            ) : (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[260px] items-center gap-1 truncate rounded-full border bg-card px-2.5 py-1 text-[11.5px] text-muted-foreground hover:text-foreground">
                <span className="truncate">{s.title || new URL(s.url).hostname}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )
          )}
        </div>
      )}

      {reply.open && (
        <Button size="sm" variant={reply.open.auto ? 'default' : 'outline'} onClick={() => onOpen(reply.open!.href)}>
          {reply.open.label}
          <ArrowRight />
        </Button>
      )}
    </div>
  );
}
