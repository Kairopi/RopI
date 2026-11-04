/**
 * Study Guide Viewer Page
 * 
 * Full-featured study guide with 4 tabs:
 * 1. Summary - AI-generated overview
 * 2. Flashcards - 3D flip viewer with FSRS
 * 3. Quiz - Muse-generated quiz on the guide topic
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Trash2
} from '@/components/icons';
import { 
  fetchStudyGuideById, 
  updateFlashcardReview,
  deleteStudyGuide,
  type StudyGuideDB 
} from '@/lib/learning/study-materials-db';

export default function StudyGuide() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useUserId();
  
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
        navigate('/learning-hub');
      }
    } catch (error) {
      console.error('Failed to load study guide:', error);
      navigate('/learning-hub');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRateFlashcard = async (flashcardId: string, rating: 0 | 1 | 2 | 3) => {
    try {
      // TODO: Implement FSRS rating logic
      // For now, just update review count
      await updateFlashcardReview(flashcardId, {
        review_count: 1, // Would increment properly
        last_reviewed_at: new Date().toISOString(),
        next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day later
      });
      
      console.log(`✅ Rated flashcard ${flashcardId} with rating ${rating}`);
    } catch (error) {
      console.error('Failed to rate flashcard:', error);
      throw error;
    }
  };
  
  const handleFlashcardsComplete = () => {
    console.log('🎉 Flashcard session complete!');
    // Could show confetti or navigate somewhere
  };
  
  const handleDelete = async () => {
    if (!guide || !id) return;
    
    if (!confirm('Are you sure you want to delete this study guide? This cannot be undone.')) {
      return;
    }
    
    try {
      await deleteStudyGuide(id, userId);
      navigate('/learning-hub');
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
            onClick={() => navigate('/learning-hub')}
            className="mt-4"
          >
            Back to Learning Hub
          </Button>
        </div>
      </DashboardLayout>
    );
  }
  
  const flashcards = guide.flashcards || [];
  
  return (
    <DashboardLayout>
      <button
        onClick={() => navigate('/learning-hub')}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Study guides
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
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Summary</span>
          </TabsTrigger>
          
          <TabsTrigger value="flashcards" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Flashcards</span>
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
            <FlashcardViewer 
              flashcards={flashcards}
              onRate={handleRateFlashcard}
              onComplete={handleFlashcardsComplete}
            />
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
              Meta Muse writes a fresh 6-question quiz. Anything you miss becomes a review card and updates your weak spots.
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
