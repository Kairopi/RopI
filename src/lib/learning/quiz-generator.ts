/**
 * ROPI Quiz Generation System
 * 
 * Generates quizzes from user documents (PDFs, MD, TXT)
 * Reference: LEARNINGS_FROM_4_LEARNING_SYSTEMS.md - SurfSense pattern
 * 
 * Key Features:
 * - Parse user documents locally (nothing uploaded)
 * - Extract key concepts with AI
 * - Generate multiple-choice questions
 * - Ground questions in source material with citations
 */

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  concept: string; // Key concept being tested
  difficulty: 'easy' | 'medium' | 'hard';
  sourceCitation?: {
    documentTitle: string;
    documentId: string;
    pageNumber?: number;
    section?: string;
  };
  /** Verified: quote is a verbatim substring of the chunk it cites */
  source?: QuestionSource;
}
export interface QuestionSource {
  sourceId: string;
  chunkId: string;
  title: string;
  page?: number | null;
  quote: string;
}

export interface Quiz {
  id: string;
  userId: string;
  topic: string;
  title: string;
  questions: QuizQuestion[];
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit?: number; // in minutes
  generatedFromSources: string[]; // document IDs
  /** A quiz still being written: how many questions it will have when done */
  expectedCount?: number;
  createdAt: Date;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  topic: string;
  answers: Array<{
    questionId: string;
    selectedAnswerIndex: number;
    isCorrect: boolean;
    timeTakenSeconds: number;
  }>;
  score: number; // percentage
  correctCount: number;
  totalQuestions: number;
  totalTimeSeconds: number;
  weakSpots: string[]; // concepts that need review
  createdAt: Date;
}

export interface DocumentContent {
  id: string;
  title: string;
  content: string;
  type: 'pdf' | 'md' | 'txt' | 'docx';
  metadata?: {
    author?: string;
    pageCount?: number;
    sections?: string[];
  };
}

/**
 * Parse document content
 * In production, this would use pdf.js, mammoth.js, etc.
 * For now, accepts pre-parsed text
 */
export async function parseDocument(
  file: File
): Promise<DocumentContent> {
  const fileType = file.name.split('.').pop()?.toLowerCase() as 'pdf' | 'md' | 'txt' | 'docx';
  
  // TODO: Implement actual parsing
  // - pdf.js for PDFs
  // - mammoth.js for DOCX
  // - direct text for MD/TXT
  
  return {
    id: crypto.randomUUID(),
    title: file.name,
    content: '', // Will be populated by actual parser
    type: fileType,
    metadata: {},
  };
}

/**
 * Extract key concepts from document content
 * Uses Meta Muse Wonder to identify important concepts worth testing
 */
export async function extractKeyConcepts(
  content: string,
  topic: string,
  maxConcepts: number = 20
): Promise<string[]> {
  const { extractConceptsWithMuse, isMuseConfigured } = await import('@/lib/api/muse');
  
  if (!isMuseConfigured()) {
    console.warn('Meta Muse not configured. Returning empty concepts.');
    return [];
  }
  
  try {
    return await extractConceptsWithMuse(content, topic, maxConcepts);
  } catch (error) {
    console.error('Error extracting concepts:', error);
    return [];
  }
}

/**
 * Generate quiz questions from documents
 * Uses Meta Muse Wonder reasoning to create questions grounded in sources
 */
export async function generateQuizFromDocuments(
  documents: DocumentContent[],
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard',
  questionCount: number = 10,
  focusConcept?: string
): Promise<Omit<Quiz, 'id' | 'userId' | 'createdAt'>> {
  const { generateQuizWithMuse, isMuseConfigured } = await import('@/lib/api/muse');
  
  if (!isMuseConfigured()) {
    throw new Error('Ropi’s assistant isn’t set up. Please set VITE_MUSE_API_KEY in .env');
  }
  
  try {
    // Prepare documents for Muse
    const museDocs = documents.map(doc => ({
      title: doc.title,
      content: doc.content,
      id: doc.id,
    }));
    
    // Generate questions with Meta Muse Wonder
    const museQuestions = await generateQuizWithMuse(
      museDocs,
      topic,
      difficulty,
      questionCount,
      focusConcept
    );
    
    // Convert to our QuizQuestion format
    const questions: QuizQuestion[] = museQuestions.map((mq, index) => ({
      id: `q${index + 1}`,
      question: mq.question,
      options: mq.options,
      correctAnswerIndex: mq.correctAnswerIndex,
      explanation: mq.explanation,
      concept: mq.concept,
      difficulty: mq.difficulty,
      sourceCitation: mq.sourceCitation ? {
        documentTitle: mq.sourceCitation.documentTitle,
        documentId: documents.find(d => d.title === mq.sourceCitation?.documentTitle)?.id || '',
        pageNumber: mq.sourceCitation.pageNumber,
        section: mq.sourceCitation.section,
      } : undefined,
    }));
    
    return {
      topic,
      title: `${topic} Quiz${focusConcept ? ` - ${focusConcept}` : ''}`,
      questions,
      difficulty,
      timeLimit: questionCount * 2, // 2 minutes per question
      generatedFromSources: documents.map(d => d.id),
    };
  } catch (error) {
    console.error('Error generating quiz with Muse:', error);
    throw error;
  }
}

/**
 * Generate quiz from text content
 * Simpler version for quick quiz creation
 */
