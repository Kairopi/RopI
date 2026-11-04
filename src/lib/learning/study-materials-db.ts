/**
 * Study Materials Database Functions
 * 
 * Database layer for study guides and flashcards
 * Integrates with Supabase for persistence
 */

import { supabase } from '@/lib/supabase';
import type { StudyGuide } from './study-guide-generator';
import type { Flashcard } from './flashcard-generator';

// ===== TYPES =====

export interface StudyGuideDB {
  id: string;
  user_id: string;
  topic: string;
  title: string;
  summary: string;
  key_points: string[];
  prerequisites: string[];
  learning_objectives: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_study_time_minutes: number;
  source_documents: string[];
  source_type: 'upload' | 'url' | 'question' | 'ai-search';
  created_at: string;
  updated_at: string;
  flashcards?: FlashcardDB[];
}

export interface FlashcardDB {
  id: string;
  study_guide_id: string;
  user_id: string;
  front: string;
  back: string;
  topic: string;
  tags: string[];
  difficulty: string;
  position: number;
  
  // FSRS fields
  stability: number;
  difficulty_score: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
  reps: number;
  lapses: number;
  fsrs_card: any;
  next_review_at: string;
  last_reviewed_at: string | null;
  review_count: number;
  
  created_at: string;
}

// ===== STUDY GUIDES =====

export async function saveStudyGuide(
  guide: StudyGuide,
  userId: string,
  sourceType: 'upload' | 'url' | 'question' | 'ai-search' = 'question'
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('study_guides')
      .insert({
        user_id: userId,
        topic: guide.topic,
        title: guide.title,
        summary: guide.summary,
        key_points: guide.keyPoints,
        prerequisites: guide.prerequisites,
        learning_objectives: guide.learningObjectives,
        difficulty: guide.difficulty,
        estimated_study_time_minutes: guide.estimatedStudyTimeMinutes,
        source_documents: guide.sourceDocuments,
        source_type: sourceType,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Failed to save study guide:', error);
      throw error;
    }
    
    return data.id;
  } catch (error) {
    console.error('saveStudyGuide error:', error);
    throw error;
  }
}

/** Cards in a guide: works with a full flashcards list or a lashcards(count) select */
export function cardCount(guide: Pick<StudyGuideDB, 'flashcards'>): number {
  const f = guide.flashcards as unknown as Array<{ count?: number }> | undefined;
  if (!f?.length) return 0;
  return typeof f[0]?.count === 'number' && f.length === 1 && !('front' in (f[0] as object)) ? f[0].count! : f.length;
}

export async function fetchStudyGuides(userId: string): Promise<StudyGuideDB[]> {
  try {
    const { data, error } = await supabase
      .from('study_guides')
      .select(`
        *,
        flashcards (
          count
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Failed to fetch study guides:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('fetchStudyGuides error:', error);
    return [];
  }
}

export async function fetchStudyGuideById(
  guideId: string,
  userId: string
): Promise<StudyGuideDB | null> {
  try {
    const { data, error } = await supabase
      .from('study_guides')
      .select(`
        *,
        flashcards (*)
      `)
      .eq('id', guideId)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Failed to fetch study guide:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('fetchStudyGuideById error:', error);
    return null;
  }
}

export async function deleteStudyGuide(guideId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('study_guides')
      .delete()
      .eq('id', guideId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Failed to delete study guide:', error);
      throw error;
    }
  } catch (error) {
    console.error('deleteStudyGuide error:', error);
    throw error;
  }
}

// ===== FLASHCARDS =====

/** What saveFlashcards needs (generated flashcards or user-curated preview cards) */
export type FlashcardInput = Pick<Flashcard, 'front' | 'back' | 'topic'> & {
  tags?: string[];
  difficulty?: string;
  fsrs_card?: unknown;
};

export async function saveFlashcards(
  flashcards: FlashcardInput[],
  studyGuideId: string,
  userId: string
): Promise<void> {
  try {
    const flashcardRows = flashcards.map((card, index) => ({
      study_guide_id: studyGuideId,
      user_id: userId,
      front: card.front,
      back: card.back,
      topic: card.topic,
      tags: card.tags || [],
      difficulty: card.difficulty || 'intermediate',
      position: index,
      
      // FSRS fields (initialize with default values)
      stability: 1.0,
      difficulty_score: 0.3,
      state: 'new',
      reps: 0,
      lapses: 0,
      fsrs_card: card.fsrs_card || {
        due: new Date().toISOString(),
        stability: 1.0,
        difficulty: 0.3,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        state: 0, // New
        lastReview: new Date().toISOString(),
      },
      next_review_at: new Date().toISOString(),
      last_reviewed_at: null,
      review_count: 0,
    }));
    
    const { error } = await supabase
      .from('flashcards')
      .insert(flashcardRows);
    
    if (error) {
      console.error('Failed to save flashcards:', error);
      throw error;
    }
    
    console.log(`✅ Saved ${flashcardRows.length} flashcards to database`);
  } catch (error) {
    console.error('saveFlashcards error:', error);
    throw error;
  }
}

export async function fetchFlashcardsByStudyGuide(
  studyGuideId: string,
  userId: string
): Promise<FlashcardDB[]> {
  try {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('study_guide_id', studyGuideId)
      .eq('user_id', userId)
      .order('position', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch flashcards:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('fetchFlashcardsByStudyGuide error:', error);
    return [];
  }
}

export async function updateFlashcardReview(
  flashcardId: string,
  updatedCard: Partial<FlashcardDB>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('flashcards')
      .update(updatedCard)
      .eq('id', flashcardId);
    
    if (error) {
      console.error('Failed to update flashcard:', error);
      throw error;
    }
  } catch (error) {
    console.error('updateFlashcardReview error:', error);
    throw error;
  }
}

export async function getDueFlashcards(
  userId: string,
  limit: number = 20
): Promise<FlashcardDB[]> {
  try {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userId)
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error('Failed to fetch due flashcards:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('getDueFlashcards error:', error);
    return [];
  }
}

// ===== STATISTICS =====

export async function getStudyStats(userId: string) {
  try {
    // Total study guides
    const { count: guidesCount } = await supabase
      .from('study_guides')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    // Total flashcards
    const { count: flashcardsCount } = await supabase
      .from('flashcards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    // Due flashcards
    const { count: dueCount } = await supabase
      .from('flashcards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review_at', new Date().toISOString());
    
    // Mastery (cards in review state)
    const { count: masteryCount } = await supabase
      .from('flashcards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('state', 'review');
    
    return {
      studyGuides: guidesCount || 0,
      flashcards: flashcardsCount || 0,
      dueFlashcards: dueCount || 0,
      masteredFlashcards: masteryCount || 0,
      masteryPercentage: flashcardsCount 
        ? Math.round(((masteryCount || 0) / flashcardsCount) * 100)
        : 0,
    };
  } catch (error) {
    console.error('getStudyStats error:', error);
    return {
      studyGuides: 0,
      flashcards: 0,
      dueFlashcards: 0,
      masteredFlashcards: 0,
      masteryPercentage: 0,
    };
  }
}
