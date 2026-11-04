import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useUserId } from '../contexts/AuthContext';
import { StudyGuideCard } from '../components/StudyGuideCard';
import { PageHeader } from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Loader2 } from '@/components/icons';
import { fetchStudyGuides, type StudyGuideDB } from '@/lib/learning/study-materials-db';

export default function LearningHub() {
  const navigate = useNavigate();
  const userId = useUserId();
  const [studyGuides, setStudyGuides] = useState<StudyGuideDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (userId) loadStudyGuides();
  }, [userId]);
  
  const loadStudyGuides = async () => {
    setIsLoading(true);
    try {
      const guides = await fetchStudyGuides(userId);
      setStudyGuides(guides);
    } catch (error) {
      console.error('Failed to load study guides:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Learning Hub"
        title="Study guides"
        description="Everything Meta Muse wrote for you from a topic or a document, with the flashcards you kept."
        actions={
          <Button onClick={() => navigate('/learning')}>
            <Plus />
            New study guide
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border bg-card" />
          ))}
        </div>
      ) : studyGuides.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
            <BookOpen className="h-6 w-6 text-primary" />
          </span>
          <h3 className="text-[17px] font-semibold">No study guides yet</h3>
          <p className="mt-1 max-w-sm text-[13.5px] text-muted-foreground">
            Give Meta Muse a topic or upload a PDF, and it writes a guide plus flashcards you can review.
          </p>
          <Button className="mt-5" onClick={() => navigate('/learning')}>
            <Plus />
            Create a study guide
          </Button>
        </div>      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {studyGuides.map(guide => (
            <StudyGuideCard 
              key={guide.id} 
              guide={guide}
              onClick={() => navigate(`/study-guide/${guide.id}`)}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