export async function generateQuizFromText(
  content: string,
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard',
  questionCount: number = 10
): Promise<Omit<Quiz, 'id' | 'userId' | 'createdAt'>> {
  const { generateQuizFromTextWithMuse, isMuseConfigured } = await import('@/lib/api/muse');
  
  if (!isMuseConfigured()) {
    throw new Error('Ropi’s assistant isn’t set up. Please set VITE_MUSE_API_KEY in .env');
  }
  
  try {
    // Generate questions with Meta Muse Wonder
    const museQuestions = await generateQuizFromTextWithMuse(
      content,
      topic,
      difficulty,
      questionCount
    );
    
    // Convert to our QuizQuestion format
    const questions: QuizQuestion[] = museQuestions.map((mq, index) => ({
      id: `q${index + 1}`,
      question: mq.question,
      options: mq.options,
      correctAnswerIndex: mq.correctAnswerIndex,
      explanation: mq.explanation,
      concept: mq.concept,
      difficulty: mq.difficulty,
    }));
    
    return {
      topic,
      title: `${topic} Quiz`,
      questions,
      difficulty,
      timeLimit: questionCount * 2,
      generatedFromSources: [],
    };
  } catch (error) {
    console.error('Error generating quiz from text with Muse:', error);
    throw error;
  }
}

/**
 * Score a quiz attempt
 */
export function scoreQuizAttempt(
  quiz: Quiz,
  answers: Array<{
    questionId: string;
    selectedAnswerIndex: number;
    timeTakenSeconds: number;
  }>
): Omit<QuizAttempt, 'id' | 'userId' | 'createdAt'> {
  const scoredAnswers = answers.map(answer => {
    const question = quiz.questions.find(q => q.id === answer.questionId);
    if (!question) {
      throw new Error(`Question ${answer.questionId} not found in quiz`);
    }
    
    const isCorrect = answer.selectedAnswerIndex === question.correctAnswerIndex;
    
    return {
      questionId: answer.questionId,
      selectedAnswerIndex: answer.selectedAnswerIndex,
      isCorrect,
      timeTakenSeconds: answer.timeTakenSeconds,
    };
  });
  
  const correctCount = scoredAnswers.filter(a => a.isCorrect).length;
  const totalQuestions = quiz.questions.length;
  const score = Math.round((correctCount / totalQuestions) * 100);
  
  // Identify weak spots (concepts from wrong answers)
  const weakSpots = scoredAnswers
    .filter(a => !a.isCorrect)
    .map(a => {
      const question = quiz.questions.find(q => q.id === a.questionId);
      return question?.concept || '';
    })
    .filter(Boolean);
  
  const totalTimeSeconds = scoredAnswers.reduce(
    (sum, a) => sum + a.timeTakenSeconds,
    0
  );
  
  return {
    quizId: quiz.id,
    topic: quiz.topic,
    answers: scoredAnswers,
    score,
    correctCount,
    totalQuestions,
    totalTimeSeconds,
    weakSpots: [...new Set(weakSpots)], // Remove duplicates
  };
}

/**
 * Get quiz statistics for a user
 */
export function getQuizStatistics(
  attempts: QuizAttempt[],
  topic?: string
): {
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  totalTimeMinutes: number;
  commonWeakSpots: Array<{ concept: string; count: number }>;
  improvementTrend: number; // positive = improving, negative = declining
} {
  const filteredAttempts = topic
    ? attempts.filter(a => a.topic === topic)
    : attempts;
  
  if (filteredAttempts.length === 0) {
    return {
      totalAttempts: 0,
      averageScore: 0,
      bestScore: 0,
      worstScore: 0,
      totalTimeMinutes: 0,
      commonWeakSpots: [],
      improvementTrend: 0,
    };
  }
  
  const scores = filteredAttempts.map(a => a.score);
  const averageScore = Math.round(
    scores.reduce((sum, s) => sum + s, 0) / scores.length
  );
  const bestScore = Math.max(...scores);
  const worstScore = Math.min(...scores);
  
  const totalTimeMinutes = Math.round(
    filteredAttempts.reduce((sum, a) => sum + a.totalTimeSeconds, 0) / 60
  );
  
  // Analyze weak spots
  const weakSpotCounts = new Map<string, number>();
  filteredAttempts.forEach(attempt => {
    attempt.weakSpots.forEach(concept => {
      weakSpotCounts.set(concept, (weakSpotCounts.get(concept) || 0) + 1);
    });
  });
  
  const commonWeakSpots = Array.from(weakSpotCounts.entries())
    .map(([concept, count]) => ({ concept, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // Calculate improvement trend (compare first half vs second half)
  const midpoint = Math.floor(filteredAttempts.length / 2);
  if (midpoint > 0) {
    const firstHalf = filteredAttempts.slice(0, midpoint);
    const secondHalf = filteredAttempts.slice(midpoint);
    
    const firstAvg = firstHalf.reduce((sum, a) => sum + a.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, a) => sum + a.score, 0) / secondHalf.length;
    
    const improvementTrend = Math.round(secondAvg - firstAvg);
    
    return {
      totalAttempts: filteredAttempts.length,
      averageScore,
      bestScore,
      worstScore,
      totalTimeMinutes,
      commonWeakSpots,
      improvementTrend,
    };
  }
  
  return {
    totalAttempts: filteredAttempts.length,
    averageScore,
    bestScore,
    worstScore,
    totalTimeMinutes,
    commonWeakSpots,
    improvementTrend: 0,
  };
}

/**
 * Suggest next quiz difficulty based on performance
 */
export function suggestNextDifficulty(
  recentAttempts: QuizAttempt[]
): 'easy' | 'medium' | 'hard' {
  if (recentAttempts.length === 0) return 'easy';
  
  // Take last 3 attempts
  const recent = recentAttempts.slice(-3);
  const avgScore = recent.reduce((sum, a) => sum + a.score, 0) / recent.length;
  
  if (avgScore >= 85) return 'hard';
  if (avgScore >= 70) return 'medium';
  return 'easy';
}
