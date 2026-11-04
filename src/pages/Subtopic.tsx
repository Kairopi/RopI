/**
 * One subtopic, everything in one place: how you're doing on it, your notes,
 * the questions you've missed (with answers, so you can test yourself), saved
 * resources, and a conversation with Ropi about just this.
 *
 * /learn/topic/:key/:sub  (sub = the subtopic's key)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Panel } from '@/components/Panel';
import { AskPanel } from '@/components/AskPanel';
import { NotesPanel } from '@/components/NotesPanel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, BookOpen, Brain, CalendarClock, Check, ChevronDown, ExternalLink, Loader2, Mic, Plus, Trash2 } from '@/components/icons';
import { useUserId } from '@/contexts/AuthContext';
import { useWeek } from '@/hooks/useWeek';
import { supabase } from '@/lib/supabase';
import { callMuse, isMuseConfigured, MUSE_MODELS } from '@/lib/api/muse';
import { loadFolders, type Subtopic as Sub, type TopicFolder } from '@/lib/library/topics';
import { addTo, subtopicKey, updateIn } from '@/lib/library/notes';
import { prefetchTopicQuiz } from '@/lib/learning/topic-quiz';
import { topicKey, type SavedLink } from '@/lib/library/store';
import { cn } from '@/lib/utils';

interface Missed {
  id: string;
  question: string;
  answer: string;
  due_date: string | null;
}

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const tone = (a: number) => (a >= 80 ? 'bg-success' : a >= 50 ? 'bg-warning' : 'bg-destructive');
const tonight = () => {
  const d = new Date();
  d.setHours(22, 0, 0, 0);
  return d.toISOString();
};

export default function Subtopic() {
  const { key = '', sub = '' } = useParams();
  const navigate = useNavigate();
  const userId = useUserId();
  const addTask = useWeek((s) => s.addTask);
  const [folder, setFolder] = useState<TopicFolder | null | undefined>(undefined);
  const [missed, setMissed] = useState<Missed[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [link, setLink] = useState({ title: '', url: '' });
  const [planned, setPlanned] = useState(false);

  const folderKey = decodeURIComponent(key);
  const subKey = decodeURIComponent(sub);

  const load = useCallback(async () => {
    const all = await loadFolders(userId);
    setFolder(all.find((f) => f.key === folderKey) ?? null);
  }, [userId, folderKey]);
  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  const s: Sub | null = useMemo(() => folder?.subs.find((x) => x.key === subKey) ?? null, [folder, subKey]);

  // The questions you got wrong on this subtopic (each one became a review card)
  useEffect(() => {
    if (!folder || !s) return;
    supabase
      .from('concept_cards')
      .select('id, question, answer, due_date, subtopic, topic')
      .eq('user_id', userId)
      .eq('topic', folder.topic)
      .then(({ data }) => setMissed(((data ?? []) as (Missed & { subtopic: string | null })[]).filter((c) => c.subtopic && topicKey(c.subtopic) === s.key)));
  }, [folder, s, userId]);

  if (folder === undefined) {
    return (
      <DashboardLayout>
        <div className="flex items-center gap-2 py-16 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening
        </div>
      </DashboardLayout>
    );
  }
  if (!folder || !s) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="text-[18px] font-semibold">This subtopic is empty or gone</h1>
          <Button className="mt-5" onClick={() => navigate(folder ? `/learn/topic/${encodeURIComponent(folder.key)}` : '/learning')}>
            Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const here = { key: folder.key, name: folder.name };
  const selfHref = `/learn/topic/${encodeURIComponent(folder.key)}/${encodeURIComponent(s.key)}`;
  const quizHref = `/quiz/new?topic=${encodeURIComponent(folder.topic)}&focus=${encodeURIComponent(s.name)}`;
  const acc = s.concept ? Math.round(s.concept.accuracy) : null;

  const summarize = async () => {
    if (!isMuseConfigured()) throw new Error('Meta Muse is not set up, so Ropi can’t write this.');
    const out = await callMuse(
      `Write a short study note: "What I know so far about ${s.name}" (part of ${folder.name}).
Use what this learner has, nothing else beyond a standard textbook explanation:
${s.concept ? `Quiz accuracy on it: ${acc}% over ${s.concept.attempts} question${s.concept.attempts === 1 ? '' : 's'}.` : 'No quiz on it yet.'}
Questions they got wrong (with the right answers):
${missed.slice(0, 6).map((m) => `- Q: ${m.question}\n  A: ${m.answer.slice(0, 300)}`).join('\n') || '(none)'}
Their notes:
${s.notes.slice(0, 6).map((n) => `- ${n.note ?? n.title}`).join('\n') || '(none)'}

4 to 6 short lines starting with "- ": the core idea in plain words, what they already get right, what they keep missing and the correct version, and one thing to practise next. Plain text, no other markdown.
Return ONLY JSON: {"note": "..."}`,
      { model: MUSE_MODELS.fast, reasoningEffort: 'minimal', json: true, maxTokens: 3000, timeoutMs: 30000 }
    );
    return String(JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? out).note ?? '').trim();
  };

  const addLink = async () => {
    const url = link.url.trim();
    if (!/^https?:\/\//i.test(url)) return;
    const entry: SavedLink = {
      title: link.title.trim() || new URL(url).hostname,
      url,
      kind: /youtube|youtu\.be|vimeo/i.test(url) ? 'video' : /podcast|spotify/i.test(url) ? 'podcast' : 'article',
      added_at: new Date().toISOString(),
      added_by: 'you',
    };
    setLink({ title: '', url: '' });
    await addTo(here, s.name, entry);
    await load();
  };

  return (
    <DashboardLayout>
      <button onClick={() => navigate(`/learn/topic/${encodeURIComponent(folder.key)}`)} className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        {folder.name}
      </button>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight">{s.name}</h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            {[
              acc !== null ? `${acc}% right over ${s.concept!.attempts} question${s.concept!.attempts === 1 ? '' : 's'}` : 'Not quizzed yet',
              s.notes.length ? `${s.notes.length} note${s.notes.length === 1 ? '' : 's'}` : null,
              missed.length ? `${missed.length} missed question${missed.length === 1 ? '' : 's'}` : null,
              s.conversations.length ? `${s.conversations.length} conversation${s.conversations.length === 1 ? '' : 's'}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {acc !== null && (
            <div className="mt-2.5 h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', tone(acc))} style={{ width: `${Math.max(3, acc)}%` }} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onPointerEnter={() => prefetchTopicQuiz(folder.topic, s.name)} onFocus={() => prefetchTopicQuiz(folder.topic, s.name)} onClick={() => navigate(quizHref)}>
            <BookOpen />
            Quiz me on this
          </Button>
          <Button variant="outline" onClick={() => navigate(`/voice-quiz?quiz=new&topic=${encodeURIComponent(folder.topic)}&focus=${encodeURIComponent(s.name)}&start=1`)}>
            <Mic />
            By voice
          </Button>
          {s.dueCards > 0 ? (
            <Button variant="ghost" onClick={() => navigate('/reviews', { state: { topic: folder.topic } })}>
              <Brain />
              Review {s.dueCards} due
            </Button>
          ) : (
            <Button
              variant="ghost"
              disabled={planned}
              onClick={() => {
                addTask({ title: `Practise: ${s.name}`, duration: 15, priority: 'P2', deadline: tonight(), category: 'learning', tags: ['study'], href: selfHref });
                setPlanned(true);
              }}
            >
              {planned ? <Check /> : <CalendarClock />}
              {planned ? 'On today’s plan' : 'Practise today'}
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <AskPanel
          folder={here}
          subtopic={s.name}
          topic={folder.topic}
          convoKey={subtopicKey(folder.key, s.name)}
          conversations={s.conversations}
          notes={s.notes.map((n) => n.note ?? n.title)}
          onChange={load}
        />

        <div className="space-y-5">
          <NotesPanel id={`sub-notes`} folder={here} subtopic={s.name} notes={s.notes} practiceHref={selfHref} onChange={load} summarize={summarize} />

          <Panel
            id="sub-missed"
            title="Questions you missed"
            meta={missed.length ? String(missed.length) : undefined}
            summary={missed.length ? 'Tap one to see the answer' : 'None yet'}
          >
            {missed.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Every question you get wrong on {s.name} lands here with the right answer, and comes back in your reviews.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {missed.map((m) => {
                  const isOpen = open.has(m.id);
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}
                        aria-expanded={isOpen}
                        className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-muted/40"
                      >
                        <span className="min-w-0 flex-1 text-[13.5px]">{m.question}</span>
                        <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                      </button>
                      {isOpen && <p className="whitespace-pre-wrap border-t border-dashed bg-success/[0.05] px-3.5 py-3 text-[13px] leading-relaxed">{m.answer}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel id="sub-links" title="Resources" meta={s.links.length ? String(s.links.length) : undefined} summary={s.links.map((l) => l.title).join(' · ') || 'Links, videos, a project repo'}>
            {s.links.length > 0 && (
              <ul className="mb-3 divide-y rounded-xl border">
                {[...s.links].reverse().map((l) => (
                  <li key={l.url} className="flex items-center gap-3 px-3.5 py-2.5">
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 flex-1 items-center gap-1 truncate text-[13.5px] font-medium hover:underline">
                      <span className="truncate">{l.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">{l.kind} · {when(l.added_at)}</span>
                    <button aria-label={`Remove ${l.title}`} onClick={() => updateIn(here, s.name, l.url, null).then(load)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="grid gap-2 sm:grid-cols-[1fr_1.3fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                void addLink();
              }}
            >
              <Input value={link.title} onChange={(e) => setLink((x) => ({ ...x, title: e.target.value }))} placeholder="Title (optional)" aria-label="Resource title" />
              <Input value={link.url} onChange={(e) => setLink((x) => ({ ...x, url: e.target.value }))} placeholder="https://" aria-label="Resource link" type="url" />
              <Button type="submit" variant="outline" disabled={!/^https?:\/\//i.test(link.url.trim())}>
                <Plus />
                Save
              </Button>
            </form>
          </Panel>
        </div>
      </div>

      {folder.sources.length > 0 && (
        <Card className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-[12.5px] text-muted-foreground">
          <span>Documents in {folder.name}:</span>
          {folder.sources.slice(0, 4).map((d) => (
            <button key={d.id} onClick={() => navigate(`/learn/doc/${d.id}`)} className="font-medium text-foreground hover:text-primary">
              {d.title}
            </button>
          ))}
        </Card>
      )}
    </DashboardLayout>
  );
}
