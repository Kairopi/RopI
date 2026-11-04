/**
 * Learn - find the gaps, then fix them.
 *
 * One way in: name a topic (or drop your notes) and choose "Quiz me" or
 * "Study guide + cards". Below that, your topic folders, the ready-made quizzes,
 * your study guides and your documents. Reviews are one button in the header.
 *
 * A study guide opens as soon as it's saved, and the cards you keep join your
 * daily reviews (FSRS), like the questions you miss in a quiz.
 */

import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useUserId } from '../contexts/AuthContext';
import { MuseApiStatus } from '../components/MuseApiStatus';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '@/components/Panel';
import { TopicFolders } from '@/components/TopicFolders';
import { DocumentUpload, type ParsedDocument } from '../components/documents/DocumentUpload';
import { listSources, saveSource, SourcesUnavailableError, type Source } from '@/lib/documents/sources';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Brain, BookOpen, ArrowRight, CheckCircle, Loader2, Mic, X, FileText } from '@/components/icons';
import { generateStudyGuide } from '@/lib/learning/study-guide-generator';
import { saveStudyGuide, saveFlashcards, fetchStudyGuides, cardCount, type StudyGuideDB } from '@/lib/learning/study-materials-db';
import { createConceptCard, saveCardToDatabase } from '@/lib/learning/spaced-repetition';
import { useLearningStats } from '@/hooks/useLearningStats';
import { useLoop } from '@/hooks/useLoop';
import { BUILT_IN_QUIZ_LIST } from '@/lib/mock/quizzes';
import { cn } from '@/lib/utils';
import { loadFolders } from '@/lib/library/topics';
import { prefetchTopicQuiz } from '@/lib/learning/topic-quiz';

type Level = 'beginner' | 'intermediate' | 'advanced';
// The generators use easy/medium/hard
const GENERATOR_DIFFICULTY = { beginner: 'easy', intermediate: 'medium', advanced: 'hard' } as const;
const MODE_KEY = 'ropi-learn-mode-v1';

interface PreviewCard {
  id: string;
  front: string;
  back: string;
  topic: string;
  tags: string[];
  difficulty: string;
  selected: boolean;
}

