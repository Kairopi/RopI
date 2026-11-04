/**
 * One topic folder: everything about "Intro to project management" in one place.
 *
 * Subtopics (what your quizzes score, plus your own), documents, quizzes with
 * date and time, conversations with Ropi (every turn timed), and links you or
 * Ropi saved. Rename it, add subtopics and links, or ask Ropi about it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Panel, setPanelOpen } from '@/components/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, BookOpen, Brain, ChevronDown, ExternalLink, FileText, Loader2, MessageSquare, Mic, Plus, Trash2 } from '@/components/icons';
import { useUserId } from '@/contexts/AuthContext';
import { BUILT_IN_QUIZ_LIST } from '@/lib/mock/quizzes';
import { loadFolders, type TopicFolder } from '@/lib/library/topics';
import { DocumentUpload, type ParsedDocument } from '@/components/documents/DocumentUpload';
import { saveSource } from '@/lib/documents/sources';
import { deleteTopic, saveTopic, storageMode, topicKey, type SavedLink } from '@/lib/library/store';
import { cn } from '@/lib/utils';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const tone = (p: number) => (p >= 85 ? 'bg-success' : p >= 70 ? 'bg-primary' : p >= 50 ? 'bg-warning' : 'bg-destructive');

export default function Topic() {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const userId = useUserId();
  const [folder, setFolder] = useState<TopicFolder | null | undefined>(undefined);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [sub, setSub] = useState('');
  const [link, setLink] = useState({ title: '', url: '' });
  const [openConvo, setOpenConvo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const all = await loadFolders(userId);
    const f = all.find((x) => x.key === decodeURIComponent(key)) ?? null;
    setFolder(f);
    if (f) setName(f.name);
  }, [userId, key]);
  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  const quizHref = useMemo(() => {
    if (!folder) return '/learning';
    const built = BUILT_IN_QUIZ_LIST.find((q) => topicKey(q.topic) === folder.key);
    return built ? `/quiz/${built.id}` : `/quiz/new?topic=${encodeURIComponent(folder.topic)}`;
  }, [folder]);

  if (folder === undefined) {
    return (
      <DashboardLayout>
        <div className="flex items-center gap-2 py-16 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening the folder
        </div>
      </DashboardLayout>
    );
  }
  if (folder === null) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="text-[18px] font-semibold">This folder is empty or gone</h1>
          <Button className="mt-5" onClick={() => navigate('/learning')}>
            Back to Learn
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const ensureRow = async (patch: Partial<Parameters<typeof saveTopic>[0]>) => {
    setBusy(true);
    try {
      await saveTopic({ name: folder.name, ...patch, match_key: folder.key });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const addLink = () => {
    const url = link.url.trim();
    if (!/^https?:\/\//i.test(url)) return;
    const entry: SavedLink = { title: link.title.trim() || new URL(url).hostname, url, kind: /podcast|spotify|apple\.com\/.*podcast/i.test(url) ? 'podcast' : /youtube|youtu\.be|vimeo/i.test(url) ? 'video' : 'article', added_at: new Date().toISOString(), added_by: 'you' };
    setLink({ title: '', url: '' });
    void ensureRow({ match_key: folder.key, links: [...folder.links, entry] });
  };

  const counts = [
    folder.confidence !== null ? `${folder.confidence}% confidence` : null,
    folder.attempts.length ? `${folder.attempts.length} quiz${folder.attempts.length === 1 ? '' : 'zes'}` : null,
    folder.sources.length ? `${folder.sources.length} document${folder.sources.length === 1 ? '' : 's'}` : null,
    folder.conversations.length ? `${folder.conversations.length} conversation${folder.conversations.length === 1 ? '' : 's'}` : null,
    folder.links.length ? `${folder.links.length} saved` : null,
  ].filter(Boolean);

  return (
    <DashboardLayout>
      <button onClick={() => navigate('/learning')} className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Learn
      </button>

      {/* Header */}
      <header className="mb-6">
        {renaming ? (
          <form
            className="flex max-w-lg items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setRenaming(false);
              if (name.trim() && name.trim() !== folder.name) void ensureRow({ match_key: folder.key, name: name.trim() });
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Folder name" autoFocus maxLength={120} className="h-11 text-[18px] font-semibold" />
            <Button type="submit" size="sm">
              Save
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="text-[28px] font-semibold leading-tight">{folder.name}</h1>
            <button onClick={() => setRenaming(true)} className="text-[12.5px] text-muted-foreground hover:text-foreground">
              Rename
            </button>
          </div>
        )}
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
          {counts.join(' · ') || 'Nothing in here yet'}
          {folder.lastActivity && ` · last active ${when(folder.lastActivity)}`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => navigate(quizHref)}>
            <BookOpen />
            Quiz me
          </Button>
          <Button variant="outline" onClick={() => navigate(`/voice-quiz?quiz=new&topic=${encodeURIComponent(folder.topic)}`)}>
            <Mic />
            Voice quiz
          </Button>
          <Button variant="outline" onClick={() => navigate(`/talk?q=${encodeURIComponent(`Explain the basics of ${folder.topic} simply`)}`)}>
            <MessageSquare />
            Ask Ropi about it
          </Button>
          {folder.dueCards > 0 && (
            <Button variant="ghost" onClick={() => navigate('/reviews', { state: { topic: folder.topic } })}>
              <Brain />
              Review {folder.dueCards} due
            </Button>
          )}
        </div>
      </header>

      <div className="space-y-5">
        {/* Subtopics */}
        <Panel id="topic-subtopics" title="Subtopics" meta={folder.concepts.length + folder.subfolders.length ? String(folder.concepts.length + folder.subfolders.length) : undefined} summary={folder.concepts.map((c) => c.concept).join(' · ') || 'None yet'}>
          {folder.concepts.length > 0 && (
            <ul className="mb-4 space-y-3">
              {folder.concepts.map((c) => (
                <li key={c.concept}>
                  <div className="flex items-center gap-3 text-[13.5px]">
                    <span className="min-w-0 flex-1 truncate font-medium">{c.concept}</span>
                    <span className="tabular-nums text-muted-foreground">{Math.round(c.accuracy)}%</span>
                    <button onClick={() => navigate(`/quiz/new?topic=${encodeURIComponent(folder.topic)}&focus=${encodeURIComponent(c.concept)}`)} className="text-[12px] font-medium text-primary hover:underline">
                      Practice
                    </button>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', tone(c.accuracy))} style={{ width: `${Math.max(3, c.accuracy)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {folder.subfolders.length > 0 && (
            <ul className="mb-4 divide-y rounded-xl border">
              {folder.subfolders.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3.5 py-2.5 text-[13.5px]">
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <button onClick={() => navigate(`/quiz/new?topic=${encodeURIComponent(folder.topic)}&focus=${encodeURIComponent(s.name)}`)} className="text-[12px] font-medium text-primary hover:underline">
                    Quiz me
                  </button>
                  <button aria-label={`Remove ${s.name}`} onClick={() => deleteTopic(s.id).then(load)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex max-w-md gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const n = sub.trim();
              if (!n) return;
              setSub('');
              setBusy(true);
              try {
                const parent = folder.row ?? (await saveTopic({ match_key: folder.key, name: folder.name }));
                await saveTopic({ match_key: topicKey(n), parent_id: parent.id, name: n });
                await load();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Add a subtopic, e.g. Stakeholder mapping" aria-label="New subtopic" maxLength={120} />
            <Button type="submit" variant="outline" disabled={!sub.trim() || busy}>
              <Plus />
              Add
            </Button>
          </form>
        </Panel>

        {/* Documents */}
        <Panel id="topic-docs" defaultOpen={folder.sources.length > 0} title="Documents" meta={folder.sources.length ? String(folder.sources.length) : undefined} summary={folder.sources.map((s) => s.title).join(' · ') || 'None yet'} actions={<Button size="sm" variant="ghost" onClick={() => { setPanelOpen('topic-docs', true); setUploading((u) => !u); }} aria-expanded={uploading}><Plus />Upload</Button>}>
          {uploading && (
            <div className="mb-4">
              <DocumentUpload
                compact
                onDocumentParsed={async (d: ParsedDocument) => {
                  setUploadNote('Saving it in this folder...');
                  try {
                    const title = d.fileName.replace(/\.(pdf|docx?)$/i, '');
                    const r = await saveSource({ title, topic: folder.topic, fileName: d.fileName, fileType: d.fileType, text: d.text, pages: d.pages });
                    setUploadNote(r.existing ? 'You already had this one. It’s below.' : `Saved in ${folder.name}.`);
                    setUploading(false);
                    await load();
                  } catch (e) {
                    setUploadNote(e instanceof Error ? e.message : 'Could not save it');
                  }
                }}
              />
            </div>
          )}
          {uploadNote && <p className="mb-3 text-[12.5px] text-muted-foreground" role="status">{uploadNote}</p>}
          {folder.sources.length === 0 ? (
            !uploading && <p className="text-[13px] text-muted-foreground">Upload your notes (PDF or DOCX) into this folder, and Ropi quizzes you on them with quotes from the page.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {folder.sources.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3.5 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <button className="min-w-0 flex-1 text-left hover:[&>div:first-child]:text-primary" onClick={() => navigate(`/learn/doc/${s.id}`)}>
                    <div className="truncate text-[13.5px] font-medium">{s.title}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{[s.summary, `added ${when(s.created_at)}`].filter(Boolean).join(' · ')}</div>
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/learn/doc/${s.id}`)}>
                    Read
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/quiz/new?source=${s.id}`)}>
                    Quiz me
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Quizzes */}
        <Panel id="topic-quizzes" defaultOpen={folder.attempts.length > 0} title="Quizzes" meta={folder.attempts.length ? String(folder.attempts.length) : undefined} summary={folder.attempts[0] ? `Last: ${folder.attempts[0].score}% on ${when(folder.attempts[0].created_at)}` : 'None yet'}>
          {folder.attempts.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No quizzes on this yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {folder.attempts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className={cn('num flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12.5px] font-semibold', a.score >= 85 ? 'bg-success/10 text-success' : a.score >= 70 ? 'bg-primary/10 text-primary' : 'bg-warning/15 text-warning-ink')}>
                    {a.score}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px]">
                      {a.correct_answers}/{a.total_questions} right{a.quiz_mode === 'voice' ? ' · by voice' : ''}
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {when(a.created_at)}
                      {a.weak_spots?.length ? ` · weak: ${a.weak_spots.join(', ')}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Conversations */}
        <Panel id="topic-talks" defaultOpen={folder.conversations.length > 0} title="Conversations with Ropi" meta={folder.conversations.length ? String(folder.conversations.length) : undefined} summary={folder.conversations[0] ? `Last: ${when(folder.conversations[0].started_at)}` : 'None yet'}>
          {folder.conversations.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Talk to Ropi about this topic and the conversation is kept here, with the time of every message.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {folder.conversations.map((c) => {
                const open = openConvo === c.id;
                return (
                  <li key={c.id}>
                    <button onClick={() => setOpenConvo(open ? null : c.id)} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-muted/40">
                      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{c.title}</span>
                        <span className="block text-[12px] text-muted-foreground">
                          {when(c.started_at)} · {c.turns.length} message{c.turns.length === 1 ? '' : 's'} · {c.mode}
                        </span>
                      </span>
                      <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
                    </button>
                    {open && (
                      <ol className="space-y-2.5 border-t border-dashed bg-background/60 px-4 py-3">
                        {c.turns.map((t, i) => (
                          <li key={i} className="text-[13px]">
                            <span className="mr-2 text-[11px] tabular-nums text-muted-foreground">{new Date(t.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                            <span className="font-medium">{t.role === 'you' ? 'You' : 'Ropi'}:</span> <span className="text-foreground/85">{t.text}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Saved */}
        <Panel id="topic-saved" title="Saved for later" meta={folder.links.length ? String(folder.links.length) : undefined} summary={folder.links.map((l) => l.title).join(' · ') || 'None yet'}>
          {folder.links.length > 0 && (
            <ul className="mb-4 divide-y rounded-xl border">
              {[...folder.links].reverse().map((l) => (
                <li key={l.url} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-[13.5px] font-medium hover:underline">
                      <span className="truncate">{l.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                    <div className="text-[12px] text-muted-foreground">
                      {l.kind} · {l.added_by === 'ropi' ? 'saved by Ropi' : 'you saved'} {when(l.added_at)}
                    </div>
                  </div>
                  <button aria-label={`Remove ${l.title}`} onClick={() => ensureRow({ match_key: folder.key, links: folder.links.filter((x) => x.url !== l.url) })} className="text-muted-foreground hover:text-destructive">
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
              addLink();
            }}
          >
            <Input value={link.title} onChange={(e) => setLink((l) => ({ ...l, title: e.target.value }))} placeholder="Title (optional)" aria-label="Link title" />
            <Input value={link.url} onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))} placeholder="https://" aria-label="Link URL" type="url" />
            <Button type="submit" variant="outline" disabled={!/^https?:\/\//i.test(link.url.trim()) || busy}>
              <Plus />
              Save link
            </Button>
          </form>
          <p className="mt-2 text-[11.5px] text-muted-foreground">News and podcasts Ropi finds for you in Talk are saved here automatically.</p>
        </Panel>

        <div className="flex items-center justify-between pt-2 text-[12px] text-muted-foreground">
          <span>{storageMode() === 'browser' ? 'Folders are saved in this browser until the library tables are set up.' : 'Saved to your account.'}</span>
          <button onClick={() => ensureRow({ match_key: folder.key, hidden: true }).then(() => navigate('/learning'))} className="hover:text-destructive">
            Hide this folder
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
