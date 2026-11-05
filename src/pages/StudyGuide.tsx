/**
 * Study Guide Viewer Page
 * 
 * Opens right after you save a guide. Three tabs:
 * 1. Summary - what Meta Muse wrote
 * 2. Cards - flip through the cards you kept (spacing happens in Daily reviews)
 * 3. Quiz - a fresh Muse quiz on the guide's topic
 */

import { useState, useEffect, useRef } from 'react';
import { Rating, createConceptCard, getCardsByTopic, reviewCardComplete, saveCardToDatabase, type ConceptCard } from '@/lib/learning/spaced-repetition';
import { useLoop } from '@/hooks/useLoop';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useUserId } from '../contexts/AuthContext';
import { FlashcardViewer } from '../components/FlashcardViewer';
import { SummaryView } from '../components/SummaryView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  BookOpen, 
  CreditCard, 
  FileQuestion, 
  Calendar,
  Loader2,
  Trash2,
  CheckCircle2,
} from '@/components/icons';
import { 
  fetchStudyGuideById, 
  deleteStudyGuide,
  type StudyGuideDB 
} from '@/lib/learning/study-materials-db';

export default function StudyGuide() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useUserId();
  const created = (useLocation().state as { created?: { kept: number; scheduled: number } } | null)?.created;

  const [guide, setGuide] = useState<StudyGuideDB | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  
  useEffect(() => {
    if (id && userId) {
      loadGuide(id);
    }
  }, [id, userId]);
  
  const loadGuide = async (guideId: string) => {
    setIsLoading(true);
    try {
      const data = await fetchStudyGuideById(guideId, userId);
      
      if (data) {
        setGuide(data);
      } else {
        // Guide not found
        navigate('/learning');
      }
    } catch (error) {
      console.error('Failed to load study guide:', error);
      navigate('/learning');
    } finally {
      setIsLoading(false);
    }
  };
  
  const [cardsDone, setCardsDone] = useState(false);
  const handleFlashcardsComplete = () => setCardsDone(true);

  // Rating a card here schedules it in daily reviews (the same review card, matched by its question)
  const reviewCards = useRef<Map<string, ConceptCard> | null>(null);
  const handleRate = async (flashcardId: string, rating: 0 | 1 | 2 | 3) => {
    if (!guide) return;
    const fc = guide.flashcards?.find((f) => f.id === flashcardId);
    if (!fc) return;
    const topic = String(guide.topic || guide.title);
    if (!reviewCards.current) {
      const all = await getCardsByTopic(userId, topic).catch(() => [] as ConceptCard[]);
      reviewCards.current = new Map(all.map((c) => [c.question.trim(), c]));
    }
    let card = reviewCards.current.get(fc.front.trim());
    if (!card) {
      const fresh = await createConceptCard(topic, fc.front, fc.back);
      fresh.sourceLesson = guide.title;
      card = (await saveCardToDatabase(fresh, userId)).card;
    }
    const r = await reviewCardComplete(card, (rating + 1) as Rating, userId);
    reviewCards.current.set(fc.front.trim(), { ...card, ...r.updatedCard } as ConceptCard);
    useLoop.setState({ loadedFor: null });
  };
  
  const handleDelete = async () => {
    if (!guide || !id) return;
    
    if (!confirm('Are you sure you want to delete this study guide? This cannot be undone.')) {
      return;
    }
    
    try {
      await deleteStudyGuide(id, userId);
      navigate('/learning');
    } catch (error) {
      console.error('Failed to delete study guide:', error);
      alert('Failed to delete study guide');
    }
  };
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }
  
  if (!guide) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-[17px] font-semibold">Study guide not found</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">It may have been deleted.</p>
          <Button 
            onClick={() => navigate('/learning')}
            className="mt-4"
          >
            Back to Learn
          </Button>
        </div>
      </DashboardLayout>
    );
  }
  
  const flashcards = guide.flashcards || [];
  
  return (
    <DashboardLayout>
      <button
        onClick={() => navigate('/learning')}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Learn
      </button>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            {guide.topic || 'Study guide'}
            <span className="text-border">/</span>
            <span className="capitalize">{guide.difficulty}</span>
            <span className="text-border">/</span>
            <span className="num normal-case tracking-normal">{flashcards.length} cards</span>
          </span>
        }
        title={guide.title}
        actions={
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:bg-destructive/[0.06] hover:text-destructive">
            <Trash2 />
            Delete
          </Button>
        }
      />
      {created && (
        <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
          <p className="flex items-center gap-2 text-[13.5px]">
            <CheckCircle2 className="h-4 w-4 text-success" />
            {created.scheduled > 0
              ? `Saved. ${created.kept} card${created.kept === 1 ? '' : 's'} joined your daily reviews.`
              : `Saved with ${created.kept} card${created.kept === 1 ? '' : 's'}. They couldn't be added to your reviews just now.`}
          </p>
          {created.scheduled > 0 && (
            <Button size="sm" variant="outline" onClick={() => navigate('/reviews')}>
              Review them now
            </Button>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Summary</span>
          </TabsTrigger>
          
          <TabsTrigger value="flashcards" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Cards</span>
            <Badge variant="secondary" className="ml-1 hidden md:inline-flex">
              {flashcards.length}
            </Badge>
          </TabsTrigger>
          
          <TabsTrigger value="quiz" className="flex items-center gap-2">
            <FileQuestion className="w-4 h-4" />
            <span className="hidden sm:inline">Quiz</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Summary Tab */}
        <TabsContent value="summary">
          <SummaryView guide={guide} />
        </TabsContent>
        
        {/* Flashcards Tab */}
        <TabsContent value="flashcards">
          {flashcards.length > 0 ? (
            <>
              <p className="mb-2 text-[13px] text-muted-foreground">
                Flip a card, then say how well you knew it. Your answer decides when it comes back in{' '}
                <button onClick={() => navigate('/reviews')} className="font-medium text-primary hover:underline">
                  Daily reviews
                </button>
                .
              </p>
              {cardsDone && (
                <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-success/25 bg-success/[0.06] px-4 py-3 text-[13px]">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="flex-1">All {flashcards.length} cards done. Each one is scheduled for right before you’d forget it.</span>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('quiz')}>
                    Test yourself
                  </Button>
                </div>
              )}
              <FlashcardViewer flashcards={flashcards} onComplete={handleFlashcardsComplete} onRate={handleRate} />
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No flashcards available
            </div>
          )}
        </TabsContent>
        
        {/* Quiz Tab */}
        <TabsContent value="quiz">
          <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
              <FileQuestion className="h-6 w-6 text-primary" />
            </span>
            <h3 className="text-[17px] font-semibold">Test yourself on {guide.topic || guide.title}</h3>
            <p className="mt-1 max-w-sm text-[13.5px] text-muted-foreground">
              Six new questions. Anything you miss comes back as a card.
            </p>
            <Button className="mt-5" onClick={() => navigate(`/quiz/new?topic=${encodeURIComponent(guide.topic || guide.title)}`)}>
              <FileQuestion />
              Start quiz
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