export default function Learning() {
  const navigate = useNavigate();
  const userId = useUserId();
  const { stats } = useLearningStats(userId);

  // What you want to learn, and from what
  const [mode, setMode] = useState<'topic' | 'notes'>(() => (localStorage.getItem(MODE_KEY) === 'notes' ? 'notes' : 'topic'));
  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);
  const [topic, setTopic] = useState('');
  // Start writing the quiz while you're still typing: by the time you press Quiz me it's often ready
  useEffect(() => {
    const t = topic.trim();
    if (t.length < 4 || BUILT_IN_QUIZ_LIST.some((q) => q.topic.toLowerCase() === t.toLowerCase())) return;
    const timer = setTimeout(() => prefetchTopicQuiz(t), 900);
    return () => clearTimeout(timer);
  }, [topic]);
  const [level, setLevel] = useState<Level>('intermediate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ flashcards: PreviewCard[]; studyGuide: any; from: 'question' | 'upload' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastUploadName = useRef<string>('');

  // Uploaded PDF/DOCX: saved as a quotable source
  const [lastDoc, setLastDoc] = useState<ParsedDocument | null>(null);
  const [savingSource, setSavingSource] = useState(false);
  const [savedSource, setSavedSource] = useState<{ id: string; chunks: number; folder: string } | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesAvailable, setSourcesAvailable] = useState(true);

  const [guides, setGuides] = useState<StudyGuideDB[] | null>(null);
  // Which folder an uploaded document goes in ('' = a new folder named after the file)
  const [docFolder, setDocFolder] = useState('');
  const [folderNames, setFolderNames] = useState<string[]>([]);

  const refreshSources = () =>
    listSources()
      .then((r) => {
        setSources(r.sources);
        setSourcesAvailable(r.available);
      })
      .catch(() => undefined);
  useEffect(() => {
    if (!userId) return;
    refreshSources();
    fetchStudyGuides(userId)
      .then(setGuides)
      .catch(() => setGuides([]));
    loadFolders(userId)
      .then((f) => setFolderNames(f.map((x) => x.topic)))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const quizMe = () => {
    const t = topic.trim();
    if (!t) return;
    const builtIn = BUILT_IN_QUIZ_LIST.find((q) => q.topic.toLowerCase() === t.toLowerCase() || q.title.toLowerCase() === t.toLowerCase());
    navigate(builtIn ? `/quiz/${builtIn.id}` : `/quiz/new?topic=${encodeURIComponent(t)}`);
  };

  const handleDocumentParsed = async (doc: ParsedDocument) => {
    lastUploadName.current = doc.fileName;
    setLastDoc(doc);
    setSavedSource(null);
    setSourceError(null);
    setSavingSource(true);
    try {
      const title = doc.fileName.replace(/\.(pdf|docx?)$/i, '');
      const { source, chunks, existing } = await saveSource({
        title,
        topic: docFolder || title,
        fileName: doc.fileName,
        fileType: doc.fileType,
        text: doc.text,
        pages: doc.pages,
      });
      setSavedSource({ id: source.id, chunks, folder: source.topic || title });
      if (!existing) refreshSources();
    } catch (e) {
      setSourceError(e instanceof Error ? e.message : 'Could not save the document');
      if (e instanceof SourcesUnavailableError) setSourcesAvailable(false);
    } finally {
      setSavingSource(false);
    }
  };

  // Step 1: Meta Muse writes it, you pick which cards to keep
  const generateAndPreview = async (context: string, topicName: string, from: 'question' | 'upload') => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const studyGuide = await generateStudyGuide(context, topicName, GENERATOR_DIFFICULTY[level]);
      setPreview({
        from,
        studyGuide,
        flashcards: (studyGuide.flashcards || []).map((card: any, index: number) => ({
          id: `preview-${index}`,
          front: card.front,
          back: card.back,
          topic: card.topic || topicName,
          tags: card.tags || [],
          difficulty: card.difficulty || level,
          selected: true,
        })),
      });
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Ropi couldn’t write the guide just now. Try again in a moment.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 2: save the guide and the cards you kept, then open the guide
  const saveAndOpen = async () => {
    if (!preview) return;
    const kept = preview.flashcards.filter((c) => c.selected);
    if (kept.length === 0) return;
    setIsSaving(true);
    setGenerationError(null);
    try {
      const guideId = await saveStudyGuide(preview.studyGuide, userId, preview.from);
      await saveFlashcards(
        kept.map((c) => ({ front: c.front, back: c.back, topic: c.topic, tags: c.tags, difficulty: c.difficulty })),
        guideId,
        userId
      );
      // The cards join your daily reviews, scheduled by FSRS like the questions you miss
      let scheduled = 0;
      try {
        const guideTopic = String(preview.studyGuide.topic || kept[0].topic);
        const cards = await Promise.all(
          kept.map(async (c) => {
            const card = await createConceptCard(guideTopic, c.front, c.back);
            card.sourceLesson = String(preview.studyGuide.title || guideTopic);
            return card;
          })
        );
        await Promise.all(cards.map((card) => saveCardToDatabase(card, userId)));
        scheduled = cards.length;
        useLoop.setState({ loadedFor: null });
      } catch (e) {
        console.warn('Cards saved to the guide but not added to reviews:', e);
      }
      setPreview(null);
      setTopic('');
      navigate(`/study-guide/${guideId}`, { state: { created: { kept: kept.length, scheduled } } });
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Could not save the study guide');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCard = (id: string) =>
    preview && setPreview({ ...preview, flashcards: preview.flashcards.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)) });
  const toggleAll = () => {
    if (!preview) return;
    const all = preview.flashcards.every((c) => c.selected);
    setPreview({ ...preview, flashcards: preview.flashcards.map((c) => ({ ...c, selected: !all })) });
  };

  // One line of real numbers instead of four tiles of zeros
  const facts = [
    stats.dueNow > 0 ? `${stats.dueNow} card${stats.dueNow === 1 ? '' : 's'} due` : stats.totalCards > 0 ? 'Nothing due' : null,
    stats.streakDays > 0 ? `${stats.streakDays}-day streak` : null,
    stats.retentionRate !== null ? `${stats.retentionRate}% recalled in 30 days` : null,
  ].filter(Boolean);
  const keptCount = preview?.flashcards.filter((c) => c.selected).length ?? 0;

  return (
    <DashboardLayout>
      <PageHeader
        title="Find the gaps, then fix them"
        description={
          facts.length
            ? facts.join(' · ')
            : 'Take one quiz. Ropi scores every concept, and what you miss comes back right before you’d forget it.'
        }
        actions={
          <Button variant={stats.dueNow > 0 ? 'default' : 'outline'} onClick={() => navigate('/reviews')}>
            <Brain />
            {stats.dueNow > 0 ? `Review ${stats.dueNow} now` : 'Reviews'}
          </Button>
        }
      />

      {/* One way in */}
      <span id="documents" className="block scroll-mt-6" />
      <Card className="mb-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Learn something new</h2>
          <div role="radiogroup" aria-label="Learn from" className="inline-flex rounded-lg bg-muted p-0.5">
            {(
              [
                ['topic', 'A topic'],
                ['notes', 'My notes'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  'h-8 rounded-md px-3 text-[13px] transition-colors',
                  mode === m ? 'bg-card font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <MuseApiStatus />

        {mode === 'topic' ? (
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              quizMe();
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Topic to learn"
                placeholder="Any topic, e.g. Kubernetes basics or stakeholder mapping"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={120}
                disabled={isGenerating}
                className="h-11"
              />
              <Button type="submit" size="lg" disabled={!topic.trim() || isGenerating} className="shrink-0">
                Quiz me
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="shrink-0"
                disabled={!topic.trim() || isGenerating}
                onClick={() => generateAndPreview(topic.trim(), topic.trim(), 'question')}
              >
                {isGenerating && <Loader2 className="animate-spin" />}
                {isGenerating ? 'Writing your guide' : 'Study guide + cards'}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12.5px] text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Quiz me</span>: 6 questions, scored by concept.{' '}
                <span className="font-medium text-foreground">Study guide</span>: a summary and cards you choose to keep.
              </p>
              <div role="radiogroup" aria-label="Level" className="inline-flex items-center gap-1">
                {(['beginner', 'intermediate', 'advanced'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={level === d}
                    onClick={() => setLevel(d)}
                    disabled={isGenerating}
                    className={cn('rounded-md px-2 py-0.5 capitalize transition-colors', level === d ? 'bg-muted font-medium text-foreground' : 'hover:text-foreground')}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </form>
        ) : (
          <div className="mt-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]">
              <label htmlFor="doc-folder" className="text-muted-foreground">
                Put it in
              </label>
              <select
                id="doc-folder"
                value={docFolder}
                onChange={(e) => setDocFolder(e.target.value)}
                className="h-8 rounded-lg border bg-background px-2 text-[13px]"
              >
                <option value="">A new folder (named after the file)</option>
                {folderNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <DocumentUpload onDocumentParsed={handleDocumentParsed} compact />
            {lastDoc ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-background p-3.5">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium">{lastDoc.fileName}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {savingSource
                      ? 'Saving it so quiz questions can quote it...'
                      : savedSource
                        ? `Saved in ${savedSource.folder} · ${savedSource.chunks} passage${savedSource.chunks === 1 ? '' : 's'} Ropi can quote`
                        : sourceError ?? ''}
                    {savedSource && (
                      <>
                        {' · '}
                        <button className="font-medium text-primary hover:underline" onClick={() => navigate(`/learn/doc/${savedSource.id}`)}>
                          Read it
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <Button size="sm" disabled={!savedSource} onClick={() => savedSource && navigate(`/quiz/new?source=${savedSource.id}`)}>
                  Quiz me on it (with quotes)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isGenerating}
                  onClick={() => generateAndPreview(lastDoc.text, lastUploadName.current.replace(/\.(pdf|docx?)$/i, '') || 'My document', 'upload')}
                >
                  {isGenerating && <Loader2 className="animate-spin" />}
                  {isGenerating ? 'Writing your guide' : 'Study guide + cards'}
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-[12.5px] text-muted-foreground">
                Every quiz question quotes the exact line its answer comes from, so you can check it against your notes.
              </p>
            )}
            {!sourcesAvailable && (
              <p className="mt-3 text-[12px] text-warning-ink">
                To keep documents, run <code className="num break-all">supabase-migrations/20261104_receipts_and_sources.sql</code> in Supabase.
              </p>
            )}
          </div>
        )}

        {generationError && (
          <div role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-destructive/[0.06] p-3 text-[13px] text-destructive">
            {generationError}
          </div>
        )}
      </Card>

      <TopicFolders userId={userId} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {/* Ready-made quizzes */}
        <Panel
          id="learn-quiz"
          title="Ready-made quizzes"
          summary={`${BUILT_IN_QUIZ_LIST.length} quizzes, 6 questions each`}
          actions={
            <Button size="sm" variant="ghost" onClick={() => navigate('/voice-quiz')}>
              <Mic />
              By voice
            </Button>
          }
        >
          <ul className="-mx-2">
            {BUILT_IN_QUIZ_LIST.map((q) => (
              <li key={q.id}>
                <button
                  onClick={() => navigate(`/quiz/${q.id}`)}
                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{q.title}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {q.questions.length} questions · {new Set(q.questions.map((x) => x.concept)).size} concepts · about 3 min
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Study guides */}
        <Panel
          id="learn-guides"
          title="Study guides"
          meta={guides?.length ? String(guides.length) : undefined}
          summary={guides?.length ? guides.slice(0, 3).map((g) => g.title).join(' · ') : 'None yet'}
          actions={
            guides && guides.length > 4 ? (
              <Button size="sm" variant="ghost" onClick={() => navigate('/learning-hub')}>
                See all
                <ArrowRight />
              </Button>
            ) : undefined
          }
        >
          {guides === null ? (
            <div className="space-y-2" aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/70" />
              ))}
            </div>
          ) : guides.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Ask for a <span className="font-medium text-foreground">Study guide + cards</span> above. Ropi writes a short summary with real examples and cards; you keep the
              ones that are right, and the guide is saved here.
            </p>
          ) : (
            <ul className="-mx-2">
              {guides.slice(0, 4).map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => navigate(`/study-guide/${g.id}`)}
                    className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{g.title}</div>
                      <div className="text-[12px] text-muted-foreground">
                        {cardCount(g)} card{cardCount(g) === 1 ? '' : 's'} · {new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Your documents */}
      {sources.length > 0 && (
        <Panel
          id="learn-docs"
          className="mt-6"
          title="Your documents"
          meta={String(sources.length)}
          summary={sources.slice(0, 3).map((s) => s.title).join(' · ')}
        >
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {sources.slice(0, 8).map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/learn/doc/${s.id}`)}>
                  <div className="truncate text-[13px] font-medium hover:text-primary">{s.title}</div>
                  {s.summary && <div className="truncate text-[12px] text-muted-foreground">{s.summary}</div>}
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11.5px] text-muted-foreground">
                    {(s.tags ?? []).slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded bg-muted px-1.5 py-px text-[10.5px]">
                        #{tag}
                      </span>
                    ))}
                    <span>
                      {s.page_count ? `${s.page_count} page${s.page_count === 1 ? '' : 's'} · ` : ''}
                      {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {s.topic && s.topic !== s.title ? ` · in ${s.topic}` : ''}
                    </span>
                  </div>
                </button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/quiz/new?source=${s.id}`)}>
                  Quiz me
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Voice quiz on ${s.title}`} onClick={() => navigate(`/voice-quiz?quiz=new&source=${s.id}`)}>
                  <Mic />
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Keep the cards you want, before anything is saved */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="keep-title">
          <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden shadow-float">
            <div className="border-b p-6">
              <div className="mb-1 flex items-center justify-between">
                <h2 id="keep-title" className="text-[19px] font-semibold">
                  {preview.studyGuide.title || 'Your study guide'}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setPreview(null)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[13.5px] text-muted-foreground">Untick any card that’s wrong or that you already know.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[13px] text-muted-foreground">
                  {keptCount} of {preview.flashcards.length} kept
                </div>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {preview.flashcards.every((c) => c.selected) ? 'Untick all' : 'Tick all'}
                </Button>
              </div>
              <div className="space-y-2">
                {preview.flashcards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    aria-pressed={card.selected}
                    className={cn('flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors', card.selected ? 'bg-card' : 'opacity-55 hover:opacity-100')}
                    onClick={() => toggleCard(card.id)}
                  >
                    <span
                      className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2', card.selected ? 'border-primary bg-primary' : 'border-input')}
                      aria-hidden="true"
                    >
                      {card.selected && <CheckCircle className="h-4 w-4 text-primary-foreground" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium">{card.front}</span>
                      <span className="mt-1 block text-[13px] text-muted-foreground">{card.back}</span>
                      {card.tags.length > 0 && (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {card.tags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-[11px]">
                              {tag}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-5">
              <p className="text-[12.5px] text-muted-foreground">Kept cards join your daily reviews and come back right before you’d forget them.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPreview(null)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={saveAndOpen} disabled={isSaving || keptCount === 0}>
                  {isSaving && <Loader2 className="animate-spin" />}
                  {isSaving ? 'Saving' : `Save and open the guide`}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
