/**
 * Learning Dashboard Page
 * 
 * Shows quizzes, review stats, and learning progress
 */

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useUserId } from '../contexts/AuthContext';
import { MuseApiStatus } from '../components/MuseApiStatus';
import { PageHeader, SectionTitle } from '../components/PageHeader';
import { Panel } from '@/components/Panel';
import { TopicFolders } from '@/components/TopicFolders';
import { DocumentUpload, type ParsedDocument } from '../components/documents/DocumentUpload';
import { listSources, saveSource, SourcesUnavailableError, type Source } from '@/lib/documents/sources';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Brain,
  BookOpen,
  TrendingUp,
  Calendar,
  Clock,
  Target,
  ArrowRight,
  Plus,
  CheckCircle,
  Loader2,
  Mic,
  X,
} from '@/components/icons';
import { itemVariants, staggerChildrenVariants } from '@/lib/animations/constants';
import { generateStudyGuide } from '@/lib/learning/study-guide-generator';
import { saveStudyGuide, saveFlashcards } from '@/lib/learning/study-materials-db';
import { useLearningStats } from '@/hooks/useLearningStats';
import { BUILT_IN_QUIZ_LIST } from '@/lib/mock/quizzes';

export default function Learning() {
  const navigate = useNavigate();
  const userId = useUserId();
  
  // Question-based generation state
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState(false);
  
  // Preview & validation state (Production pattern from Quizlet/Notion)
  const [generatedPreview, setGeneratedPreview] = useState<{
    flashcards: Array<{
      id: string;
      front: string;
      back: string;
      topic: string;
      tags: string[];
      difficulty: string;
      selected: boolean;
    }>;
    studyGuide: any;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // The generators use easy/medium/hard
  const GENERATOR_DIFFICULTY = { beginner: 'easy', intermediate: 'medium', advanced: 'hard' } as const;
  const lastUploadName = useRef<string>('');

  // Question form: topic (+ optional question) is the source text
  const handleGenerateFromQuestion = async () => {
    if (!topic.trim()) {
      setGenerationError('Please enter a topic');
      return;
    }
    const context = question.trim() ? `${topic}\n\n${question}` : topic;
    await generateAndPreview(context, topic.trim());
  };

  // Uploaded PDF/DOCX: save it as a quotable source (Open Notebook pattern)
  const [lastDoc, setLastDoc] = useState<ParsedDocument | null>(null);
  const [savingSource, setSavingSource] = useState(false);
  const [savedSource, setSavedSource] = useState<{ id: string; chunks: number } | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesAvailable, setSourcesAvailable] = useState(true);

  const refreshSources = () =>
    listSources()
      .then((r) => {
        setSources(r.sources);
        setSourcesAvailable(r.available);
      })
      .catch(() => undefined);
  useEffect(() => {
    if (userId) refreshSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
        topic: topic.trim() || title,
        fileName: doc.fileName,
        fileType: doc.fileType,
        text: doc.text,
        pages: doc.pages,
      });
      setSavedSource({ id: source.id, chunks });
      if (!existing) refreshSources();
    } catch (e) {
      setSourceError(e instanceof Error ? e.message : 'Could not save the document');
      if (e instanceof SourcesUnavailableError) setSourcesAvailable(false);
    } finally {
      setSavingSource(false);
    }
  };

  const handleGenerateFromDocument = async (text: string) => {
    const name = topic.trim() || lastUploadName.current.replace(/\.(pdf|docx?)$/i, '') || 'My document';
    await generateAndPreview(text, name);
  };

  // Step 1: Generate & Preview (human picks which flashcards to keep)
  const generateAndPreview = async (context: string, topicName: string) => {
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(false);
    
    try {
      const studyGuide = await generateStudyGuide(context, topicName, GENERATOR_DIFFICULTY[difficulty]);
      
      console.log('✅ Generated study guide:', {
        flashcards: studyGuide.flashcards?.length || 0,
        keyPoints: studyGuide.keyPoints?.length || 0,
        quiz: studyGuide.quiz?.length || 0,
      });
      
      // Convert flashcards to preview format with selection state
      const flashcardsWithSelection = (studyGuide.flashcards || []).map((card: any, index: number) => ({
        id: `preview-${index}`,
        front: card.front,
        back: card.back,
        topic: card.topic || topicName,
        tags: card.tags || [],
        difficulty: card.difficulty || difficulty,
        selected: true, // All selected by default
      }));
      
      // Show preview modal (Production pattern: human verification before save)
      setGeneratedPreview({
        flashcards: flashcardsWithSelection,
        studyGuide,
      });
      setShowPreview(true);
      
    } catch (error) {
      console.error('❌ Generation failed:', error);
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate study materials');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle saving verified flashcards (Step 2: Human validation + Save)
  const handleSaveVerifiedFlashcards = async () => {
    if (!generatedPreview) return;
    
    setIsSaving(true);
    
    try {
      // Only save selected flashcards (human-curated)
      const selectedCards = generatedPreview.flashcards.filter(card => card.selected);
      
      if (selectedCards.length === 0) {
        setGenerationError('Please select at least one flashcard to save');
        setIsSaving(false);
        return;
      }
      
      console.log(`💾 Saving study guide and ${selectedCards.length} verified flashcards...`);
      
      // Step 1: Save study guide to database
      const studyGuideId = await saveStudyGuide(
        generatedPreview.studyGuide,
        userId,
        'question' // Source type
      );
      
      console.log(`✅ Study guide saved: ${studyGuideId}`);
      
      // Step 2: Save flashcards linked to study guide
      await saveFlashcards(
        selectedCards.map(card => ({
          front: card.front,
          back: card.back,
          topic: card.topic,
          tags: card.tags,
          difficulty: card.difficulty,
        })),
        studyGuideId,
        userId
      );
      
      console.log(`✅ Saved ${selectedCards.length} flashcards to database`);
      
      setGenerationSuccess(true);
      setShowPreview(false);
      setGeneratedPreview(null);
      
      // Clear form after showing success
      setTimeout(() => {
        setTopic('');
        setQuestion('');
        setGenerationSuccess(false);
        
        // Navigate to Learning Hub to see the new study guide
        navigate('/learning-hub');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Save failed:', error);
      setGenerationError(error instanceof Error ? error.message : 'Failed to save flashcards');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Toggle flashcard selection
  const toggleFlashcardSelection = (id: string) => {
    if (!generatedPreview) return;
    
    setGeneratedPreview({
      ...generatedPreview,
      flashcards: generatedPreview.flashcards.map(card =>
        card.id === id ? { ...card, selected: !card.selected } : card
      ),
    });
  };
  
  // Select all / deselect all
  const toggleSelectAll = () => {
    if (!generatedPreview) return;
    
    const allSelected = generatedPreview.flashcards.every(card => card.selected);
    
    setGeneratedPreview({
      ...generatedPreview,
      flashcards: generatedPreview.flashcards.map(card => ({
        ...card,
        selected: !allSelected,
      })),
    });
  };
  
  // Real numbers from Supabase
  const { stats } = useLearningStats(userId);
  const [customTopic, setCustomTopic] = useState('');

  /** Built-in quiz for a topic if there is one, else a Muse-generated quiz */
  const quizPathFor = (topicName: string) => {
    const builtIn = BUILT_IN_QUIZ_LIST.find((q) => q.topic.toLowerCase() === topicName.toLowerCase());
    return builtIn ? `/quiz/${builtIn.id}` : `/quiz/new?topic=${encodeURIComponent(topicName)}`;
  };
  
  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Learn"
        title="Find the gaps, then fix them"
        description="Every concept is scored. What you miss comes back right before you’d forget it."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/learning-hub')}>
              <BookOpen />
              Study guides
            </Button>
            <Button onClick={() => navigate('/reviews')}>
              <Brain />
              Reviews{stats.dueNow > 0 ? ` (${stats.dueNow})` : ''}
            </Button>
          </>
        }
      />

      {/* Ledger */}
      <Card className="mb-6 grid grid-cols-2 gap-px overflow-hidden bg-border lg:grid-cols-4">
        <Ledger label="Due now" value={String(stats.dueNow)} sub={stats.dueNow ? 'ready to review' : 'nothing waiting'} accent={stats.dueNow > 0} />
        <Ledger label="Reviewed today" value={String(stats.reviewedToday)} sub="cards" />
        <Ledger
          label="Retention, 30 days"
          value={stats.retentionRate === null ? '–' : String(stats.retentionRate)}
          unit={stats.retentionRate === null ? '' : '%'}
          sub="answers you recalled"
        />
        <Ledger label="Streak" value={String(stats.streakDays)} unit={stats.streakDays === 1 ? ' day' : ' days'} sub="in a row" />
      </Card>

      <TopicFolders userId={userId} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Quizzes */}
        <Panel
          id="learn-quiz"
          title="Take a quiz"
          summary={`${BUILT_IN_QUIZ_LIST.length} ready, or any topic you type`}
          actions={
            <Button size="sm" variant="ghost" onClick={() => navigate('/voice-quiz')}>
              <Mic />
              Voice quiz
            </Button>
          }
        >

          <div className="divide-y rounded-xl border">
            {BUILT_IN_QUIZ_LIST.map((q, i) => (
              <button
                key={q.id}
                onClick={() => navigate(`/quiz/${q.id}`)}
                className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/60"
              >
                <span className="num w-5 text-[12px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{q.title}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {q.questions.length} questions · {new Set(q.questions.map((x) => x.concept)).size} concepts
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ))}
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (customTopic.trim()) navigate(`/quiz/new?topic=${encodeURIComponent(customTopic.trim())}`);
            }}
          >
            <Input
              placeholder="Or any topic, e.g. Kubernetes basics"
              aria-label="Quiz topic"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              maxLength={120}
            />
            <Button type="submit" variant="outline" disabled={!customTopic.trim()} className="shrink-0">
              <Plus />
              Generate quiz
            </Button>
          </form>
        </Panel>

        {/* Reviews */}
        <Panel
          id="learn-reviews"
          title="Daily reviews"
          meta={stats.dueNow > 0 ? <Badge variant="solid">{stats.dueNow} due</Badge> : undefined}
          summary={stats.dueNow > 0 ? `${stats.dueNow} ready to review` : 'Nothing due'}
          bodyClassName="flex flex-col"
        >
          {stats.dueNow > 0 ? (
            <div className="flex flex-1 flex-col">
              <p className="text-[13.5px] text-muted-foreground">
                {stats.dueNow} concept{stats.dueNow !== 1 ? 's are' : ' is'} ready. About 20 seconds each
                {stats.reviewedToday > 0 ? `, and you've done ${stats.reviewedToday} today.` : '.'}
              </p>
              <div className="mt-auto pt-6">
                <Button onClick={() => navigate('/reviews')} className="w-full">
                  Start reviewing
                  <ArrowRight />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-start justify-center rounded-xl border border-dashed p-5">
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="h-[18px] w-[18px] text-success" />
              </span>
              <p className="text-[14px] font-medium">{stats.totalCards > 0 ? 'All caught up' : 'No review cards yet'}</p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {stats.totalCards > 0
                  ? `${stats.totalCards} card${stats.totalCards !== 1 ? 's' : ''} scheduled for later.`
                  : 'Questions you miss in a quiz become review cards.'}
              </p>
            </div>
          )}
        </Panel>

        {/* Recent quizzes */}
        <Panel
          className="lg:col-span-2"
          id="learn-recent"
          title="Recent quizzes"
          summary={stats.recentAttempts.length ? `${stats.recentAttempts.length} recent · last ${stats.recentAttempts[0].score}%` : 'None yet'}
        >
          {stats.recentAttempts.length === 0 ? (
            <p className="rounded-xl border border-dashed p-5 text-[13px] text-muted-foreground">Your quiz history will show up here.</p>
          ) : (
            <div className="space-y-1">
              {stats.recentAttempts.map((attempt) => (
                <button
                  key={attempt.id}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                  onClick={() => navigate(quizPathFor(attempt.topic))}
                >
                  <span
                    className={`num flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold ${
                      attempt.score >= 85
                        ? 'bg-success/10 text-success'
                        : attempt.score >= 70
                          ? 'bg-primary/10 text-primary'
                          : 'bg-warning/15 text-warning-ink'
                    }`}
                  >
                    {attempt.score}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{attempt.topic}</div>
                    <div className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      {new Date(attempt.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      {' · '}
                      {attempt.correct_answers}/{attempt.total_questions} correct
                      {attempt.quiz_mode === 'voice' ? ' · voice' : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Make your own */}
      <span id="documents" className="block scroll-mt-6" />
      <Panel
        id="learn-make"
        variant="bare"
        className="mt-10 border-t pt-6"
        title="Make your own"
        meta="From a topic or your own notes"
        summary="Upload a PDF or DOCX, or name a topic. Meta Muse writes the cards."
        actions={<MuseApiStatus />}
      >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle>From a topic</SectionTitle>
          <div className="space-y-4">
            <div>
              <label htmlFor="gen-topic" className="mb-1.5 block text-[13px] font-medium">Topic</label>
              <Input
                id="gen-topic"
                placeholder="AWS Lambda, React hooks, product management"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
              />
            </div>
            <div>
              <label htmlFor="gen-question" className="mb-1.5 block text-[13px] font-medium">
                Question or focus <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="gen-question"
                placeholder="How do closures work in JavaScript?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isGenerating}
                rows={3}
              />
            </div>
            <div>
              <div className="mb-1.5 text-[13px] font-medium">Level</div>
              <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Level">
                {(['beginner', 'intermediate', 'advanced'] as const).map((d) => (
                  <button
                    key={d}
                    role="radio"
                    aria-checked={difficulty === d}
                    onClick={() => setDifficulty(d)}
                    disabled={isGenerating}
                    className={`rounded-md px-3 py-1 text-[12.5px] font-medium capitalize transition-colors ${
                      difficulty === d ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(225_20%_8%/0.08)]' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {generationError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/[0.06] p-3 text-[13px] text-destructive">{generationError}</div>
            )}
            {generationSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/[0.06] p-3 text-[13px] text-success">
                <CheckCircle className="h-4 w-4" />
                Saved. Opening your study guides.
              </div>
            )}

            <Button onClick={handleGenerateFromQuestion} disabled={isGenerating || !topic.trim()} className="w-full">
              {isGenerating && <Loader2 className="animate-spin" />}
              {isGenerating ? 'Meta Muse is writing...' : 'Generate study materials'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle>From a document</SectionTitle>
          <p className="mb-4 text-[13px] text-muted-foreground">
            PDF or DOCX. Ropi keeps it as a source, so every quiz question quotes the exact line its answer comes from.
          </p>
          <DocumentUpload onDocumentParsed={handleDocumentParsed} />

          {lastDoc && (
            <div className="mt-4 rounded-xl border bg-background p-4">
              <div className="truncate text-[13.5px] font-medium">{lastDoc.fileName}</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {savingSource
                  ? 'Saving it as a source you can quote...'
                  : savedSource
                    ? `Saved as a source · ${savedSource.chunks} passage${savedSource.chunks === 1 ? '' : 's'}`
                    : sourceError ?? ''}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={!savedSource} onClick={() => savedSource && navigate(`/quiz/new?source=${savedSource.id}`)}>
                  <BookOpen />
                  Quiz me on it (with quotes)
                </Button>
                <Button size="sm" variant="outline" disabled={isGenerating} onClick={() => handleGenerateFromDocument(lastDoc.text)}>
                  {isGenerating ? <Loader2 className="animate-spin" /> : <BookOpen />}
                  {isGenerating ? 'Writing study guide...' : 'Study guide + flashcards'}
                </Button>
              </div>
            </div>
          )}

          {sources.length > 0 && (
            <div className="mt-5">
              <div className="eyebrow mb-2">Your documents</div>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {sources.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{s.title}</div>
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
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/quiz/new?source=${s.id}`)}>
                      Quiz me
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Voice quiz on ${s.title}`} onClick={() => navigate(`/voice-quiz?quiz=new&source=${s.id}`)}>
                      <Mic />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!sourcesAvailable && (
            <p className="mt-3 text-[12px] text-warning-ink">
              To keep documents and quiz on them with quotes, run <code className="num break-all">supabase-migrations/20261104_receipts_and_sources.sql</code> in Supabase.
            </p>
          )}
        </Card>
      </div>
      </Panel>
      {/* Preview Modal - Production pattern: Human verification before save */}
      {showPreview && generatedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[2px]">
          <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden shadow-float">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold">
                  Keep the cards you want
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Meta Muse wrote these. Untick anything that is wrong or you already know.
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  {generatedPreview.flashcards.filter(c => c.selected).length} of {generatedPreview.flashcards.length} selected
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {generatedPreview.flashcards.every(c => c.selected) ? 'Deselect all' : 'Select all'}
                </Button>
              </div>
              
              <div className="space-y-3">
                {generatedPreview.flashcards.map((card) => (
                  <div
                    key={card.id}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      card.selected ? 'border-primary/40 bg-accent' : 'opacity-60 hover:opacity-100'
                    }`}
                    onClick={() => toggleFlashcardSelection(card.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          card.selected ? 'bg-primary border-primary' : 'border-input'
                        }`}>
                          {card.selected && (
                            <CheckCircle className="w-4 h-4 text-primary-foreground" />
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div>
                          <div className="eyebrow mb-1">Front</div>
                          <div className="font-medium">{card.front}</div>
                        </div>
                        
                        <div>
                          <div className="eyebrow mb-1">Back</div>
                          <div className="text-sm">{card.back}</div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {card.topic}
                          </Badge>
                          {card.tags.map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">
                  {generatedPreview.flashcards.filter(c => c.selected).length} flashcards ready
                </div>
                <div className="text-xs text-muted-foreground">
                  They join your daily reviews, scheduled by FSRS
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveVerifiedFlashcards}
                  disabled={isSaving || generatedPreview.flashcards.filter(c => c.selected).length === 0}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Save selected cards
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}

function Ledger({ label, value, unit, sub, accent = false }: { label: string; value: string; unit?: string; sub: string; accent?: boolean }) {
  return (
    <div className="bg-card p-5">
      <div className="text-[12.5px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-2.5 flex items-baseline">
        <span className={`font-display text-[30px] font-semibold leading-none tracking-[-0.035em] tabular-nums ${accent ? 'text-primary' : ''}`}>{value}</span>
        {unit && <span className={`font-display text-[15px] font-semibold text-muted-foreground ${unit.trim().length > 1 ? 'ml-1' : ''}`}>{unit.trim()}</span>}
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">{sub}</div>
    </div>
  );
}